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

export async function listArticles(opts: { category?: string; q?: string; limit?: number; offset?: number } = {}): Promise<{ items: ArticleListItem[] }> {
  const u = new URL(`${BASE}/api/articles`);
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) u.searchParams.set(k, String(v));
  try {
    const r = await fetch(u, { next: { revalidate: 60 } });
    if (!r.ok) return { items: [] };
    return r.json();
  } catch { return { items: [] }; }
}

export async function getArticle(slug: string): Promise<Article | null> {
  try {
    const r = await fetch(`${BASE}/api/articles/${slug}`, { next: { revalidate: 30 } });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export async function listVideos(): Promise<{ items: Array<{ id: number; title: string; thumbnail_url: string | null; youtube_id: string | null; created_at: number }> }> {
  try {
    const r = await fetch(`${BASE}/api/videos`, { next: { revalidate: 60 } });
    if (!r.ok) return { items: [] };
    return r.json();
  } catch { return { items: [] }; }
}

export function formatBnDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
