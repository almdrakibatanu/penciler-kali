import { ImageResponse } from 'next/og';

// Edge runtime: next/og ships its fonts inlined here, avoiding the Node-runtime
// file-path lookup that breaks the build on Windows.
export const runtime = 'edge';

// Stable 512x512 brand mark served at /logo (PNG). Used as the Organization /
// publisher logo in JSON-LD and as the site favicon. Latin "PK" only — the
// next/og default font has no Bangla glyphs, so we avoid Bangla here.
// (ImageResponse already sets Content-Type: image/png.)
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a5fbf 0%, #0c2e5e 100%)',
          color: 'white',
          fontSize: 260,
          fontWeight: 800,
          letterSpacing: -8,
          fontFamily: 'sans-serif',
        }}
      >
        PK
      </div>
    ),
    { width: 512, height: 512 },
  );
}
