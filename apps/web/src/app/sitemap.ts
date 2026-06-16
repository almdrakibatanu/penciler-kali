import type { MetadataRoute } from 'next';
import { listArticles, type ArticleListItem } from '@/lib/api';

// Generates /sitemap.xml. Site URL matches layout.tsx's metadataBase.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pencilerkali.com';

// Rebuild the sitemap hourly — matches the news collection cadence. If the API
// is unreachable at build/revalidate time, listArticles() returns [] (safe
// fetch), so the sitemap still emits the static + category routes.
export const revalidate = 3600;

const CATEGORIES = ['bangladesh', 'bidesh', 'kheladhula', 'binodon', 'islamic'];

// The API caps `limit` at 60 per request, so page through offsets until a short
// page comes back (or we hit the safety cap) to collect every published article.
async function allArticles(): Promise<ArticleListItem[]> {
  const PAGE = 60;
  const MAX_PAGES = 50; // up to 3000 article URLs — well under sitemap's 50k cap
  const out: ArticleListItem[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { items } = await listArticles({ limit: PAGE, offset: page * PAGE });
    out.push(...items);
    if (items.length < PAGE) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`,        lastModified: now, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE}/about`,            changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/editorial-policy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/terms`,            changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/contact`,          changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`,          changeFrequency: 'yearly', priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((slug) => ({
    url: `${SITE}/c/${slug}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  const articles = await allArticles();
  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE}/article/${a.slug}`,
    lastModified: new Date(a.published_at ?? a.created_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...articleRoutes];
}
