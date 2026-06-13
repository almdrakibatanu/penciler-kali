import { rawDb, getDb } from '@pk/db';
import { collectAll } from '@pk/news-collector';
import { clusterUnprocessed, rewriteCluster, persistArticle, type RewriteOutput } from '@pk/ai-rewriter';
import { buildNewsThumbnail, tryBuildThumbnail } from '@pk/pencil-cloud';
import { renderVideo } from '@pk/pencil-video';
import { postToPage } from '@pk/publisher-fb';
import { uploadVideo } from '@pk/publisher-yt';
import { pingIndexNow, articleUrl } from './seo-ping.js';

// ----------------------------------------------------------------------------
// One stage = one box in the architecture diagram. Each is idempotent and
// safe to re-run; the scheduler chains them every N minutes.
// ----------------------------------------------------------------------------

// Fetch a source article page and pull its OpenGraph/Twitter lead image. Most
// news articles expose a real photo via <meta property="og:image"> even when
// the RSS feed had none — this gives real images instead of placeholders.
async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(pageUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PencilerKaliBot/1.0; +https://pencilerkali.com)' },
      signal: ctrl.signal, redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000); // the <head> is near the top
    const patterns = [
      /<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) {
        const raw = m[1].trim().replace(/&amp;/g, '&');
        if (/^https?:\/\//i.test(raw)) return raw;
        try { return new URL(raw, pageUrl).toString(); } catch { /* ignore */ }
      }
    }
    return null;
  } catch { return null; }
}

// Category → an English stock-photo search term (Pexels/Pixabay search in EN).
const STOCK_QUERY: Record<string, string> = {
  bangladesh: 'bangladesh dhaka city',
  bidesh: 'world map globe news',
  kheladhula: 'cricket stadium sport',
  binodon: 'cinema concert entertainment',
  islamic: 'mosque islamic architecture',
  'politics-review': 'parliament government politics',
};

// Fetch a relevant stock photo via Pexels (preferred) or Pixabay. `seed` varies
// which result is picked so articles in the same category don't all look alike.
async function fetchStockImage(category: string, seed: number): Promise<string | null> {
  const query = STOCK_QUERY[category] ?? 'news headline';
  const pexels = process.env.PEXELS_API_KEY;
  const pixabay = process.env.PIXABAY_API_KEY;
  try {
    if (pexels) {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`, { headers: { authorization: pexels } });
      if (r.ok) {
        const photos = ((await r.json()) as any)?.photos ?? [];
        if (photos.length) { const p = photos[seed % photos.length]; return p?.src?.large ?? p?.src?.original ?? null; }
      }
    }
    if (pixabay) {
      const r = await fetch(`https://pixabay.com/api/?key=${pixabay}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=15&safesearch=true`);
      if (r.ok) {
        const hits = ((await r.json()) as any)?.hits ?? [];
        if (hits.length) { const h = hits[seed % hits.length]; return h?.largeImageURL ?? h?.webformatURL ?? null; }
      }
    }
  } catch { /* ignore */ }
  return null;
}

// Produce the best possible thumbnail by trying candidates in priority order and
// VALIDATING each (only a real, downloadable image counts): provided hero →
// each source's og:image → a category stock photo → branded placeholder. Each
// candidate that fails to download is skipped (so e.g. a broken og:image no
// longer prevents the stock fallback). Returns the thumbnail URL and the hero
// image that actually worked (null = placeholder).
async function bestThumbnail(opts: { title: string; category: string; seed: number; heroUrl: string | null; sourceUrls: string[] }): Promise<{ url: string; hero: string | null }> {
  const meta = { title: opts.title, watermark: 'PencilerKali.com' };
  if (opts.heroUrl) {
    const t = await tryBuildThumbnail(opts.heroUrl, meta);
    if (t) return { url: t.publicUrl, hero: opts.heroUrl };
  }
  for (const su of opts.sourceUrls.slice(0, 3)) {
    if (!su) continue;
    const og = await fetchOgImage(su);
    if (og) { const t = await tryBuildThumbnail(og, meta); if (t) return { url: t.publicUrl, hero: og }; }
  }
  const stock = await fetchStockImage(opts.category, opts.seed);
  if (stock) { const t = await tryBuildThumbnail(stock, meta); if (t) return { url: t.publicUrl, hero: stock }; }
  const ph = await buildNewsThumbnail(null, meta); // always succeeds (placeholder)
  return { url: ph.publicUrl, hero: null };
}

function parseSourceUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : []; }
  catch { return []; }
}

export async function stageCollect(): Promise<{ inserted: number; fetched: number; errors: number }> {
  const s = await collectAll(80);
  return { inserted: s.inserted, fetched: s.fetched, errors: s.errors.length };
}

export async function stageRewrite(
  maxClusters = Number(process.env.REWRITE_MAX_CLUSTERS ?? 40),
): Promise<{ articles: number; flagged: number; skipped: number; pending: number; cappedAt?: number; quotaHit?: boolean }> {
  getDb();
  const db = rawDb();

  // 1) Fold any freshly-collected 'new' items into clusters (new -> clustered).
  clusterUnprocessed(0.55, 200);

  // 2) Daily safety cap — never exceed the AI provider's free-tier daily request
  //    limit. Counts articles created since local midnight.
  const dailyCap = Number(process.env.REWRITE_DAILY_CAP ?? 1200);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayCount = (db.prepare(`SELECT COUNT(*) n FROM articles WHERE created_at >= ?`)
    .get(startOfDay.getTime()) as { n: number }).n;
  const room = Math.max(0, Math.min(maxClusters, dailyCap - todayCount));

  // How many clusters are still waiting to be rewritten (for visibility).
  const pendingTotal = (db.prepare(
    `SELECT COUNT(DISTINCT cluster_id) n FROM raw_items WHERE status='clustered' AND cluster_id IS NOT NULL`
  ).get() as { n: number }).n;

  if (room === 0) return { articles: 0, flagged: 0, skipped: 0, pending: pendingTotal, cappedAt: dailyCap };

  // 3) Drain the backlog: pick clusters that are still 'clustered' (not yet
  //    rewritten), newest first. Fixes the old bug where freshly-clustered
  //    clusters beyond the per-tick limit were orphaned and never rewritten.
  const pending = db.prepare(
    `SELECT cluster_id FROM raw_items
     WHERE status='clustered' AND cluster_id IS NOT NULL
     GROUP BY cluster_id
     ORDER BY MAX(id) DESC
     LIMIT ?`
  ).all(room) as Array<{ cluster_id: string }>;

  // Small gap between calls so a burst doesn't trip the per-minute rate limit.
  const delayMs = Number(process.env.REWRITE_DELAY_MS ?? 4000);

  let articles = 0, flagged = 0, skipped = 0, quotaHit = false;
  const publishedUrls: string[] = [];
  for (const { cluster_id } of pending) {
    try {
      const out: RewriteOutput = await rewriteCluster({ clusterId: cluster_id });
      const id = persistArticle(out, cluster_id);
      articles++; if (out.status === 'flagged') flagged++;
      // auto-publish clean drafts (not flagged) so the homepage gets fresh data
      if (out.status === 'draft') {
        db.prepare(`UPDATE articles SET status='published', published_at=? WHERE id=?`).run(Date.now(), id);
        publishedUrls.push(articleUrl(out.slug)); // notify IndexNow after the batch
      }
      // Build the thumbnail immediately so every new article has an image right
      // away. Use the cluster's image if present, else pull the source article's
      // og:image; only fall back to a branded placeholder when nothing is found.
      try {
        const { url, hero } = await bestThumbnail({ title: out.title, category: out.category, seed: id, heroUrl: out.imageUrl ?? null, sourceUrls: out.sourceUrls ?? [] });
        db.prepare(`UPDATE articles SET thumbnail_url=?, og_image_url=?, hero_image_url=? WHERE id=?`).run(url, url, hero, id);
      } catch (e) {
        console.warn('[rewrite] thumbnail failed for article', id, (e as Error).message);
      }
    } catch (e) {
      // On failure the cluster stays 'clustered' and retries on the next tick.
      skipped++;
      const msg = (e as Error).message;
      if (msg.includes('429')) {
        // Daily free-tier quota exhausted — stop now instead of hammering it
        // with dozens of guaranteed failures. Resumes automatically next tick.
        quotaHit = true;
        console.warn('[rewrite] Gemini quota hit (429) — stopping batch, will resume next tick');
        break;
      }
      console.warn('[rewrite] cluster failed:', cluster_id, msg);
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  // Submit freshly-published URLs to IndexNow (Bing/Yandex). No-op unless
  // INDEXNOW_ENABLED=true; never blocks the pipeline on failure.
  await pingIndexNow(publishedUrls);
  return { articles, flagged, skipped, pending: pendingTotal, quotaHit };
}

// force=false (default, used by the cron): only articles with no thumbnail yet.
// force=true (manual one-shot): re-process ALL articles — validates each hero
//   image and, if it's missing/broken/placeholder, upgrades it to og:image or a
//   stock photo. Use this to fix existing articles that show no/broken images.
export async function stageImage(maxArticles = 10, force = false): Promise<{ thumbed: number; gotRealImage: number }> {
  getDb();
  const where = force
    ? `status IN ('published','draft','flagged')`
    : `thumbnail_url IS NULL AND status IN ('published','draft','flagged')`;
  const rows = rawDb().prepare(`
    SELECT id, title, category, hero_image_url, source_urls FROM articles
    WHERE ${where} ORDER BY id DESC LIMIT ?
  `).all(maxArticles) as Array<{ id: number; title: string; category: string; hero_image_url: string | null; source_urls: string | null }>;
  let thumbed = 0, gotRealImage = 0;
  for (const r of rows) {
    try {
      const { url, hero } = await bestThumbnail({ title: r.title, category: r.category, seed: r.id, heroUrl: r.hero_image_url, sourceUrls: parseSourceUrls(r.source_urls) });
      if (hero) gotRealImage++;
      rawDb().prepare(`UPDATE articles SET thumbnail_url=?, og_image_url=?, hero_image_url=? WHERE id=?`)
        .run(url, url, hero, r.id);
      thumbed++;
    } catch (e) {
      console.warn('[image] failed for article', r.id, (e as Error).message);
    }
  }
  return { thumbed, gotRealImage };
}

export async function stageVideo(maxArticles = 2): Promise<{ rendered: number }> {
  getDb();
  const rows = rawDb().prepare(`
    SELECT a.id, a.title, a.summary, a.body, a.category, a.hero_image_url
    FROM articles a
    LEFT JOIN videos v ON v.article_id = a.id
    WHERE a.status='published' AND v.id IS NULL
      AND (a.category IN ('kheladhula','islamic') OR a.tags LIKE '%hasnat-abdullah%')
    LIMIT ?
  `).all(maxArticles) as Array<{ id: number; title: string; summary: string | null; body: string; category: string; hero_image_url: string | null }>;
  let rendered = 0;
  for (const r of rows) {
    try {
      const id = rawDb().prepare(`
        INSERT INTO videos (article_id, title, script, category, status, created_at)
        VALUES (?, ?, ?, ?, 'rendering', ?) RETURNING id
      `).get(r.id, r.title, r.body, r.category, Date.now()) as { id: number };
      const res = await renderVideo({
        title: r.title,
        scenes: chunkSentences(r.body, 6).map((cap) => ({ imageUrl: r.hero_image_url ?? undefined, caption: cap })),
        voiceText: (r.summary ?? r.title) + '. ' + r.body.slice(0, 600),
        orientation: 'horizontal',
        watermark: 'PencilerKali.com',
      });
      rawDb().prepare(`UPDATE videos SET status='ready', video_file=?, duration=?, voice_file=? WHERE id=?`)
        .run(res.videoPath, res.durationMs / 1000, res.voicePath, id.id);
      rendered++;
    } catch (e) {
      console.warn('[video] failed for article', r.id, (e as Error).message);
    }
  }
  return { rendered };
}

export async function stagePublishFb(max = 5): Promise<{ posted: number }> {
  getDb();
  const rows = rawDb().prepare(`
    SELECT a.id, a.slug, a.title, a.fb_caption
    FROM articles a
    LEFT JOIN posts p ON p.article_id = a.id AND p.channel='facebook' AND p.status IN ('success','dry_run')
    WHERE a.status='published' AND a.category != 'islamic' AND p.id IS NULL
    ORDER BY a.published_at DESC LIMIT ?
  `).all(max) as Array<{ id: number; slug: string; title: string; fb_caption: string | null }>;
  let posted = 0;
  for (const r of rows) {
    // Post caption + link only (no imageUrl) → goes to /feed, so Facebook builds
    // a link-preview card from the article's OpenGraph tags (image + headline).
    const result = await postToPage({
      articleId: r.id,
      message: r.fb_caption ?? r.title,
      link: `${process.env.WEB_PUBLIC_URL ?? 'https://pencilerkali.com'}/article/${r.slug}`,
    });
    if (result.status !== 'failed') posted++;
  }
  return { posted };
}

export async function stagePublishYt(max = 2): Promise<{ uploaded: number }> {
  getDb();
  const rows = rawDb().prepare(`
    SELECT v.id, v.title, v.video_file, v.category, a.summary, a.body
    FROM videos v LEFT JOIN articles a ON a.id = v.article_id
    LEFT JOIN posts p ON p.video_id = v.id AND p.channel='youtube' AND p.status IN ('success','dry_run')
    WHERE v.status='ready' AND v.video_file IS NOT NULL AND p.id IS NULL
    LIMIT ?
  `).all(max) as Array<{ id: number; title: string; video_file: string; category: string; summary: string | null; body: string | null }>;
  let uploaded = 0;
  for (const r of rows) {
    const result = await uploadVideo({
      videoId: r.id,
      filePath: r.video_file,
      title: r.title,
      description: (r.summary ?? r.title) + '\n\nMore on PencilerKali.com',
      tags: [r.category, 'PencilerKali', 'Bangla News'],
      privacy: 'public',
    });
    if (result.externalId) rawDb().prepare(`UPDATE videos SET youtube_id=?, status='uploaded' WHERE id=?`).run(result.externalId, r.id);
    if (result.status !== 'failed') uploaded++;
  }
  return { uploaded };
}

function chunkSentences(text: string, n: number): string[] {
  const parts = text.split(/(?<=[।!?\.])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= n) return parts.length ? parts : [text.slice(0, 120)];
  const step = Math.ceil(parts.length / n);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += step) out.push(parts.slice(i, i + step).join(' ').slice(0, 140));
  return out.slice(0, n);
}
