'use client';

import { useState } from 'react';

// Social share row for an article. Facebook/WhatsApp/Telegram/X open the native
// share intents in a new tab; "Copy" uses the clipboard. URL + title come from
// the server (the canonical article URL), so no window access is needed.
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const links: Array<{ label: string; href: string; cls: string }> = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, cls: 'bg-[#1877f2]' },
    { label: 'WhatsApp', href: `https://api.whatsapp.com/send?text=${t}%20${u}`, cls: 'bg-[#25d366]' },
    { label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}`, cls: 'bg-[#0088cc]' },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, cls: 'bg-black' },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 my-5">
      <span className="text-sm font-semibold text-ink-700 mr-1">শেয়ার করুন:</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${l.cls} text-white text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90`}
        >
          {l.label}
        </a>
      ))}
      <button
        onClick={copy}
        className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 text-ink-700 hover:bg-slate-100"
      >
        {copied ? '✓ কপি হয়েছে' : 'লিংক কপি'}
      </button>
    </div>
  );
}
