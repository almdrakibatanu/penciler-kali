import './_root.js';
import 'dotenv/config';
import { initSchema } from '@pk/db/init';
import { configure as configureCloud } from '@pk/pencil-cloud';
import { seedSources } from '@pk/news-collector';
import { stageCollect, stageRewrite, stageImage, stageVideo, stagePublishFb, stagePublishYt } from './pipeline.js';
import { queueStats } from '@pk/pencil-queue';

initSchema();
configureCloud();

const [cmd, ...args] = process.argv.slice(2);
const argMap = new Map<string, string>();
for (const a of args) {
  const m = /^--([^=]+)=(.*)$/.exec(a);
  if (m) argMap.set(m[1]!, m[2]!);
}

async function main() {
  switch (cmd) {
    case 'seed':         console.log(`[seed] new sources: ${seedSources()}`); break;
    case 'collect':      console.log(JSON.stringify(await stageCollect(), null, 2)); break;
    case 'rewrite':      console.log(JSON.stringify(await stageRewrite(Number(argMap.get('limit') ?? 5)), null, 2)); break;
    case 'image':        console.log(JSON.stringify(await stageImage(Number(argMap.get('limit') ?? 10)), null, 2)); break;
    case 'video':        console.log(JSON.stringify(await stageVideo(Number(argMap.get('limit') ?? 1)), null, 2)); break;
    case 'publish-fb':   console.log(JSON.stringify(await stagePublishFb(Number(argMap.get('limit') ?? 5)), null, 2)); break;
    case 'publish-yt':   console.log(JSON.stringify(await stagePublishYt(Number(argMap.get('limit') ?? 1)), null, 2)); break;
    case 'queue-stats':  console.log(JSON.stringify(queueStats(), null, 2)); break;
    case 'all': {
      console.log('1/5 collect ...');  console.log(await stageCollect());
      console.log('2/5 rewrite ...');  console.log(await stageRewrite(5));
      console.log('3/5 image   ...');  console.log(await stageImage(10));
      console.log('4/5 video   ...');  console.log(await stageVideo(1));
      console.log('5/5 publish ...');  console.log(await stagePublishFb(5), await stagePublishYt(1));
      break;
    }
    default:
      console.log('usage: tsx src/cli.ts <seed|collect|rewrite|image|video|publish-fb|publish-yt|queue-stats|all>');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
