import './_root.js';
import 'dotenv/config';
import { initSchema } from '@pk/db/init';
import { configure as configureCloud } from '@pk/pencil-cloud';
import { seedSources } from '@pk/news-collector';
import { stageCollect, stageRewrite, stageImage, stagePublishFb } from './pipeline.js';
import { rawDb } from '@pk/db';

initSchema();
configureCloud();

console.log('=== PencilerKali end-to-end demo ===');
console.log('1) seeding sources …');
const added = seedSources();
console.log(`   sources added: ${added}`);

console.log('2) collect from RSS …');
const c = await stageCollect();
console.log('  ', c);

console.log('3) cluster + AI rewrite …');
const r = await stageRewrite(3);
console.log('  ', r);

console.log('4) build thumbnails …');
const i = await stageImage(5);
console.log('  ', i);

console.log('5) Facebook publish (dry-run unless FACEBOOK_DRY_RUN=false) …');
const f = await stagePublishFb(3);
console.log('  ', f);

const counts = {
  raw_items: (rawDb().prepare(`SELECT COUNT(*) as n FROM raw_items`).get() as any).n,
  articles:  (rawDb().prepare(`SELECT COUNT(*) as n FROM articles`).get() as any).n,
  posts:     (rawDb().prepare(`SELECT COUNT(*) as n FROM posts`).get() as any).n,
};
console.log('=== final counts ===');
console.log(counts);
