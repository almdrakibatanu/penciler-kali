// Generates PencilerKali brand assets (logo, favicon, FB profile + cover) from
// SVG via sharp. Run on a machine with a Bengali font (e.g. Windows "Nirmala UI"):
//   node apps/web/scripts/build-brand.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = resolve(ROOT, 'public/brand');
const APP = resolve(ROOT, 'src/app');
mkdirSync(PUB, { recursive: true });

const BN = 'Nirmala UI, Noto Sans Bengali, sans-serif';
const LAT = 'Segoe UI, Arial, sans-serif';
const defs = `
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2f80e7"/><stop offset="1" stop-color="#0c2e5e"/>
  </linearGradient>
  <linearGradient id="amber" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffd152"/><stop offset="1" stop-color="#f5a623"/>
  </linearGradient>
</defs>`;

// Square "পক" mark with an amber pencil-stroke underline.
function mark(size, rx) {
  const f = size * 0.46, cx = size / 2;
  return `
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <text x="${cx}" y="${size * 0.6}" font-family="${BN}" font-size="${f}" font-weight="800" fill="#fff" text-anchor="middle">পক</text>
  <rect x="${size * 0.26}" y="${size * 0.68}" width="${size * 0.40}" height="${size * 0.05}" rx="${size * 0.025}" fill="url(#amber)"/>
  <path d="M ${size * 0.66} ${size * 0.685} l ${size * 0.06} ${size * 0.025} l -${size * 0.06} ${size * 0.025} z" fill="#0c2e5e"/>`;
}
const svg = (w, h, inner, bg) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${defs}${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${inner}</svg>`;
const out = (w, h, inner, file, bg) => sharp(Buffer.from(svg(w, h, inner, bg))).png().toFile(file);

const logo = `
  <g transform="translate(24,42)">${mark(256, 56)}</g>
  <text x="320" y="150" font-family="${LAT}" font-size="118" font-weight="800" fill="#10325f">PencilerKali<tspan fill="#2f80e7">.com</tspan></text>
  <text x="324" y="232" font-family="${BN}" font-size="50" font-weight="600" fill="#475569">বাংলাদেশের AI সংবাদ পোর্টাল</text>`;

const prof = `
  <rect width="500" height="500" fill="url(#bg)"/>
  <text x="250" y="270" font-family="${BN}" font-size="210" font-weight="800" fill="#fff" text-anchor="middle">পক</text>
  <rect x="150" y="300" width="200" height="22" rx="11" fill="url(#amber)"/>
  <path d="M 350 302 l 30 11 l -30 11 z" fill="#0c2e5e"/>
  <text x="250" y="392" font-family="${LAT}" font-size="40" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="1">PencilerKali.com</text>`;

const cover = `
  <rect width="1640" height="856" fill="url(#bg)"/>
  <circle cx="1500" cy="110" r="430" fill="#fff" opacity="0.04"/>
  <circle cx="150" cy="780" r="330" fill="#fff" opacity="0.04"/>
  <g transform="translate(720,118)">${mark(200, 44)}</g>
  <text x="820" y="470" font-family="${LAT}" font-size="104" font-weight="800" fill="#fff" text-anchor="middle">PencilerKali<tspan fill="#ffd152">.com</tspan></text>
  <text x="820" y="558" font-family="${BN}" font-size="46" font-weight="600" fill="#cfe0f7" text-anchor="middle">বাংলাদেশ • বিদেশ • খেলা • বিনোদন • ইসলামিক</text>
  <text x="820" y="628" font-family="${BN}" font-size="38" font-weight="500" fill="#9db9e0" text-anchor="middle">২৪/৭ AI-চালিত সর্বশেষ সংবাদ</text>`;

await Promise.all([
  out(1280, 340, logo, `${PUB}/logo.png`),
  out(512, 512, mark(512, 112), `${PUB}/icon-512.png`),
  out(32, 32, mark(32, 7), `${PUB}/favicon-32.png`),
  out(500, 500, prof, `${PUB}/fb-profile.png`),
  out(1640, 856, cover, `${PUB}/fb-cover.png`),
  // Next.js app-router favicon + apple touch icon (served automatically)
  out(256, 256, mark(256, 56), `${APP}/icon.png`),
  out(180, 180, mark(180, 40), `${APP}/apple-icon.png`),
]);
console.log('brand assets written to', PUB, 'and', APP);
