import { createHash } from 'node:crypto';

// ----------------------------------------------------------------------------
// MinHash for fast near-duplicate detection of news headlines + summaries.
// 64 permutations gives ~12% Jaccard error at < 1ms per item on Node 20.
// ----------------------------------------------------------------------------

const NUM_HASHES = 64;
const MOD = 2_147_483_647; // Mersenne prime

const seeds: Array<{ a: number; b: number }> = (() => {
  const out: Array<{ a: number; b: number }> = [];
  let s = 0x9e3779b1;
  for (let i = 0; i < NUM_HASHES; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    const a = (x ^ (x >>> 14)) >>> 0;
    s = (s + 0x6d2b79f5) >>> 0;
    let y = s;
    y = Math.imul(y ^ (y >>> 15), y | 1);
    y ^= y + Math.imul(y ^ (y >>> 7), y | 61);
    const b = (y ^ (y >>> 14)) >>> 0;
    out.push({ a: a % MOD || 1, b: b % MOD });
  }
  return out;
})();

function hashToken(t: string): number {
  const h = createHash('md5').update(t).digest();
  return ((h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!) >>> 0;
}

function tokenize(text: string): Set<string> {
  // 3-gram shingling on lowercased letters/numbers; works for Bangla & English
  const norm = text.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const shingles = new Set<string>();
  const grams = 3;
  if (norm.length < grams) { shingles.add(norm); return shingles; }
  for (let i = 0; i <= norm.length - grams; i++) shingles.add(norm.slice(i, i + grams));
  return shingles;
}

export function minhashOf(text: string): Uint32Array {
  const sig = new Uint32Array(NUM_HASHES).fill(0xffffffff);
  for (const tok of tokenize(text)) {
    const h = hashToken(tok);
    for (let i = 0; i < NUM_HASHES; i++) {
      const { a, b } = seeds[i]!;
      const v = (Math.imul(a, h) + b) % MOD;
      if (v < sig[i]!) sig[i] = v;
    }
  }
  return sig;
}

export function encodeMinhash(sig: Uint32Array): string {
  return Buffer.from(sig.buffer, sig.byteOffset, sig.byteLength).toString('base64');
}

export function decodeMinhash(s: string): Uint32Array {
  const buf = Buffer.from(s, 'base64');
  return new Uint32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export function jaccard(a: Uint32Array, b: Uint32Array): number {
  let same = 0;
  for (let i = 0; i < NUM_HASHES; i++) if (a[i] === b[i]) same++;
  return same / NUM_HASHES;
}
