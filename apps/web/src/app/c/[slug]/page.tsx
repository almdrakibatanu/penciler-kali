import { listArticles } from '@/lib/api';
import { NewsCard } from '@/components/NewsCard';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const LABEL: Record<string, string> = {
  bangladesh: 'বাংলাদেশ', bidesh: 'বিদেশ', kheladhula: 'খেলাধুলা',
  binodon: 'বিনোদন', islamic: 'ইসলামিক',
};

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const label = LABEL[params.slug];
  if (!label) return {};
  return {
    title: `${label} সংবাদ`,
    description: `সর্বশেষ ${label} সংবাদ — PencilerKali.com`,
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  if (!LABEL[params.slug]) notFound();
  const { items } = await listArticles({ category: params.slug, limit: 30 });
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-head font-bold text-3xl mb-6">{LABEL[params.slug]}</h1>
      {items.length === 0 ? (
        <p className="text-ink-500">এই বিভাগে এখনো কোনো প্রবন্ধ নেই।</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((a) => <NewsCard key={a.id} a={a}/>)}
        </div>
      )}
    </div>
  );
}
