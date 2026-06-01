import { rawDb, getDb } from '@pk/db';
import { randomUUID } from 'node:crypto';
import { minhashOf, encodeMinhash, decodeMinhash, jaccard } from './minhash.js';

export { minhashOf, encodeMinhash, decodeMinhash, jaccard };

// ----------------------------------------------------------------------------
// ai-rewriter — the core brain.
//   * cluster raw items by MinHash similarity (≥0.55 Jaccard merges)
//   * for each cluster, ask Claude to produce a publish-ready Bangla article
//     + SEO + FB caption + category tag + thumbnail text
//   * inserts an articles row, marks raw items as 'rewritten'
//
// Prompt cache: the system prompt + editorial policy block are cached via
// Anthropic's prompt caching — saves ~80% on retries / batched calls.
// ----------------------------------------------------------------------------

const CATEGORIES = ['bangladesh', 'bidesh', 'kheladhula', 'binodon', 'islamic'] as const;
type Category = typeof CATEGORIES[number];

interface RawRow {
  id: number; title: string; url: string; summary: string | null; html: string | null;
  image_url: string | null; published_at: number | null; cluster_id: string | null; minhash: string | null;
}

export interface ClusterReport { clusterId: string; itemIds: number[]; sample: string }

export function clusterUnprocessed(threshold = 0.55, batchSize = 200): ClusterReport[] {
  getDb();
  const db = rawDb();
  const rows = db.prepare(
    `SELECT id, title, url, summary, html, image_url, published_at, cluster_id, minhash
     FROM raw_items WHERE status='new' ORDER BY id DESC LIMIT ?`
  ).all(batchSize) as RawRow[];

  // compute or read MinHash
  const sigs: Array<{ row: RawRow; sig: Uint32Array }> = [];
  const updMh = db.prepare(`UPDATE raw_items SET minhash=? WHERE id=?`);
  for (const r of rows) {
    let sig: Uint32Array;
    if (r.minhash) sig = decodeMinhash(r.minhash);
    else {
      sig = minhashOf(`${r.title} ${r.summary ?? ''}`);
      updMh.run(encodeMinhash(sig), r.id);
    }
    sigs.push({ row: r, sig });
  }

  // simple greedy clustering: O(n^2) but n≤batchSize
  const clusters: ClusterReport[] = [];
  const assigned = new Map<number, string>();
  for (let i = 0; i < sigs.length; i++) {
    const a = sigs[i]!;
    if (assigned.has(a.row.id)) continue;
    const clusterId = a.row.cluster_id ?? randomUUID();
    const members = [a.row.id];
    for (let j = i + 1; j < sigs.length; j++) {
      const b = sigs[j]!;
      if (assigned.has(b.row.id)) continue;
      if (jaccard(a.sig, b.sig) >= threshold) {
        members.push(b.row.id);
        assigned.set(b.row.id, clusterId);
      }
    }
    assigned.set(a.row.id, clusterId);
    clusters.push({ clusterId, itemIds: members, sample: a.row.title });
  }

  // persist
  const updCluster = db.prepare(`UPDATE raw_items SET cluster_id=?, status='clustered' WHERE id=?`);
  const tx = db.transaction(() => {
    for (const c of clusters) for (const id of c.itemIds) updCluster.run(c.clusterId, id);
  });
  tx();

  return clusters;
}

// ----------------------------------------------------------------------------

const POLICY_BN = `\
তুমি PencilerKali.com-এর সিনিয়র এডিটর। নিচের নীতিগুলো কঠোরভাবে মানবে:
1. ভাষা: সাধু-চলিত মিশ্রণ বাদ, পরিষ্কার চলিত বাংলা; পরিচ্ছন্ন paragraph; কোনো ভাঙা ইংরেজি না।
2. কপি/হুবহু rephrase করা যাবে না — ১০০% নিজের শব্দে; কোনো লাইন একই থাকা চলবে না।
3. Plagiarism-free; খবরের সারমর্ম + context + ব্যাকগ্রাউন্ড যোগ করো।
4. বাংলাদেশ category তে: শুধুমাত্র উন্নয়নমূলক, ইতিবাচক, পশুপাখি/পরিবেশ, accident reporting (factual, non-graphic) — কোনো রাজনৈতিক উসকানিমূলক কনটেন্ট না। রাজনৈতিক হলে category="politics-review" এবং status="flagged" রাখবে।
5. ইসলামিক category: fair-use summary; কোনো নির্দিষ্ট আলেম/বক্তার দাবি প্রচার নয় — explanation style।
6. কোনো hate-speech, rumor, unverified ব্যক্তিগত অভিযোগ নয়। সন্দেহ হলে status="flagged"।
7. SEO title ≤ 70 অক্ষর, description ≤ 160 অক্ষর; Facebook caption ১-২ লাইন + ৩ relevant hashtag।
8. Hasnat Abdullah / Debidwar কেন্দ্রিক হলে tags-এ "hasnat-abdullah", "debidwar" যুক্ত করবে।`;

interface RewriteInput { clusterId: string; }
export interface RewriteOutput {
  articleId?: number; title: string; slug: string; body: string; summary: string;
  category: Category | 'politics-review'; tags: string[];
  seoTitle: string; seoDescription: string; fbCaption: string;
  thumbnailText: string; status: 'draft' | 'flagged'; sourceUrls: string[];
  imageUrl?: string;
}

type AIResult = Omit<RewriteOutput, 'slug' | 'sourceUrls' | 'imageUrl'>;

export async function rewriteCluster(input: RewriteInput): Promise<RewriteOutput> {
  getDb();
  const db = rawDb();
  const items = db.prepare(
    `SELECT title, url, summary, image_url, published_at FROM raw_items WHERE cluster_id=? ORDER BY id`
  ).all(input.clusterId) as Array<{ title: string; url: string; summary: string | null; image_url: string | null; published_at: number | null }>;
  if (items.length === 0) throw new Error(`cluster ${input.clusterId} is empty`);

  // Gemini is the only AI provider. No key → offline stub (dev/demo mode).
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  let parsed: AIResult;
  if (geminiKey) {
    parsed = await callGemini(geminiKey, geminiModel, items);
  } else {
    parsed = stubRewrite(items);
  }

  const slug = slugify(parsed.title) + '-' + input.clusterId.slice(0, 6);
  const sourceUrls = items.map((i) => i.url);
  const imageUrl = items.find((i) => i.image_url)?.image_url ?? undefined;
  return { ...parsed, slug, sourceUrls, imageUrl };
}

// Shared between providers — the strict JSON output contract.
const SCHEMA_INSTRUCTION = `আউটপুট আবশ্যিকভাবে নিচের JSON schema-এ হবে — কোনো ব্যাখ্যা বা মন্তব্য না, শুধুমাত্র valid JSON:\n{\n  "title": "...","summary": "...","body": "[৫–৮ paragraph বাংলা প্রবন্ধ]","category": "bangladesh|bidesh|kheladhula|binodon|islamic|politics-review","tags": ["..."],"seoTitle":"...","seoDescription":"...","fbCaption":"...","thumbnailText":"...","status":"draft|flagged"\n}`;

function buildSources(items: Array<{ title: string; url: string; summary: string | null }>): string {
  return items.slice(0, 10).map((i, n) => `[${n + 1}] ${i.title}\nURL: ${i.url}\nSUMMARY: ${(i.summary ?? '').slice(0, 400)}`).join('\n\n');
}

function buildUserPrompt(items: Array<unknown>, sources: string): string {
  return `নিচের ${items.length}টি সূত্র থেকে একটি unique বাংলা সংবাদ লেখো:\n\n${sources}`;
}

// ----- Gemini usage tracker --------------------------------------------------
// Lightweight in-process counters so the admin dashboard can show today's
// request count and whether the free-tier limit (429) has been hit. Resets at
// local midnight; also resets if the API process restarts.
export interface GeminiUsage {
  date: string;            // YYYY-M-D (local)
  requests: number;        // Gemini calls attempted today
  errors429: number;       // free-tier quota/rate-limit (429) hits today
  lastError429At: number | null;
  lastErrorMsg: string | null;
}
const _usage: GeminiUsage = { date: '', requests: 0, errors429: 0, lastError429At: null, lastErrorMsg: null };
function _rollUsageDate(): void {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (_usage.date !== key) {
    _usage.date = key; _usage.requests = 0; _usage.errors429 = 0;
    _usage.lastError429At = null; _usage.lastErrorMsg = null;
  }
}
export function getGeminiUsage(): GeminiUsage {
  _rollUsageDate();
  return { ..._usage };
}

// ----- Gemini (preferred) — REST API, no SDK dependency (Node 20 fetch) -------
// Uses responseMimeType=application/json so the model returns clean JSON.
async function callGemini(apiKey: string, model: string, items: Array<{ title: string; url: string; summary: string | null }>): Promise<AIResult> {
  _rollUsageDate();
  _usage.requests++;
  const sources = buildSources(items);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: `${POLICY_BN}\n\n${SCHEMA_INSTRUCTION}` }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(items, sources) }] }],
    // thinkingBudget: 0 disables 2.5-flash's "thinking" pass — faster, fewer tokens.
    generationConfig: { temperature: 0.7, maxOutputTokens: 2200, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
  };
  // Retry transient 503 ("model overloaded") a couple of times with backoff.
  // 429 (quota) is NOT retried — it bubbles up so the caller skips & waits for
  // the next cron tick rather than hammering an exhausted free-tier limit.
  let resp: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (resp.ok || resp.status !== 503) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (!resp || !resp.ok) {
    const errText = resp ? await resp.text().catch(() => '') : '';
    if (resp?.status === 429) {
      _usage.errors429++;
      _usage.lastError429At = Date.now();
      _usage.lastErrorMsg = errText.slice(0, 200);
    }
    throw new Error(`Gemini API ${resp?.status ?? 'no-response'}: ${errText.slice(0, 300)}`);
  }
  const data = await resp.json() as any;
  const text: string = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('');
  if (!text.trim()) throw new Error('Gemini returned empty response: ' + JSON.stringify(data).slice(0, 300));
  return parseJsonStrict(text);
}

function parseJsonStrict(s: string): AIResult {
  // 1) direct parse
  try { return validate(JSON.parse(s)); } catch { /* fallthrough */ }
  // 2) strip markdown code fences (```json … ```)
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fenced && fenced[1]) {
    try { return validate(JSON.parse(fenced[1].trim())); } catch { /* fallthrough */ }
  }
  // 3) find a balanced top-level JSON object by brace counting (handles
  //    embedded { } inside string values too, by tracking string state)
  const start = s.indexOf('{');
  if (start !== -1) {
    let depth = 0, inStr = false, escape = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i]!;
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = s.slice(start, i + 1);
          try { return validate(JSON.parse(candidate)); } catch { /* fallthrough */ }
          break;
        }
      }
    }
  }
  throw new Error('AI response was not valid JSON: ' + s.slice(0, 200));
}

function validate(o: any): AIResult {
  for (const k of ['title', 'summary', 'body', 'category', 'seoTitle', 'seoDescription', 'fbCaption', 'thumbnailText', 'status']) {
    if (typeof o[k] !== 'string') throw new Error(`AI JSON missing string field: ${k}`);
  }
  return {
    title: o.title, summary: o.summary, body: o.body,
    category: o.category, tags: Array.isArray(o.tags) ? o.tags : [],
    seoTitle: o.seoTitle, seoDescription: o.seoDescription, fbCaption: o.fbCaption,
    thumbnailText: o.thumbnailText, status: o.status === 'flagged' ? 'flagged' : 'draft',
  };
}

// Fallback when ANTHROPIC_API_KEY is absent — composes a clean digest from
// the source headlines so the whole pipeline produces visible content during
// development. Output is marked 'draft' so it auto-publishes; the body shows
// the digest plus a disclaimer + source links (no plagiarism risk).
function stubRewrite(items: Array<{ title: string; url: string; summary: string | null }>): AIResult {
  const lead = items[0]!;
  const title = (lead.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
  const intro = lead.summary ? lead.summary.replace(/\s+/g, ' ').trim().slice(0, 320) : title;
  const bullets = items.slice(0, 8).map((it) => `• ${it.title.replace(/\s+/g, ' ').trim()}`).join('\n');
  const body = [
    intro,
    '',
    'প্রধান সংবাদ বিন্দুসমূহ:',
    bullets,
    '',
    `[ডেমো-মোড: ANTHROPIC_API_KEY যোগ করলে এই অংশটি Claude দ্বারা সম্পূর্ণ পুনঃরচিত (plagiarism-free) বাংলা প্রবন্ধে রূপান্তর হবে। এখন এটি headlines-ভিত্তিক সারসংক্ষেপ।]`,
  ].join('\n');
  const category = guessCategory(items.map((i) => i.title).join(' '));
  return {
    title, summary: intro.slice(0, 220), body,
    category, tags: ['auto-digest'],
    seoTitle: title.slice(0, 70),
    seoDescription: intro.slice(0, 160),
    fbCaption: `${title} — PencilerKali.com`,
    thumbnailText: title.slice(0, 60),
    status: 'draft',
  };
}

function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/cricket|football|ipl|bpl|psl|sport|tournament|match|olympics|fifa|টেস্ট|ম্যাচ|খেলা/i.test(t)) return 'kheladhula';
  if (/cinema|film|actress|actor|hollywood|bollywood|music|entertain|বিনোদন|চলচ্চিত্র|গান/i.test(t)) return 'binodon';
  if (/islam|allah|quran|hadith|namaz|prayer|ramadan|eid|mosque|মসজিদ|নামাজ|ইসলাম|হাদিস|কুরআন/i.test(t)) return 'islamic';
  if (/usa|trump|biden|world|global|international|china|russia|europe|israel|gaza|বিশ্ব|আন্তর্জাতিক|যুক্তরাষ্ট্র/i.test(t)) return 'bidesh';
  return 'bangladesh';
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[ঀ-৿]+/g, (m) => banglaTransliterate(m))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'post';
}

const BN_MAP: Record<string, string> = {
  'অ':'a','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou',
  'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'n',
  'ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n',
  'প':'p','ফ':'ph','ব':'b','ভ':'bh','ম':'m','য':'y','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h',
  '়':'','ঃ':'h','ং':'ng','ঁ':'','্':'',
  'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou',
  '়ড':'r','য়':'y',
  '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9',
};
function banglaTransliterate(s: string): string {
  let out = '';
  for (const ch of s) out += BN_MAP[ch] ?? '';
  return out;
}

export function persistArticle(out: RewriteOutput, clusterId: string): number {
  getDb();
  const db = rawDb();
  const now = Date.now();
  const insert = db.prepare(`
    INSERT INTO articles
      (slug, title, body, summary, category, tags, seo_title, seo_description, fb_caption,
       hero_image_url, source_urls, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title, body=excluded.body, summary=excluded.summary,
      seo_title=excluded.seo_title, seo_description=excluded.seo_description,
      fb_caption=excluded.fb_caption, updated_at=excluded.updated_at
    RETURNING id
  `);
  const row = insert.get(
    out.slug, out.title, out.body, out.summary, out.category,
    JSON.stringify(out.tags), out.seoTitle, out.seoDescription, out.fbCaption,
    out.imageUrl ?? null, JSON.stringify(out.sourceUrls),
    out.status, now, now,
  ) as { id: number };

  db.prepare(`UPDATE raw_items SET status='rewritten' WHERE cluster_id=?`).run(clusterId);
  return row.id;
}
