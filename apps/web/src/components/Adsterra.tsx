import Script from 'next/script';

// Adsterra ad units. On by default everywhere; set NEXT_PUBLIC_ADS_ENABLED=false
// to turn them off (e.g. in local dev). Rendered from the root layout so every
// page gets them.
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false';

// Popunder + Social Bar are intentionally DISABLED (too intrusive: the popunder
// hijacks any click, the social bar is a sticky overlay). Only the contained
// native banner below is used. Don't re-add them without a deliberate decision.

// Native Banner — renders inline wherever it's placed; the invoke script fills
// the container div below it. Keep a single instance per page (unique div id).
export function AdsterraNativeBanner({ className = '' }: { className?: string }) {
  if (!ADS_ENABLED) return null;
  return (
    <div className={`max-w-6xl mx-auto px-4 my-6 ${className}`}>
      <Script
        id="adsterra-native-banner"
        strategy="afterInteractive"
        data-cfasync="false"
        src="https://pl29657550.effectivecpmnetwork.com/ef24112600981c7db083eb681fee8618/invoke.js"
      />
      <div id="container-ef24112600981c7db083eb681fee8618" />
    </div>
  );
}

// iframe Banners (highperformanceformat.com). These set a GLOBAL `atOptions` and
// then load invoke.js which reads it — so two on the same page would clobber
// each other. We isolate each banner inside its own srcDoc iframe, giving every
// instance a private global scope. Safe to render multiple banners (and multiple
// sizes) on one page.
export type BannerSize = '728x90' | '468x60' | '320x50' | '300x250' | '160x600' | '160x300';

const BANNERS: Record<BannerSize, { key: string; w: number; h: number }> = {
  '728x90':  { key: '5a70c8b8c2ac0e3e9c5fde9311142c44', w: 728, h: 90 },
  '468x60':  { key: 'd8b0648080d07b13eed5bc2f0b29e76e', w: 468, h: 60 },
  '320x50':  { key: '37b1be11c64b6f3ad0bf07d7c92df7e3', w: 320, h: 50 },
  '300x250': { key: '1cc7cfc7039e511bd6194800ce686e2a', w: 300, h: 250 },
  '160x600': { key: '13ddeab881b32d79484d2ad49a03fe76', w: 160, h: 600 },
  '160x300': { key: 'b19910935789a3a8b0b8bb83831a2335', w: 160, h: 300 },
};

function bannerSrcDoc(key: string, w: number, h: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;display:flex;justify-content:center;align-items:center;background:transparent}</style></head><body><script type="text/javascript">atOptions={'key':'${key}','format':'iframe','height':${h},'width':${w},'params':{}};<\/script><script type="text/javascript" src="https://www.highperformanceformat.com/${key}/invoke.js"><\/script></body></html>`;
}

export function AdsterraBanner({ size, className = '' }: { size: BannerSize; className?: string }) {
  if (!ADS_ENABLED) return null;
  const b = BANNERS[size];
  return (
    <iframe
      srcDoc={bannerSrcDoc(b.key, b.w, b.h)}
      width={b.w}
      height={b.h}
      scrolling="no"
      title="advertisement"
      className={className}
      style={{ border: 0, overflow: 'hidden', maxWidth: '100%' }}
    />
  );
}
