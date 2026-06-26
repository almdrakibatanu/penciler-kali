import webpush from 'web-push';
import { rawDb } from '@pk/db';

// Self-hosted Web Push (VAPID) — no SaaS. Browsers that opt in are stored in the
// push_subscriptions table; on publish we send each one a notification through
// its push service (FCM/Mozilla/Apple). Entirely free.
//
// Disabled until VAPID keys are set, like every other integration here. Generate
// a keypair once with:  node -e "console.log(require('web-push').generateVAPIDKeys())"
// then put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env.
//
// Rate limiting: PUSH_DAILY_CAP (default 8) caps total notifications per BD calendar
// day; PUSH_MIN_GAP_MS (default 30 min) enforces a minimum gap between any two sends.
// Both are tracked in app_meta so they survive restarts. Without this Chrome's
// Safe Browsing flags the site as abusive when the cron fires many articles per hour.

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:contact@pencilerkali.com';

const PUSH_DAILY_CAP = Number(process.env.PUSH_DAILY_CAP ?? 8);
const PUSH_MIN_GAP_MS = Number(process.env.PUSH_MIN_GAP_MS ?? 30 * 60 * 1000);

// BD calendar date string for the daily cap key.
function bdDateKey(): string {
  const bdMs = Date.now() + 6 * 60 * 60 * 1000;
  const d = new Date(bdMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function readMeta(key: string): string | null {
  try {
    const row = rawDb().prepare(`SELECT value FROM app_meta WHERE key=?`).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch { return null; }
}

function writeMeta(key: string, value: string): void {
  try {
    rawDb().prepare(
      `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    ).run(key, value, Date.now());
  } catch { /* never let tracking break a send */ }
}

function canSendPush(): boolean {
  const count = Number(readMeta(`push_daily:${bdDateKey()}`) ?? '0');
  if (count >= PUSH_DAILY_CAP) {
    console.log(`[push] daily cap ${PUSH_DAILY_CAP} reached — skipping`);
    return false;
  }
  const lastAt = Number(readMeta('push_last_at') ?? '0');
  const wait = PUSH_MIN_GAP_MS - (Date.now() - lastAt);
  if (wait > 0) {
    console.log(`[push] min-gap not met — ${Math.ceil(wait / 60000)}m remaining`);
    return false;
  }
  return true;
}

function recordPushSent(): void {
  const dateKey = `push_daily:${bdDateKey()}`;
  writeMeta(dateKey, String(Number(readMeta(dateKey) ?? '0') + 1));
  writeMeta('push_last_at', String(Date.now()));
}

let configured = false;
export function pushEnabled(): boolean {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export function getPublicKey(): string {
  return PUBLIC_KEY;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function saveSubscription(sub: PushSubscriptionJSON): void {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('invalid subscription');
  rawDb()
    .prepare(`INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)`)
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, Date.now());
}

export function removeSubscription(endpoint: string): void {
  rawDb().prepare(`DELETE FROM push_subscriptions WHERE endpoint=?`).run(endpoint);
}

interface PushPayload {
  title: string;
  body?: string;
  url: string;
  icon?: string;
}

// Send one notification to every subscriber. Dead subscriptions (404/410) are
// pruned so the table self-cleans. Never throws — failures are logged.
// Silently no-ops if the daily cap or minimum gap has been reached.
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!pushEnabled()) return { sent: 0, pruned: 0 };
  if (!canSendPush()) return { sent: 0, pruned: 0 };
  const subs = rawDb()
    .prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions`)
    .all() as Array<{ endpoint: string; p256dh: string; auth: string }>;
  if (!subs.length) return { sent: 0, pruned: 0 };

  const data = JSON.stringify(payload);
  let sent = 0, pruned = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        sent++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          removeSubscription(s.endpoint); // gone — drop it
          pruned++;
        } else {
          console.warn('[push] send failed:', code ?? (e as Error).message);
        }
      }
    }),
  );
  if (sent > 0) recordPushSent();
  return { sent, pruned };
}
