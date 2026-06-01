const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';

export interface ArticleListItem {
  id: number; slug: string; title: string; summary: string | null;
  category: string; tags: string | null; hero_image_url: string | null;
  thumbnail_url?: string | null;
  published_at: number | null; created_at: number;
}
export interface Article extends ArticleListItem {
  body: string; subtitle: string | null;
  seo_title: string | null; seo_description: string | null;
  fb_caption: string | null; og_image_url: string | null;
  source_urls: string | null; status: string;
}

// Safe fetch: returns `fallback` on any network error, non-2xx response, or a
// non-JSON body (e.g. an HTML error/placeholder page) instead of throwing.
// Critical during `next build` prerender, when the API may not be reachable yet
// — without this the page render crashes on `r.json()` of an HTML response.
async function fetchJson<T>(url: string | URL, opts: { next?: { revalidate?: number } }, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, opts as RequestInit);
    if (!r.ok) return fallback;
    const ct = r.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

export async function listArticles(opts: { category?: string; q?: string; limit?: number; offset?: number } = {}): Promise<{ items: ArticleListItem[] }> {
  const u = new URL(`${BASE}/api/articles`);
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) u.searchParams.set(k, String(v));
  return fetchJson(u, { next: { revalidate: 60 } }, { items: [] as ArticleListItem[] });
}

export async function getArticle(slug: string): Promise<Article | null> {
  return fetchJson<Article | null>(`${BASE}/api/articles/${slug}`, { next: { revalidate: 30 } }, null);
}

export async function listVideos(): Promise<{ items: Array<{ id: number; title: string; thumbnail_url: string | null; youtube_id: string | null; created_at: number }> }> {
  return fetchJson(`${BASE}/api/videos`, { next: { revalidate: 60 } }, { items: [] as Array<{ id: number; title: string; thumbnail_url: string | null; youtube_id: string | null; created_at: number }> });
}

export function formatBnDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
