import { rawDb, getDb } from '@pk/db';
import { collectAll } from '@pk/news-collector';
import { clusterUnprocessed, rewriteCluster, persistArticle, type RewriteOutput } from '@pk/ai-rewriter';
import { buildNewsThumbnail } from '@pk/pencil-cloud';
import { renderVideo } from '@pk/pencil-video';
import { postToPage } from '@pk/publisher-fb';
import { uploadVideo } from '@pk/publisher-yt';

// ----------------------------------------------------------------------------
// One stage = one box in the architecture diagram. Each is idempotent and
// safe to re-run; the scheduler chains them every N minutes.
// ----------------------------------------------------------------------------

export async function stageCollect(): Promise<{ inserted: number; fetched: number; errors: number }> {
  const s = await collectAll(80);
  return { inserted: s.inserted, fetched: s.fetched, errors: s.errors.length };
}

export async function stageRewrite(maxClusters = 5): Promise<{ articles: number; flagged: number }> {
  const clusters = clusterUnprocessed(0.55, 200).slice(0, maxClusters);
  let articles = 0, flagged = 0;
  for (const c of clusters) {
    try {
      const out: RewriteOutput = await rewriteCluster({ clusterId: c.clusterId });
      const id = persistArticle(out, c.clusterId);
      articles++; if (out.status === 'flagged') flagged++;
      // also auto-publish drafts (not flagged) so the homepage gets fresh data
      if (out.status === 'draft') {
        rawDb().prepare(`UPDATE articles SET status='published', published_at=? WHERE id=?`).run(Date.now(), id);
      }
    } catch (e) {
      console.warn('[rewrite] cluster failed:', (e as Error).message);
    }
  }
  return { articles, flagged };
}

export async function stageImage(maxArticles = 10): Promise<{ thumbed: number }> {
  getDb();
  const rows = rawDb().prepare(`
    SELECT id, title, hero_image_url FROM articles
    WHERE thumbnail_url IS NULL AND status IN ('published','draft','flagged') LIMIT ?
  `).all(maxArticles) as Array<{ id: number; title: string; hero_image_url: string | null }>;
  let thumbed = 0;
  for (const r of rows) {
    try {
      const source = r.hero_image_url ?? Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="100%" height="100%" fill="#0e1a2b"/></svg>'
      , 'utf8');
      const t = await buildNewsThumbnail(source, { title: r.title, watermark: 'PencilerKali.com' });
      rawDb().prepare(`UPDATE articles SET thumbnail_url=?, og_image_url=? WHERE id=?`)
        .run(t.publicUrl, t.publicUrl, r.id);
      thumbed++;
    } catch (e) {
      console.warn('[image] failed for article', r.id, (e as Error).message);
    }
  }
  return { thumbed };
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
    SELECT a.id, a.slug, a.title, a.fb_caption, a.thumbnail_url
    FROM articles a
    LEFT JOIN posts p ON p.article_id = a.id AND p.channel='facebook' AND p.status IN ('success','dry_run')
    WHERE a.status='published' AND p.id IS NULL
    ORDER BY a.published_at DESC LIMIT ?
  `).all(max) as Array<{ id: number; slug: string; title: string; fb_caption: string | null; thumbnail_url: string | null }>;
  let posted = 0;
  for (const r of rows) {
    const result = await postToPage({
      articleId: r.id,
      message: r.fb_caption ?? r.title,
      link: `${process.env.WEB_PUBLIC_URL ?? 'https://pencilerkali.com'}/article/${r.slug}`,
      imageUrl: r.thumbnail_url ?? undefined,
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
