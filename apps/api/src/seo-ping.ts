// IndexNow ping — tells Bing & Yandex about new/updated URLs the moment they
// publish, instead of waiting for a crawl. Google deprecated its sitemap-ping
// endpoint and does NOT support IndexNow, so Google discovery still relies on
// the sitemap + Search Console (set those up separately).
//
// Opt-in, like FB/YT dry-run: it only fires when INDEXNOW_ENABLED=true so dev
// runs don't submit production URLs. The key file must be reachable at
// https://<host>/<key>.txt — we serve it from apps/web/public/<key>.txt.

const DEFAULT_KEY = '0f9a3c7e1b6d4582af0e3c9d7b125846';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? DEFAULT_KEY;

function siteUrl(): string {
  return (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pencilerkali.com').replace(/\/+$/, '');
}

export async function pingIndexNow(urls: string[]): Promise<void> {
  const list = urls.filter(Boolean);
  if (!list.length) return;
  if (process.env.INDEXNOW_ENABLED !== 'true') return; // off unless explicitly enabled

  const base = siteUrl();
  try {
    const host = new URL(base).host;
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
        urlList: list,
      }),
    });
    if (!res.ok) console.warn('[indexnow] HTTP', res.status, await res.text().catch(() => ''));
    else console.log(`[indexnow] submitted ${list.length} url(s)`);
  } catch (e) {
    console.warn('[indexnow] ping failed:', (e as Error).message);
  }
}

export function articleUrl(slug: string): string {
  return `${siteUrl()}/article/${slug}`;
}
