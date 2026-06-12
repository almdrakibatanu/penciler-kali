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
