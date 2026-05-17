import './_root.js';
import 'dotenv/config';
import { initSchema } from '@pk/db/init';
import { configure as configureCloud } from '@pk/pencil-cloud';
import { rawDb, getDb } from '@pk/db';
import { seedSources } from '@pk/news-collector';

initSchema();
configureCloud();
getDb();

const added = seedSources();
console.log(`[seed] sources added: ${added}`);

// Seed a single placeholder "Welcome" article so the site renders on first boot.
const db = rawDb();
const existing = db.prepare(`SELECT COUNT(*) as n FROM articles`).get() as { n: number };
if (existing.n === 0) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO articles
      (slug, title, subtitle, body, summary, category, tags, seo_title, seo_description, fb_caption,
       hero_image_url, status, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
  `).run(
    'welcome-to-pencilerkali',
    'PencilerKali.com — শুরু হয়ে গেলো বাংলাদেশের নতুন AI সংবাদ পোর্টাল',
    'বাংলায় AI-চালিত স্বয়ংক্রিয় সংবাদ, ভিডিও ও বিশ্লেষণ',
    `PencilerKali.com একটি সম্পূর্ণ স্বয়ংক্রিয় বাংলা সংবাদ প্ল্যাটফর্ম, যা প্রতি ১০ মিনিটে দেশ-বিদেশ থেকে গুরুত্বপূর্ণ খবর সংগ্রহ করে, AI ব্যবহার করে নিজস্ব ভাষায় পুনঃরচনা করে এবং পাঠকের জন্য পরিচ্ছন্ন, নির্ভরযোগ্য আকারে প্রকাশ করে।\n\nএই সিস্টেম শুধুমাত্র খবর সংগ্রহ নয়, প্রতিটি গল্পের জন্য থাম্বনেইল, ব্যাখ্যামূলক ভিডিও এবং সামাজিক মাধ্যমে স্বয়ংক্রিয় প্রকাশনার ব্যবস্থা করে।`,
    'PencilerKali.com — AI-চালিত বাংলা সংবাদের সম্পূর্ণ স্বয়ংক্রিয় প্ল্যাটফর্ম, প্রতি ১০ মিনিটে আপডেট।',
    'bangladesh',
    JSON.stringify(['announcement', 'welcome']),
    'PencilerKali.com — বাংলাদেশের প্রথম AI সংবাদ প্ল্যাটফর্ম',
    'AI-চালিত বাংলা সংবাদ, ভিডিও ও বিশ্লেষণ — প্রতি ১০ মিনিটে আপডেট হচ্ছে।',
    'PencilerKali.com শুরু হয়ে গেলো — AI-চালিত বাংলা সংবাদের নতুন যুগ! 🇧🇩 #PencilerKali #BanglaNews',
    null,
    now, now, now,
  );
  console.log('[seed] welcome article inserted');
}
console.log('[seed] done');
