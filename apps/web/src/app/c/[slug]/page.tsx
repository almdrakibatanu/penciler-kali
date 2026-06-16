import { listArticles } from '@/lib/api';
import { LoadMore } from '@/components/LoadMore';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Ads, TopBanner, InlineAd, AdRails } from '@/components/Ads';
import { JsonLd } from '@/components/JsonLd';
import { SITE_URL, CATEGORY_LABEL } from '@/lib/site';

const LABEL = CATEGORY_LABEL;

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const label = LABEL[params.slug];
  if (!label) return {};
  // Keep an empty category out of the index — a "no articles yet" page reads as
  // thin/under-construction. Re-evaluated per request, so it self-heals once the
  // category has content.
  const { items } = await listArticles({ category: params.slug, limit: 1 });
  return {
    title: `${label} সংবাদ`,
    description: `সর্বশেষ ${label} সংবাদ — PencilerKali.com`,
    alternates: { canonical: `/c/${params.slug}` },
    robots: items.length === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const label = LABEL[params.slug];
  if (!label) notFound();
  const { items } = await listArticles({ category: params.slug, limit: 30 });
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}/c/${params.slug}` },
    ],
  };
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
      <JsonLd data={breadcrumbJsonLd} />
      <AdRails category={params.slug} />
      <TopBanner category={params.slug} />
      <nav className="text-sm text-ink-500 mb-3" aria-label="breadcrumb">
        <Link href="/" className="hover:text-brand-600">হোম</Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-700">{label}</span>
      </nav>
      <h1 className="font-head font-bold text-3xl mb-6">{label}</h1>
      {items.length === 0 ? (
        <p className="text-ink-500">এই বিভাগে এখনো কোনো প্রবন্ধ নেই।</p>
      ) : (
        <LoadMore category={params.slug} initial={items} pageSize={30} />
      )}
      <InlineAd size="300x250" category={params.slug} />
      <Ads category={params.slug} />
    </div>
  );
}
