import { listArticles } from '@/lib/api';
import { LoadMore } from '@/components/LoadMore';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Ads, BannerAd } from '@/components/Ads';

const LABEL: Record<string, string> = {
  bangladesh: 'বাংলাদেশ', bidesh: 'বিদেশ', kheladhula: 'খেলাধুলা',
  binodon: 'বিনোদন', islamic: 'ইসলামিক',
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const label = LABEL[params.slug];
  if (!label) return {};
  return {
    title: `${label} সংবাদ`,
    description: `সর্বশেষ ${label} সংবাদ — PencilerKali.com`,
    alternates: { canonical: `/c/${params.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  if (!LABEL[params.slug]) notFound();
  const { items } = await listArticles({ category: params.slug, limit: 30 });
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
      <BannerAd category={params.slug} />
      <h1 className="font-head font-bold text-3xl mb-6">{LABEL[params.slug]}</h1>
      {items.length === 0 ? (
        <p className="text-ink-500">এই বিভাগে এখনো কোনো প্রবন্ধ নেই।</p>
      ) : (
        <LoadMore category={params.slug} initial={items} pageSize={30} />
      )}
      <Ads category={params.slug} />
    </div>
  );
}
