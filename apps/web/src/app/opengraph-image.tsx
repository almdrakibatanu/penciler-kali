import { ImageResponse } from 'next/og';

// Edge runtime: next/og ships its fonts inlined here, avoiding the Node-runtime
// file-path lookup that breaks the build on Windows.
export const runtime = 'edge';

// Default 1200x630 social-share card used when a page has no specific image
// (homepage, category, static pages). Article pages override this with their
// own hero image. Latin text only — next/og's default font lacks Bangla glyphs.
export const alt = 'PencilerKali.com — Latest Bangla News from Bangladesh';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a5fbf 0%, #0c2e5e 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>PencilerKali.com</div>
        <div style={{ fontSize: 40, marginTop: 16, opacity: 0.85 }}>Latest News from Bangladesh & the World</div>
      </div>
    ),
    size,
  );
}
