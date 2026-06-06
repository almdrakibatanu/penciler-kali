import Script from 'next/script';

// Adsterra ad units. On by default everywhere; set NEXT_PUBLIC_ADS_ENABLED=false
// to turn them off (e.g. in local dev). Rendered from the root layout so every
// page gets them.
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false';

// Popunder (one per page) + Social Bar — placement-agnostic global scripts.
// Rendered once in the root layout so they fire on every page load.
export function AdsterraGlobal() {
  if (!ADS_ENABLED) return null;
  return (
    <>
      {/* Popunder — one per page */}
      <Script
        id="adsterra-popunder"
        strategy="afterInteractive"
        src="https://pl29657549.effectivecpmnetwork.com/18/4d/2d/184d2d164d87ea9fcf06b3fd3c64eaad.js"
      />
      {/* Social Bar */}
      <Script
        id="adsterra-social-bar"
        strategy="afterInteractive"
        src="https://pl29657551.effectivecpmnetwork.com/51/94/39/519439b4ff08cb58751a09c3d32bcebb.js"
      />
    </>
  );
}

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
