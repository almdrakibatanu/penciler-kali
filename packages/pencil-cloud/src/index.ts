import sharp from 'sharp';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { rawDb, getDb } from '@pk/db';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

// ----------------------------------------------------------------------------
// pencil-cloud — a Cloudinary-style media service implemented locally.
//
//   * upload(buffer | url, kind) → asset row + public URL
//   * transform(assetId, { w, h, fit, format, quality, watermark, gravity })
//     returns a *signed* URL the API can hand to browsers
//   * the API package mounts /cdn/:signed → reads the request, validates the
//     HMAC, performs the sharp pipeline, returns the bytes
//
// The signed URL means we never re-encode the same variant twice — the file
// is cached on disk under storage/images/<id>/<variant-hash>.<ext>.
// ----------------------------------------------------------------------------

export type AssetKind = 'image' | 'audio' | 'video';

export interface PencilCloudConfig {
  driver: 'local' | 's3';
  baseUrl: string;
  signingSecret: string;
  rootDir: string;
}

export interface TransformSpec {
  w?: number;
  h?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  blur?: number;
  text?: string;
  textColor?: string;
  watermark?: string;
}

let _cfg: PencilCloudConfig | null = null;

export function configure(cfg: Partial<PencilCloudConfig> = {}): PencilCloudConfig {
  _cfg = {
    driver: (process.env.PENCIL_CLOUD_DRIVER as 'local' | 's3') ?? 'local',
    baseUrl: process.env.PENCIL_CLOUD_BASE_URL ?? 'http://localhost:4000/cdn',
    signingSecret: process.env.PENCIL_CLOUD_SIGNING_SECRET ?? 'dev-secret-change-me',
    rootDir: resolve(process.cwd(), 'storage'),
    ...cfg,
  };
  return _cfg;
}

function cfg(): PencilCloudConfig {
  if (!_cfg) configure();
  return _cfg!;
}

function dirFor(kind: AssetKind): string {
  return join(cfg().rootDir, kind === 'image' ? 'images' : kind === 'audio' ? 'audio' : 'video');
}

export interface UploadInput {
  source: Buffer | string; // Buffer or URL
  kind?: AssetKind;
  filename?: string;
}

export interface AssetRecord {
  id: string;
  kind: AssetKind;
  path: string;
  publicUrl: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolveBuf, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? request : httpRequest;
    const req = lib(u, { method: 'GET', headers: { 'user-agent': 'PencilerKali/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(new URL(res.headers.location, u).toString()).then(resolveBuf, reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolveBuf(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function guessMime(buf: Buffer): string {
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && buf.slice(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (buf.length >= 4 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg';
  return 'application/octet-stream';
}

function mimeToExt(mime: string): string {
  return {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
  }[mime] ?? '.bin';
}

export async function upload(input: UploadInput): Promise<AssetRecord> {
  getDb();
  const buf = Buffer.isBuffer(input.source) ? input.source : await fetchBuffer(input.source);
  const mime = guessMime(buf);
  const kind: AssetKind = input.kind ?? (mime.startsWith('video') ? 'video' : mime.startsWith('audio') ? 'audio' : 'image');
  const id = randomUUID();
  const ext = input.filename ? extname(input.filename) : mimeToExt(mime);
  const relPath = join(kind === 'image' ? 'images' : kind === 'audio' ? 'audio' : 'video', `${id}${ext}`);
  const absPath = join(cfg().rootDir, relPath);
  await fs.mkdir(dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buf);

  let width: number | undefined, height: number | undefined;
  if (kind === 'image') {
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width; height = meta.height;
    } catch { /* not a real image */ }
  }

  const publicUrl = `${cfg().baseUrl}/raw/${id}${ext}`;
  rawDb().prepare(`
    INSERT INTO assets (id, kind, storage, path, public_url, mime, bytes, width, height, created_at)
    VALUES (?, ?, 'local', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, kind, relPath, publicUrl, mime, buf.length, width ?? null, height ?? null, Date.now());

  return { id, kind, path: absPath, publicUrl, mime, bytes: buf.length, width, height };
}

export interface AssetRow {
  id: string; kind: string; path: string; public_url: string; mime: string; bytes: number;
  width: number | null; height: number | null;
}

export function getAsset(id: string): AssetRow | null {
  getDb();
  return (rawDb().prepare(`SELECT * FROM assets WHERE id=?`).get(id) as AssetRow | undefined) ?? null;
}

// --- signed URL helpers --------------------------------------------------

export function signTransform(assetId: string, t: TransformSpec): string {
  const tok = encodeTransform(t);
  const sig = createHmac('sha256', cfg().signingSecret).update(`${assetId}|${tok}`).digest('hex').slice(0, 16);
  return `${cfg().baseUrl}/t/${assetId}/${tok}/${sig}`;
}

export function verifyTransform(assetId: string, tok: string, sig: string): TransformSpec | null {
  const expect = createHmac('sha256', cfg().signingSecret).update(`${assetId}|${tok}`).digest('hex').slice(0, 16);
  if (expect !== sig) return null;
  return decodeTransform(tok);
}

function encodeTransform(t: TransformSpec): string {
  // compact comma list: w_800,h_600,fit_cover,fmt_webp,q_82,blur_3
  const parts: string[] = [];
  if (t.w) parts.push(`w_${t.w}`);
  if (t.h) parts.push(`h_${t.h}`);
  if (t.fit) parts.push(`fit_${t.fit}`);
  if (t.format) parts.push(`fmt_${t.format}`);
  if (t.quality) parts.push(`q_${t.quality}`);
  if (t.blur) parts.push(`blur_${t.blur}`);
  if (t.text) parts.push(`text_${Buffer.from(t.text, 'utf8').toString('base64url')}`);
  if (t.textColor) parts.push(`color_${t.textColor.replace('#', '')}`);
  if (t.watermark) parts.push(`wm_${t.watermark}`);
  return parts.join(',') || '_';
}

function decodeTransform(tok: string): TransformSpec {
  if (tok === '_') return {};
  const t: TransformSpec = {};
  for (const part of tok.split(',')) {
    const [k, v] = part.split('_');
    if (!k || v === undefined) continue;
    switch (k) {
      case 'w': t.w = Number(v); break;
      case 'h': t.h = Number(v); break;
      case 'fit': t.fit = v as TransformSpec['fit']; break;
      case 'fmt': t.format = v as TransformSpec['format']; break;
      case 'q': t.quality = Number(v); break;
      case 'blur': t.blur = Number(v); break;
      case 'text': t.text = Buffer.from(v, 'base64url').toString('utf8'); break;
      case 'color': t.textColor = '#' + v; break;
      case 'wm': t.watermark = v; break;
    }
  }
  return t;
}

// --- transform execution -------------------------------------------------

export async function renderTransform(assetId: string, t: TransformSpec): Promise<{ buffer: Buffer; mime: string; cachePath: string }> {
  const a = getAsset(assetId);
  if (!a) throw new Error(`asset ${assetId} not found`);
  const inputPath = join(cfg().rootDir, a.path);
  const fmt = t.format ?? (a.mime === 'image/png' ? 'png' : 'webp');
  const variantHash = createHash('sha1').update(encodeTransform(t)).digest('hex').slice(0, 10);
  const cachePath = join(dirFor('image'), assetId, `${variantHash}.${fmt}`);
  try {
    const cached = await fs.readFile(cachePath);
    return { buffer: cached, mime: `image/${fmt}`, cachePath };
  } catch { /* miss */ }

  let pipe = sharp(inputPath, { failOnError: false });
  if (t.w || t.h) {
    pipe = pipe.resize({
      width: t.w,
      height: t.h,
      fit: t.fit ?? 'cover',
      withoutEnlargement: false,
    });
  }
  if (t.blur) pipe = pipe.blur(t.blur);
  if (t.text) {
    pipe = pipe.composite([{ input: makeTextSvg(t.text, t.textColor ?? '#ffffff', t.w ?? 800), gravity: 'south' }]);
  }
  if (t.watermark) {
    pipe = pipe.composite([{ input: makeTextSvg(t.watermark, '#ffffffcc', t.w ?? 800, 28), gravity: 'southeast' }]);
  }
  if (fmt === 'webp') pipe = pipe.webp({ quality: t.quality ?? 82 });
  else if (fmt === 'jpeg') pipe = pipe.jpeg({ quality: t.quality ?? 82, mozjpeg: true });
  else if (fmt === 'avif') pipe = pipe.avif({ quality: t.quality ?? 60 });
  else pipe = pipe.png({ compressionLevel: 9 });

  const out = await pipe.toBuffer();
  await fs.mkdir(dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, out);
  return { buffer: out, mime: `image/${fmt}`, cachePath };
}

function makeTextSvg(text: string, color: string, width: number, fontSize = 42): Buffer {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const padded = 18;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${fontSize + padded * 2}">
      <style>
        .t { fill: ${color}; font: 700 ${fontSize}px "Noto Sans Bengali","Arial",sans-serif; paint-order: stroke; stroke: rgba(0,0,0,0.55); stroke-width: 4px; }
      </style>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.35)"/>
      <text x="50%" y="${fontSize + padded}" text-anchor="middle" class="t">${safe}</text>
    </svg>`;
  return Buffer.from(svg);
}

// --- high-level helpers used by the AI image pipeline --------------------

export interface ThumbnailOptions { title: string; subtitle?: string; watermark?: string; }

// Branded 1200x630 gradient used when an article has no usable hero image.
// The headline text is added on top by the transform's `text` overlay.
function placeholderSvg(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1a2b"/><stop offset="100%" stop-color="#1f3a5f"/>
    </linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
  </svg>`;
  return Buffer.from(svg, 'utf8');
}

// Always returns a usable thumbnail. If the source is missing or can't be
// downloaded/decoded (hotlink-blocked, 404, not an image), it falls back to a
// branded placeholder so EVERY article ends up with a proper image.
export async function buildNewsThumbnail(sourceUrlOrBuffer: string | Buffer | null | undefined, opts: ThumbnailOptions): Promise<{ assetId: string; publicUrl: string; usedPlaceholder: boolean }> {
  // 1) get a usable base image, or fall back to the placeholder
  let base: AssetRecord | null = null;
  if (sourceUrlOrBuffer) {
    try {
      const candidate = await upload({ source: sourceUrlOrBuffer, kind: 'image' });
      if (candidate.width && candidate.height) base = candidate; // a real, decodable image
    } catch { /* fall through to placeholder */ }
  }
  const usedPlaceholder = !base;
  if (!base) {
    base = await upload({ source: placeholderSvg(), kind: 'image', filename: 'placeholder.svg' });
  }
  // 2) bake a 1200x630 OG variant with title overlay; cache it on disk via renderTransform
  const t: TransformSpec = {
    w: 1200, h: 630, fit: 'cover', format: 'jpeg', quality: 86,
    text: opts.title.length > 90 ? opts.title.slice(0, 87) + '…' : opts.title,
    textColor: '#ffffff',
    watermark: opts.watermark ?? 'PencilerKali.com',
  };
  await renderTransform(base.id, t);
  return { assetId: base.id, publicUrl: signTransform(base.id, t), usedPlaceholder };
}

// Always good to expose the raw fetcher too — useful in news collection.
export const fetch = fetchBuffer;
