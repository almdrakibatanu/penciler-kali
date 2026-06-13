import webpush from 'web-push';
import { rawDb } from '@pk/db';

// Self-hosted Web Push (VAPID) — no SaaS. Browsers that opt in are stored in the
// push_subscriptions table; on publish we send each one a notification through
// its push service (FCM/Mozilla/Apple). Entirely free.
//
// Disabled until VAPID keys are set, like every other integration here. Generate
// a keypair once with:  node -e "console.log(require('web-push').generateVAPIDKeys())"
// then put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env.

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:contact@pencilerkali.com';

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
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!pushEnabled()) return { sent: 0, pruned: 0 };
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
  return { sent, pruned };
}
