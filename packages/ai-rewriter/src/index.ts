import Anthropic from '@anthropic-ai/sdk';
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  let parsed: AIResult;
  if (apiKey) {
    parsed = await callClaude(apiKey, model, items);
  } else {
    parsed = stubRewrite(items);
  }

  const slug = slugify(parsed.title) + '-' + input.clusterId.slice(0, 6);
  const sourceUrls = items.map((i) => i.url);
  const imageUrl = items.find((i) => i.image_url)?.image_url ?? undefined;
  return { ...parsed, slug, sourceUrls, imageUrl };
}

async function callClaude(apiKey: string, model: string, items: Array<{ title: string; url: string; summary: string | null; published_at: number | null }>): Promise<AIResult> {
  const client = new Anthropic({ apiKey });
  const sources = items.slice(0, 10).map((i, n) => `[${n + 1}] ${i.title}\nURL: ${i.url}\nSUMMARY: ${(i.summary ?? '').slice(0, 400)}`).join('\n\n');
  // Cache the heavy system prompt — `cache_control` lives on the block.
  const resp = await client.messages.create({
    model,
    max_tokens: 2200,
    system: [
      { type: 'text', text: POLICY_BN, cache_control: { type: 'ephemeral' } } as any,
      { type: 'text', text: `আউটপুট আবশ্যিকভাবে নিচের JSON schema-এ হবে — কোনো ব্যাখ্যা বা মন্তব্য না, শুধুমাত্র valid JSON:\n{\n  "title": "...","summary": "...","body": "[৫–৮ paragraph বাংলা প্রবন্ধ]","category": "bangladesh|bidesh|kheladhula|binodon|islamic|politics-review","tags": ["..."],"seoTitle":"...","seoDescription":"...","fbCaption":"...","thumbnailText":"...","status":"draft|flagged"\n}` } as any,
    ] as any,
    messages: [
      { role: 'user', content: `নিচের ${items.length}টি সূত্র থেকে একটি unique বাংলা সংবাদ লেখো:\n\n${sources}` },
    ],
  });
  const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return parseJsonStrict(text);
}

function parseJsonStrict(s: string): AIResult {
  // try direct
  try { return validate(JSON.parse(s)); } catch { /* fallthrough */ }
  // strip code fences
  const m = /\{[\s\S]*\}/.exec(s);
  if (m) try { return validate(JSON.parse(m[0])); } catch { /* fallthrough */ }
  throw new Error('AI response was not valid JSON');
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
