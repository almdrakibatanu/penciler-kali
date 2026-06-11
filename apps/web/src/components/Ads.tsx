import { AdsterraGlobal, AdsterraNativeBanner } from './Adsterra';

// All Adsterra units for a page. Renders NOTHING on the Islamic section — pass
// category='islamic' (category page) or the article's category to suppress ads
// there. On every other page it renders the native banner + popunder/social bar.
export function Ads({ category }: { category?: string }) {
  if (category === 'islamic') return null;
  return (
    <>
      <AdsterraNativeBanner />
      <AdsterraGlobal />
    </>
  );
}
