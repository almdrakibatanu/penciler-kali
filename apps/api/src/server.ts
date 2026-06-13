import './_root.js';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, resolve } from 'node:path';
import { rawDb, getDb } from '@pk/db';
import { initSchema } from '@pk/db/init';
import { configure as configureCloud, getAsset, renderTransform, verifyTransform } from '@pk/pencil-cloud';
import { queueStats } from '@pk/pencil-queue';
import { getGeminiUsage, getGroqUsage, geminiKeys, getEngineStats } from '@pk/ai-rewriter';
import { startScheduler } from './scheduler.js';
import { pushEnabled, getPublicKey, saveSubscription, removeSubscription, type PushSubscriptionJSON } from './push.js';

// ----------------------------------------------------------------------------
// Backend API server.
//   * REST endpoints for the Next.js frontend (articles, categories, search)
//   * /cdn/* — Cloudinary-style image transform endpoint (signed)
//   * /admin/* — pipeline triggers + queue/post stats
//   * starts the cron scheduler when API_AUTO_SCHEDULER!=false
// ----------------------------------------------------------------------------

initSchema();
configureCloud();

// maxParamLength: signed-URL tokens can encode base64 titles ~300+ chars.
const app = Fastify({ logger: { level: 'info' }, routerOptions: { maxParamLength: 4096 } } as any);
await app.register(cors, { origin: true });
await app.register(fastifyStatic, {
  root: resolve(process.cwd(), 'storage'),
  prefix: '/storage/',
});

// ----- public routes -------------------------------------------------------

app.get('/api/health', async () => ({ ok: true, time: Date.now() }));

app.get('/api/categories', async () => ([
  { slug: 'bangladesh', name: 'বাংলাদেশ' },
  { slug: 'bidesh',     name: 'বিদেশ' },
  { slug: 'kheladhula', name: 'খেলাধুলা' },
  { slug: 'binodon',    name: 'বিনোদন' },
  { slug: 'islamic',    name: 'ইসলামিক' },
]));

app.get('/api/articles', async (req) => {
  const q = req.query as { category?: string; limit?: string; offset?: string; q?: string; sort?: string };
  const limit = Math.min(60, Math.max(1, Number(q.limit ?? 20)));
  const offset = Math.max(0, Number(q.offset ?? 0));
  let sql = `SELECT id, slug, title, summary, category, tags, hero_image_url, thumbnail_url, published_at, created_at, views
             FROM articles WHERE status='published'`;
  const params: unknown[] = [];
  if (q.category) { sql += ` AND category=?`; params.push(q.category); }
  if (q.q) {
    // Escape LIKE wildcards so a literal % or _ in the query isn't treated as one.
    const esc = q.q.replace(/[\\%_]/g, '\\$&');
    sql += ` AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')`;
    params.push(`%${esc}%`, `%${esc}%`);
  }
  // sort=views powers the "most read" / trending block; default is newest-first.
  sql += q.sort === 'views'
    ? ` ORDER BY views DESC, COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`
    : ` ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const rows = rawDb().prepare(sql).all(...params);
  return { items: rows, limit, offset };
});

// ----- web push (VAPID) ----------------------------------------------------

app.get('/api/push/key', async () => ({ enabled: pushEnabled(), publicKey: getPublicKey() }));

app.post('/api/push/subscribe', async (req, reply) => {
  try {
    saveSubscription(req.body as PushSubscriptionJSON);
    return { ok: true };
  } catch (e) {
    reply.code(400); return { error: (e as Error).message };
  }
});

app.post('/api/push/unsubscribe', async (req) => {
  const { endpoint } = (req.body ?? {}) as { endpoint?: string };
  if (endpoint) removeSubscription(endpoint);
  return { ok: true };
});

app.get('/api/articles/:slug', async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const row = rawDb().prepare(`SELECT * FROM articles WHERE slug=?`).get(slug);
  if (!row) { reply.code(404); return { error: 'not_found' }; }
  rawDb().prepare(`UPDATE articles SET views=views+1 WHERE slug=?`).run(slug);
  return row;
});

app.get('/api/videos', async () => {
  const rows = rawDb().prepare(`SELECT id, title, category, thumbnail_url, youtube_id, created_at FROM videos WHERE status IN ('ready','uploaded') ORDER BY created_at DESC LIMIT 50`).all();
  return { items: rows };
});

// ----- pencil-cloud CDN ---------------------------------------------------

app.get('/cdn/raw/:filename', async (req, reply) => {
  const { filename } = req.params as { filename: string };
  const id = filename.split('.')[0]!;
  // assets ids are UUIDs — reject anything else (also short-circuits junk lookups).
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) { reply.code(404); return { error: 'not_found' }; }
  const a = getAsset(id);
  if (!a) { reply.code(404); return { error: 'not_found' }; }
  // path is stored with platform separators — normalize for sendFile (which wants forward slashes relative to root).
  return (reply as any).sendFile(a.path.replace(/\\/g, '/'));
});

app.get('/cdn/t/:assetId/:token/:sig', async (req, reply) => {
  const { assetId, token, sig } = req.params as { assetId: string; token: string; sig: string };
  const spec = verifyTransform(assetId, token, sig);
  if (!spec) { reply.code(403); return { error: 'bad_signature' }; }
  try {
    const { buffer, mime } = await renderTransform(assetId, spec);
    reply.header('Content-Type', mime);
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(buffer);
  } catch (e) {
    reply.code(500); return { error: (e as Error).message };
  }
});

// ----- admin --------------------------------------------------------------

app.get('/admin/stats', async () => {
  getDb();
  const counts = {
    raw_items: (rawDb().prepare(`SELECT COUNT(*) as n FROM raw_items`).get() as any).n as number,
    articles:  (rawDb().prepare(`SELECT COUNT(*) as n FROM articles`).get() as any).n as number,
    published: (rawDb().prepare(`SELECT COUNT(*) as n FROM articles WHERE status='published'`).get() as any).n as number,
    videos:    (rawDb().prepare(`SELECT COUNT(*) as n FROM videos`).get() as any).n as number,
    posts:     (rawDb().prepare(`SELECT COUNT(*) as n FROM posts`).get() as any).n as number,
  };

  // AI engines usage snapshot for "did I hit the limit?" at a glance.
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const articlesToday = (rawDb().prepare(`SELECT COUNT(*) as n FROM articles WHERE created_at >= ?`)
    .get(startOfDay.getTime()) as any).n as number;
  const dailyCap = Number(process.env.REWRITE_DAILY_CAP ?? 1200);
  
  const geminiUsage = getGeminiUsage();
  const gemini = {
    keysConfigured: geminiKeys().length,  // how many Gemini API keys are loaded for rotation
    requestsToday: geminiUsage.requests,  // Gemini calls attempted today
    articlesToday,                        // articles actually produced today (robust, DB-based)
    dailyCap,
    remaining: Math.max(0, dailyCap - articlesToday),
    limitHit: geminiUsage.errors429 > 0,  // ⚠️ true if a 429 (quota) happened today
    quotaErrorsToday: geminiUsage.errors429,
    lastQuotaErrorAt: geminiUsage.lastError429At,
    lastQuotaErrorMsg: geminiUsage.lastErrorMsg,
  };

  const groqUsage = getGroqUsage();
  const groq = {
    enabled: !!process.env.GROQ_API_KEY,   // is Groq API key configured?
    requestsToday: groqUsage.requests,     // Groq calls attempted today
    quotaErrorsToday: groqUsage.errors429,
    limitHit: groqUsage.errors429 > 0,     // true if a 429/503 happened today
    lastQuotaErrorAt: groqUsage.lastError429At,
    lastQuotaErrorMsg: groqUsage.lastErrorMsg,
  };

  return { counts, queues: queueStats(), gemini, groq, engines: getEngineStats() };
});

app.post('/admin/articles/:id/publish', async (req) => {
  const { id } = req.params as { id: string };
  rawDb().prepare(`UPDATE articles SET status='published', published_at=COALESCE(published_at, ?) WHERE id=?`).run(Date.now(), Number(id));
  return { ok: true };
});

// ----- boot ---------------------------------------------------------------

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
app.log.info(`PencilerKali API ready on :${port}`);

if ((process.env.API_AUTO_SCHEDULER ?? 'true') === 'true') {
  startScheduler(app.log);
}
