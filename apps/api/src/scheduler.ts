import cron from 'node-cron';
import { stageCollect, stageRewrite, stageImage, stageVideo, stagePublishFb, stagePublishYt } from './pipeline.js';

// ----------------------------------------------------------------------------
// Scheduler — chains the stages on a cron grid. Each stage is wrapped in a
// per-tick mutex (no overlap with itself). Crons are configurable via .env.
// ----------------------------------------------------------------------------

type Logger = { info: (o: object | string, msg?: string) => void; warn: (o: object | string, msg?: string) => void; error: (o: object | string, msg?: string) => void };

function once<T extends (...args: any[]) => Promise<unknown>>(fn: T, name: string, log: Logger): T {
  let running = false;
  return ((...args: any[]) => {
    if (running) { log.warn(`[skip] ${name} still running`); return; }
    running = true;
    return fn(...args)
      .then((r) => { log.info({ stage: name, result: r }, `[ok] ${name}`); return r; })
      .catch((e) => { log.error({ stage: name, err: (e as Error).message }, `[fail] ${name}`); })
      .finally(() => { running = false; });
  }) as T;
}

export function startScheduler(log: Logger): void {
  const c = {
    collect: process.env.COLLECT_CRON ?? '*/10 * * * *',
    rewrite: process.env.REWRITE_CRON ?? '*/15 * * * *',
    image:   process.env.IMAGE_CRON   ?? '*/20 * * * *',
    video:   process.env.VIDEO_CRON   ?? '*/30 * * * *',
    fb:      process.env.PUBLISH_CRON ?? '0 */1 * * *',
    yt:      process.env.PUBLISH_YT_CRON ?? '15 */2 * * *',
  };
  const safe = (name: string, fn: () => Promise<unknown>) => cron.schedule(c[name as keyof typeof c], once(fn as any, name, log));

  safe('collect', () => stageCollect());
  safe('rewrite', () => stageRewrite());
  safe('image',   () => stageImage(Number(process.env.IMAGE_MAX ?? 40)));
  safe('video',   () => stageVideo(2));
  safe('fb',      () => stagePublishFb(5));
  safe('yt',      () => stagePublishYt(2));

  log.info({ crons: c }, 'scheduler started');
}
