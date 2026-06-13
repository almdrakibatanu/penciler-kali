import { listArticles } from '@/lib/api';
import { NewsCard } from '@/components/NewsCard';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Ads, TopBanner, AdRow, AdRails } from '@/components/Ads';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { alternates: { canonical: '/' } };

const CATS: Array<{ slug: string; label: string }> = [
  { slug: 'bangladesh', label: 'বাংলাদেশ' },
  { slug: 'bidesh',     label: 'বিদেশ' },
  { slug: 'kheladhula', label: 'খেলাধুলা' },
  { slug: 'binodon',    label: 'বিনোদন' },
  { slug: 'islamic',    label: 'ইসলামিক' },
];

export default async function HomePage() {
  const [all, mostRead, ...byCat] = await Promise.all([
    listArticles({ limit: 12 }),
    listArticles({ sort: 'views', limit: 6 }),
    ...CATS.map((c) => listArticles({ category: c.slug, limit: 6 })),
  ]);
  const hero = all.items[0];
  // "সর্বাধিক পঠিত" = top by real view count (falls back to recent on a fresh DB
  // where every view count is 0). Drop the hero so it isn't listed twice.
  const top = (mostRead.items.length ? mostRead.items : all.items)
    .filter((a) => a.id !== hero?.id)
    .slice(0, 4);
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
      <AdRails />
      <TopBanner />
      {hero ? (
        <section className="grid md:grid-cols-3 gap-5 items-start">
          <div className="md:col-span-2"><NewsCard a={hero} size="lg"/></div>
          <aside className="bg-white rounded-xl divide-y divide-slate-100">
            <h2 className="px-4 pt-3 pb-1 text-sm font-semibold text-ink-500">সর্বাধিক পঠিত</h2>
            {top.map((a) => <NewsCard key={a.id} a={a} size="sm"/>)}
          </aside>
        </section>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-6">
          কোনো প্রবন্ধ পাওয়া যায়নি। `npm run seed` চালান, এরপর `npm run -w @pk/api cli collect` দিয়ে সংবাদ সংগ্রহ শুরু করুন।
        </div>
      )}

      <AdRow sizes={['300x250', '160x300']} />

      {CATS.map((c, i) => {
        const items = byCat[i]?.items ?? [];
        if (items.length === 0) return null;
        return (
          <section key={c.slug} className="mt-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="font-head font-bold text-2xl">{c.label}</h2>
              <Link href={`/c/${c.slug}`} className="text-sm text-brand-600 hover:underline">আরো দেখুন →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((a) => <NewsCard key={a.id} a={a}/>)}
            </div>
          </section>
        );
      })}
      <Ads />
    </div>
  );
}
