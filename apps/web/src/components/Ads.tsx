import { AdsterraNativeBanner } from './Adsterra';

// Ads for a page. Renders NOTHING on the Islamic section (pass category='islamic'
// or the article's category). Only the contained native banner is shown — the
// intrusive Popunder + Social Bar formats are disabled site-wide (see Adsterra.tsx).
export function Ads({ category }: { category?: string }) {
  if (category === 'islamic') return null;
  return <AdsterraNativeBanner />;
}
