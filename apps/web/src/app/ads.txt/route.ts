// /ads.txt — authorises ad sellers. Once AdSense approves you, set ADSENSE_PUB_ID
// in the web app's environment (e.g. ADSENSE_PUB_ID=pub-0000000000000000) and this
// route serves the required Google line automatically. Until then it serves a
// harmless comment so the path exists without claiming any seller.
export const dynamic = 'force-dynamic';

export async function GET() {
  const raw = (process.env.ADSENSE_PUB_ID ?? '').trim();
  // Accept "pub-…", "ca-pub-…", or a bare id; normalise to "pub-…".
  const pub = raw.replace(/^ca-/, '');
  const body = pub.startsWith('pub-')
    ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`
    : `# ads.txt — no ad seller configured yet. Set ADSENSE_PUB_ID after AdSense approval.\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
