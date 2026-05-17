import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// ----------------------------------------------------------------------------
// Sources — RSS feeds, Facebook pages, YouTube channels that feed the system.
// ----------------------------------------------------------------------------
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['rss', 'html', 'facebook', 'youtube'] }).notNull(),
  url: text('url').notNull(),
  category: text('category').notNull(),
  lang: text('lang').default('bn').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// ----------------------------------------------------------------------------
// Raw items — what came out of the collector before any AI processing.
// ----------------------------------------------------------------------------
export const rawItems = sqliteTable('raw_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  externalId: text('external_id'),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  summary: text('summary'),
  html: text('html'),
  imageUrl: text('image_url'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  contentHash: text('content_hash'),
  minhash: text('minhash'),
  clusterId: text('cluster_id'),
  status: text('status', { enum: ['new', 'clustered', 'rewritten', 'skipped'] }).default('new').notNull(),
}, (t) => ({
  clusterIdx: index('raw_cluster_idx').on(t.clusterId),
  statusIdx: index('raw_status_idx').on(t.status),
}));

// ----------------------------------------------------------------------------
// Articles — final, AI-rewritten, publish-ready stories.
// ----------------------------------------------------------------------------
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  body: text('body').notNull(),
  summary: text('summary'),
  category: text('category').notNull(),
  tags: text('tags'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  fbCaption: text('fb_caption'),
  heroImageUrl: text('hero_image_url'),
  heroImagePath: text('hero_image_path'),
  thumbnailUrl: text('thumbnail_url'),
  ogImageUrl: text('og_image_url'),
  sourceUrls: text('source_urls'),
  status: text('status', { enum: ['draft', 'published', 'archived', 'flagged'] }).default('draft').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  views: integer('views').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (t) => ({
  categoryIdx: index('articles_category_idx').on(t.category),
  statusIdx: index('articles_status_idx').on(t.status),
  publishedIdx: index('articles_published_idx').on(t.publishedAt),
}));

// ----------------------------------------------------------------------------
// Videos — generated explainer videos, linked back to articles.
// ----------------------------------------------------------------------------
export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').references(() => articles.id),
  title: text('title').notNull(),
  script: text('script').notNull(),
  voiceFile: text('voice_file'),
  videoFile: text('video_file'),
  duration: real('duration'),
  category: text('category').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  youtubeId: text('youtube_id'),
  facebookId: text('facebook_id'),
  status: text('status', { enum: ['draft', 'rendering', 'ready', 'uploaded', 'failed'] }).default('draft').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// ----------------------------------------------------------------------------
// Jobs — durable queue rows backing pencil-queue.
// ----------------------------------------------------------------------------
export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queue: text('queue').notNull(),
  payload: text('payload').notNull(),
  status: text('status', { enum: ['pending', 'active', 'done', 'failed', 'delayed'] }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  runAt: integer('run_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  lockedAt: integer('locked_at', { mode: 'timestamp' }),
  lockedBy: text('locked_by'),
  lastError: text('last_error'),
  result: text('result'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (t) => ({
  queueStatusIdx: index('jobs_queue_status_idx').on(t.queue, t.status, t.runAt),
}));

// ----------------------------------------------------------------------------
// Posts — record of every publish attempt (FB / YT) for the dashboard.
// ----------------------------------------------------------------------------
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  channel: text('channel', { enum: ['facebook', 'youtube', 'web'] }).notNull(),
  articleId: integer('article_id').references(() => articles.id),
  videoId: integer('video_id').references(() => videos.id),
  externalId: text('external_id'),
  url: text('url'),
  status: text('status', { enum: ['pending', 'success', 'failed', 'dry_run'] }).notNull(),
  message: text('message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// ----------------------------------------------------------------------------
// Assets — every file pencil-cloud knows about (images, audio, video).
// ----------------------------------------------------------------------------
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['image', 'audio', 'video'] }).notNull(),
  storage: text('storage', { enum: ['local', 's3'] }).notNull(),
  path: text('path').notNull(),
  publicUrl: text('public_url').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  durationMs: integer('duration_ms'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
