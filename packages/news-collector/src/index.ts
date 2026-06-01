import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { rawDb, getDb } from '@pk/db';
import { DEFAULT_SOURCES, type SourceDef } from './sources.js';

export { DEFAULT_SOURCES };
export type { SourceDef };

// ----------------------------------------------------------------------------
// news-collector — pulls items from RSS / HTML / YouTube-Atom feeds and writes
// to the raw_items table. Idempotent on URL.
// ----------------------------------------------------------------------------

const rss = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure', 'content:encoded', 'description'],
  },
  timeout: 15_000,
  headers: { 'User-Agent': 'PencilerKaliBot/1.0 (+https://pencilerkali.com)' },
});

// Sync the DB sources table with DEFAULT_SOURCES: insert new feeds, refresh
// metadata, and disable any feed no longer in the registry (dead/removed).
// Relies on the UNIQUE index on sources.url (added by initSchema) for dedupe.
export function seedSources(): number {
  getDb();
  const db = rawDb();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO sources (name, kind, url, category, lang, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const upd = db.prepare(`UPDATE sources SET name=?, kind=?, category=?, lang=?, enabled=? WHERE url=?`);
  const now = Date.now();
  let count = 0;
  const sync = db.transaction(() => {
    for (const s of DEFAULT_SOURCES) {
      const enabled = s.enabled === false ? 0 : 1;
      const r = ins.run(s.name, s.kind, s.url, s.category, s.lang, enabled, now);
      if (r.changes > 0) count++;
      upd.run(s.name, s.kind, s.category, s.lang, enabled, s.url); // keep metadata fresh
    }
    // Disable any source whose url is no longer in the registry (dead feeds).
    const urls = DEFAULT_SOURCES.map((s) => s.url);
    const placeholders = urls.map(() => '?').join(',');
    db.prepare(`UPDATE sources SET enabled=0 WHERE url NOT IN (${placeholders})`).run(...urls);
  });
  sync();
  return count;
}

export interface CollectStats {
  fetched: number;
  inserted: number;
  errors: Array<{ source: string; error: string }>;
}

export async function collectAll(limit = 50): Promise<CollectStats> {
  getDb();
  const sources = rawDb().prepare(`SELECT * FROM sources WHERE enabled=1`).all() as Array<{
    id: number; name: string; kind: string; url: string; category: string; lang: string;
  }>;
  const stats: CollectStats = { fetched: 0, inserted: 0, errors: [] };
  await Promise.all(sources.map(async (src) => {
    try {
      const items = await fetchSource(src.kind as SourceDef['kind'], src.url);
      stats.fetched += items.length;
      stats.inserted += saveItems(src.id, src.category, items.slice(0, limit));
      rawDb().prepare(`UPDATE sources SET last_fetched_at=? WHERE id=?`).run(Date.now(), src.id);
    } catch (e) {
      stats.errors.push({ source: src.name, error: (e as Error).message });
    }
  }));
  return stats;
}

export interface ParsedItem {
  title: string;
  url: string;
  externalId?: string;
  summary?: string;
  html?: string;
  imageUrl?: string;
  publishedAt?: Date;
}

export async function fetchSource(kind: SourceDef['kind'], url: string): Promise<ParsedItem[]> {
  if (kind === 'rss' || kind === 'youtube') return fetchRss(url);
  if (kind === 'html') return fetchHtml(url);
  if (kind === 'facebook') return []; // requires Graph API; handled in publisher-fb
  return [];
}

async function fetchRss(url: string): Promise<ParsedItem[]> {
  const feed = await rss.parseURL(url);
  return (feed.items ?? []).map((it) => {
    const html = (it['content:encoded'] as string | undefined) ?? it.content ?? it.contentSnippet ?? it.summary ?? '';
    const image = extractImage(it, html);
    return {
      title: (it.title ?? '').trim() || '(untitled)',
      url: (it.link ?? it.guid ?? '').trim(),
      externalId: it.guid ?? undefined,
      summary: (it.contentSnippet ?? it.content ?? '').slice(0, 600),
      html,
      imageUrl: image,
      publishedAt: it.isoDate ? new Date(it.isoDate) : (it.pubDate ? new Date(it.pubDate) : undefined),
    };
  }).filter((i) => i.url);
}

function extractImage(it: any, html: string): string | undefined {
  if (it.enclosure?.url) return it.enclosure.url;
  const mc = it['media:content']; if (mc?.$?.url) return mc.$.url;
  const mt = it['media:thumbnail']; if (mt?.$?.url) return mt.$.url;
  // image inside content:encoded
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html ?? '');
  return m ? m[1] : undefined;
}

async function fetchHtml(url: string): Promise<ParsedItem[]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'PencilerKaliBot/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const $ = cheerio.load(await res.text());
  const items: ParsedItem[] = [];
  // Heuristic: collect <article> and <a> linking to /news/ paths
  $('article a, .news-item a, .card a, .headline a').each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().trim();
    if (!href || !title || title.length < 12) return;
    const abs = new URL(href, url).toString();
    items.push({ title, url: abs });
  });
  return items;
}

function saveItems(sourceId: number, _category: string, items: ParsedItem[]): number {
  const db = rawDb();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO raw_items
      (source_id, external_id, title, url, summary, html, image_url, published_at, fetched_at, content_hash, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `);
  const now = Date.now();
  const tx = db.transaction((list: ParsedItem[]) => {
    let inserted = 0;
    for (const it of list) {
      const hash = createHash('sha1').update((it.title ?? '') + '|' + (it.summary ?? '')).digest('hex');
      const r = ins.run(
        sourceId,
        it.externalId ?? null,
        it.title,
        it.url,
        it.summary ?? null,
        it.html ?? null,
        it.imageUrl ?? null,
        it.publishedAt ? it.publishedAt.getTime() : null,
        now,
        hash,
      );
      if (r.changes > 0) inserted++;
    }
    return inserted;
  });
  return tx(items);
}
