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

// 468x60 iframe Banner. Adsterra's iframe banners set a GLOBAL `atOptions` and
// then load invoke.js which reads it — so two on the same page would clobber
// each other. We isolate each banner inside its own srcDoc iframe, giving every
// instance a private global scope. Safe to render multiple times per page.
const BANNER_KEY = 'd8b0648080d07b13eed5bc2f0b29e76e';
const BANNER_SRCDOC = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;display:flex;justify-content:center;align-items:center;background:transparent}</style></head><body><script type="text/javascript">atOptions={'key':'${BANNER_KEY}','format':'iframe','height':60,'width':468,'params':{}};<\/script><script type="text/javascript" src="https://www.highperformanceformat.com/${BANNER_KEY}/invoke.js"><\/script></body></html>`;

export function AdsterraBanner({ className = '' }: { className?: string }) {
  if (!ADS_ENABLED) return null;
  return (
    <div className={`flex justify-center my-6 ${className}`}>
      <iframe
        srcDoc={BANNER_SRCDOC}
        width={468}
        height={60}
        scrolling="no"
        title="advertisement"
        className="max-w-full"
        style={{ border: 0, overflow: 'hidden' }}
      />
    </div>
  );
}
