import { rawDb, getDb } from './index.js';

// Bootstrap script: creates all tables idempotently from raw DDL so the
// project runs without drizzle-kit migrations. Mirrors schema.ts.
const DDL = [
  `CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'bn',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_fetched_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS raw_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    external_id TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    summary TEXT,
    html TEXT,
    image_url TEXT,
    published_at INTEGER,
    fetched_at INTEGER NOT NULL,
    content_hash TEXT,
    minhash TEXT,
    cluster_id TEXT,
    status TEXT NOT NULL DEFAULT 'new'
  )`,
  `CREATE INDEX IF NOT EXISTS raw_cluster_idx ON raw_items(cluster_id)`,
  `CREATE INDEX IF NOT EXISTS raw_status_idx ON raw_items(status)`,
  `CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    body TEXT NOT NULL,
    summary TEXT,
    category TEXT NOT NULL,
    tags TEXT,
    seo_title TEXT,
    seo_description TEXT,
    fb_caption TEXT,
    hero_image_url TEXT,
    hero_image_path TEXT,
    thumbnail_url TEXT,
    og_image_url TEXT,
    source_urls TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at INTEGER,
    views INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category)`,
  `CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status)`,
  `CREATE INDEX IF NOT EXISTS articles_published_idx ON articles(published_at)`,
  `CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER REFERENCES articles(id),
    title TEXT NOT NULL,
    script TEXT NOT NULL,
    voice_file TEXT,
    video_file TEXT,
    duration REAL,
    category TEXT NOT NULL,
    thumbnail_url TEXT,
    youtube_id TEXT,
    facebook_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    run_at INTEGER NOT NULL,
    locked_at INTEGER,
    locked_by TEXT,
    last_error TEXT,
    result TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS jobs_queue_status_idx ON jobs(queue, status, run_at)`,
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    article_id INTEGER REFERENCES articles(id),
    video_id INTEGER REFERENCES videos(id),
    external_id TEXT,
    url TEXT,
    status TEXT NOT NULL,
    message TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    storage TEXT NOT NULL,
    path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`,
  // Generic key/value store — used for the cross-process Gemini usage counter.
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

export function initSchema(): void {
  getDb();
  const sqlite = rawDb();
  const tx = sqlite.transaction(() => {
    for (const stmt of DDL) sqlite.exec(stmt);
  });
  tx();
  ensureSourceUrlUnique(sqlite);
}

// One-time migration: the sources table originally had no UNIQUE on url, so
// re-running the seeder created duplicate source rows (and double-fetched every
// feed). De-duplicate existing rows — repointing raw_items to the canonical
// (lowest-id) source per url — then add a UNIQUE index so INSERT OR IGNORE in
// the seeder actually dedupes from now on. Guarded so it runs only once.
function ensureSourceUrlUnique(sqlite: ReturnType<typeof rawDb>): void {
  const exists = sqlite.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='index' AND name='sources_url_unique'`
  ).get();
  if (exists) return;
  const migrate = sqlite.transaction(() => {
    // Repoint raw_items to the surviving (min-id) source sharing the same url.
    sqlite.exec(`
      UPDATE raw_items SET source_id = (
        SELECT MIN(s2.id) FROM sources s2
        WHERE s2.url = (SELECT s1.url FROM sources s1 WHERE s1.id = raw_items.source_id)
      )
      WHERE source_id IS NOT NULL
    `);
    // Drop duplicate source rows, keeping the lowest id per url.
    sqlite.exec(`DELETE FROM sources WHERE id NOT IN (SELECT MIN(id) FROM sources GROUP BY url)`);
    sqlite.exec(`CREATE UNIQUE INDEX sources_url_unique ON sources(url)`);
  });
  migrate();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  initSchema();
  console.log('[db] schema initialized');
}
