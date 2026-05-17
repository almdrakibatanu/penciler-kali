import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { upload } from '@pk/pencil-cloud';

// ----------------------------------------------------------------------------
// pencil-voice — pluggable TTS, ElevenLabs-equivalent for our pipeline.
//
// Engines (auto-picked by env, with safe fallback chain):
//   * piper   — neural offline TTS, supports bn (Bangla). Best quality.
//               needs: PIPER_BIN + PIPER_MODEL pointing at .onnx + .onnx.json
//   * sapi    — Windows SAPI via PowerShell System.Speech.Synthesis.
//               Best if a Bangla voice is installed on the box.
//   * espeak  — eSpeak-NG. Robotic but always available cross-platform.
//   * silent  — synthesises a valid silent WAV (length matches script);
//               used so the rest of the video pipeline can run offline.
// ----------------------------------------------------------------------------

export type VoiceEngine = 'piper' | 'sapi' | 'espeak' | 'silent';

export interface SpeakOptions {
  text: string;
  lang?: string;           // bn, en, hi
  voice?: string;          // engine-specific voice name
  rate?: number;           // -10..+10 SAPI; 0.5..2 piper length-scale
  outDir?: string;
}

export interface SpeakResult {
  path: string;
  durationMs: number;
  engine: VoiceEngine;
  assetId?: string;
  publicUrl?: string;
}

function detectEngine(): VoiceEngine {
  const e = (process.env.PENCIL_VOICE_ENGINE ?? '').toLowerCase() as VoiceEngine;
  if (e === 'piper' || e === 'sapi' || e === 'espeak' || e === 'silent') return e;
  return process.platform === 'win32' ? 'sapi' : 'espeak';
}

export async function speak(opts: SpeakOptions): Promise<SpeakResult> {
  const engine = detectEngine();
  const outDir = opts.outDir ?? resolve(process.cwd(), 'storage/audio');
  await fs.mkdir(outDir, { recursive: true });
  const wav = join(outDir, `${randomUUID()}.wav`);

  try {
    if (engine === 'piper') await synthPiper(opts, wav);
    else if (engine === 'sapi') await synthSapi(opts, wav);
    else if (engine === 'espeak') await synthEspeak(opts, wav);
    else await synthSilent(opts, wav);
  } catch (e) {
    // Fail gracefully — silent WAV so video render still succeeds in dev.
    console.warn(`[pencil-voice] ${engine} failed, falling back to silent:`, (e as Error).message);
    await synthSilent(opts, wav);
    return finalize('silent', wav, opts.text);
  }
  return finalize(engine, wav, opts.text);
}

async function finalize(engine: VoiceEngine, wav: string, text: string): Promise<SpeakResult> {
  const durationMs = estimateDuration(text);
  // upload to pencil-cloud so the rest of the pipeline gets a stable URL
  let assetId: string | undefined, publicUrl: string | undefined;
  try {
    const buf = await fs.readFile(wav);
    const rec = await upload({ source: buf, kind: 'audio', filename: 'voice.wav' });
    assetId = rec.id; publicUrl = rec.publicUrl;
  } catch { /* if pencil-cloud db not initialised yet, that's OK */ }
  return { path: wav, durationMs, engine, assetId, publicUrl };
}

function estimateDuration(text: string): number {
  // ~3.5 chars/sec for Bangla TTS, +800ms padding for breaks
  return Math.max(1500, Math.floor(text.length / 3.5 * 1000) + 800);
}

// --- engine: piper -------------------------------------------------------

function synthPiper(opts: SpeakOptions, wav: string): Promise<void> {
  return new Promise((res, rej) => {
    const bin = process.env.PIPER_BIN;
    const model = opts.voice ?? process.env.PIPER_MODEL;
    if (!bin || !model) return rej(new Error('PIPER_BIN/PIPER_MODEL not set'));
    const args = ['-m', model, '-f', wav, '--length-scale', String(1 / (opts.rate ?? 1))];
    const proc = spawn(bin, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    proc.stdin.end(opts.text);
    proc.on('error', rej);
    proc.on('exit', (code) => code === 0 ? res() : rej(new Error(`piper exit ${code}`)));
  });
}

// --- engine: sapi (Windows PowerShell System.Speech) ---------------------

function synthSapi(opts: SpeakOptions, wav: string): Promise<void> {
  return new Promise((res, rej) => {
    if (process.platform !== 'win32') return rej(new Error('SAPI only available on Windows'));
    const voiceFragment = (opts.voice ?? process.env.SAPI_VOICE ?? '').replace(/'/g, "''");
    const rate = Math.max(-10, Math.min(10, Math.round(((opts.rate ?? 1) - 1) * 5)));
    const txt = opts.text.replace(/'/g, "''");
    const ps = `
      Add-Type -AssemblyName System.Speech;
      $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      if ('${voiceFragment}') {
        $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like "*${voiceFragment}*" -or $_.VoiceInfo.Culture.Name -like "*${voiceFragment}*" } | Select-Object -First 1;
        if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
      }
      $s.Rate = ${rate};
      $s.SetOutputToWaveFile('${wav.replace(/\\/g, '\\\\')}');
      $s.Speak('${txt}');
      $s.Dispose();
    `;
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
    proc.on('error', rej);
    proc.on('exit', (code) => code === 0 ? res() : rej(new Error(`sapi exit ${code}`)));
  });
}

// --- engine: espeak ------------------------------------------------------

function synthEspeak(opts: SpeakOptions, wav: string): Promise<void> {
  return new Promise((res, rej) => {
    const lang = opts.lang ?? 'bn';
    const bin = process.platform === 'win32' ? 'espeak-ng.exe' : 'espeak-ng';
    const args = ['-v', lang, '-s', String(150 * (opts.rate ?? 1)), '-w', wav, opts.text];
    const proc = spawn(bin, args, { stdio: 'ignore' });
    proc.on('error', rej);
    proc.on('exit', (code) => code === 0 ? res() : rej(new Error(`espeak exit ${code}`)));
  });
}

// --- engine: silent ------------------------------------------------------
// Writes a valid 16-bit mono 22.05kHz WAV of zeros so the rest of the
// pipeline (FFmpeg slideshow, YouTube upload) keeps working in dev.
async function synthSilent(opts: SpeakOptions, wav: string): Promise<void> {
  const sampleRate = 22050;
  const seconds = Math.max(2, Math.ceil(estimateDuration(opts.text) / 1000));
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);          // PCM
  buf.writeUInt16LE(1, 22);          // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);          // block align
  buf.writeUInt16LE(16, 34);         // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  await fs.writeFile(wav, buf);
}

export async function listVoices(): Promise<string[]> {
  const engine = detectEngine();
  if (engine !== 'sapi' || process.platform !== 'win32') return [];
  return new Promise((res) => {
    const out: string[] = [];
    const proc = spawn('powershell.exe', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Culture.Name }`,
    ]);
    proc.stdout.on('data', (d) => out.push(...d.toString().split(/\r?\n/).filter(Boolean)));
    proc.on('exit', () => res(out));
    proc.on('error', () => res([]));
  });
}
