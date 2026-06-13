'use client';

import { useEffect, useState } from 'react';

// VAPID public keys are base64url; the PushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'hidden' | 'idle' | 'working' | 'done';

// A small "subscribe to notifications" bell. Renders nothing unless the browser
// supports push AND the server has VAPID keys configured AND the user hasn't
// already subscribed — so it quietly disappears once you've opted in.
export function PushSubscribe() {
  const [state, setState] = useState<State>('hidden');
  const [publicKey, setPublicKey] = useState('');

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    if (!supported) return;

    (async () => {
      try {
        const r = await fetch('/api/push/key', { cache: 'no-store' });
        const { enabled, publicKey } = await r.json();
        if (!enabled || !publicKey) return; // server has no VAPID keys → stay hidden
        setPublicKey(publicKey);
        // Already subscribed? Then don't nag.
        const reg = await navigator.serviceWorker.getRegistration();
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        if (existing || Notification.permission === 'denied') return;
        setState('idle');
      } catch {
        /* stay hidden on any error */
      }
    })();
  }, []);

  async function subscribe() {
    setState('working');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState('idle'); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setState('done');
    } catch {
      setState('idle');
    }
  }

  if (state === 'hidden') return null;
  if (state === 'done') {
    return <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">🔔 সাবস্ক্রাইব হয়েছে</span>;
  }
  return (
    <button
      onClick={subscribe}
      disabled={state === 'working'}
      className="inline-flex items-center gap-1.5 rounded-md border border-brand-600 text-brand-700 px-3 py-1.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60 whitespace-nowrap"
      title="নতুন সংবাদের নোটিফিকেশন পান"
    >
      🔔 <span className="hidden sm:inline">{state === 'working' ? 'অপেক্ষা করুন…' : 'খবর পান'}</span>
    </button>
  );
}
