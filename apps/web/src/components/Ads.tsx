import { AdsterraNativeBanner, AdsterraBanner, type BannerSize } from './Adsterra';

// All ad slots skip the Islamic section entirely (pass category='islamic' or the
// article's category). The intrusive Popunder + Social Bar formats stay disabled
// site-wide (see Adsterra.tsx) — these are all contained iframe banners.

// Native banner — keep at the bottom of a page.
export function Ads({ category }: { category?: string }) {
  if (category === 'islamic') return null;
  return <AdsterraNativeBanner />;
}

// Top-of-page leaderboard: 728x90 on desktop, 320x50 on phones (one shows at a
// time via responsive visibility).
export function TopBanner({ category }: { category?: string }) {
  if (category === 'islamic') return null;
  return (
    <div className="flex justify-center my-4">
      <AdsterraBanner size="728x90" className="hidden md:block" />
      <AdsterraBanner size="320x50" className="block md:hidden" />
    </div>
  );
}

// Inline rectangle for use inside content (between sections, mid-article, in a
// sidebar). 300x250 and 468x60 work on mobile too.
export function InlineAd({ category, size = '300x250' }: { category?: string; size?: BannerSize }) {
  if (category === 'islamic') return null;
  return (
    <div className="flex justify-center my-6">
      <AdsterraBanner size={size} />
    </div>
  );
}

// A centered row of one or more banners (wraps on small screens). Use between
// content sections so a tall ad never unbalances a grid column.
export function AdRow({ category, sizes }: { category?: string; sizes: BannerSize[] }) {
  if (category === 'islamic') return null;
  return (
    <div className="flex flex-wrap justify-center items-start gap-4 my-6">
      {sizes.map((s, i) => <AdsterraBanner key={`${s}-${i}`} size={s} />)}
    </div>
  );
}

// Fixed left + right skyscrapers in the empty gutters beside the centered content
// (max-w-5xl ≈ 1024px). Only shown ≥1400px wide, where each gutter clears 160px;
// hidden on everything narrower so they never overlap the content.
export function AdRails({ category }: { category?: string }) {
  if (category === 'islamic') return null;
  return (
    <>
      <div className="hidden min-[1400px]:block fixed left-3 top-1/2 -translate-y-1/2 z-20">
        <AdsterraBanner size="160x600" />
      </div>
      <div className="hidden min-[1400px]:block fixed right-3 top-1/2 -translate-y-1/2 z-20">
        <AdsterraBanner size="160x600" />
      </div>
    </>
  );
}
