import { listArticles } from '@/lib/api';
import { SITE_URL, SITE_NAME } from '@/lib/site';

// Google News sitemap. Unlike the regular sitemap, this lists ONLY articles from
// the last 48 hours (Google News requirement) and carries <news:news> metadata.
// Submit it in Google News Publisher Center; it's also linked from robots.txt.
export const dynamic = 'force-dynamic';

const WINDOW_MS = 48 * 60 * 60 * 1000;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  // Pull the most recent articles (API returns newest first) and keep only the
  // last 48h. One page of 60 is plenty given the publishing cadence.
  const { items } = await listArticles({ limit: 60 });
  const cutoff = Date.now() - WINDOW_MS;
  const fresh = items.filter((a) => (a.published_at ?? a.created_at) >= cutoff);

  const urls = fresh
    .map((a) => {
      const ts = new Date(a.published_at ?? a.created_at).toISOString();
      return `  <url>
    <loc>${SITE_URL}/article/${xmlEscape(a.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(SITE_NAME)}</news:name>
        <news:language>bn</news:language>
      </news:publication>
      <news:publication_date>${ts}</news:publication_date>
      <news:title>${xmlEscape(a.title)}</news:title>
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      // Crawlers re-fetch often; cache briefly so we don't hit the API each time.
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
