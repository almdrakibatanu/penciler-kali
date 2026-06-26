import { getArticle, listArticles, formatBnDate } from '@/lib/api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Ads, TopBanner, InlineAd, AdRails } from '@/components/Ads';
import { NewsCard } from '@/components/NewsCard';
import { ShareButtons } from '@/components/ShareButtons';
import { JsonLd } from '@/components/JsonLd';
import { SITE_URL, AUTHOR_NAME, CATEGORY_LABEL, PUBLISHER } from '@/lib/site';

export const revalidate = 30;

const CAT_LABEL = CATEGORY_LABEL;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await getArticle(params.slug);
  if (!a) return {};
  const url = `/article/${params.slug}`;
  const img = a.og_image_url ?? a.hero_image_url ?? a.thumbnail_url ?? undefined;
  const published = new Date(a.published_at ?? a.created_at).toISOString();
  const title = a.seo_title ?? a.title;
  const description = a.seo_description ?? a.summary ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: published,
      modifiedTime: published,
      authors: [AUTHOR_NAME],
      section: CAT_LABEL[a.category] ?? a.category,
      tags: (a.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      images: img ? [{ url: img }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: img ? [img] : undefined },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = await getArticle(params.slug);
  if (!a) notFound();
  const ts = a.published_at ?? a.created_at;
  const catLabel = CAT_LABEL[a.category] ?? a.category;
  const url = `${SITE_URL}/article/${params.slug}`;
  const img = a.og_image_url ?? a.hero_image_url ?? a.thumbnail_url ?? undefined;
  const published = new Date(ts).toISOString();

  // Same-category articles for the "related" block (drop the current one).
  const related = (await listArticles({ category: a.category, limit: 7 })).items
    .filter((r) => r.slug !== a.slug)
    .slice(0, 4);

  const newsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: (a.seo_title ?? a.title).slice(0, 110),
    description: a.seo_description ?? a.summary ?? undefined,
    image: img ? [img] : undefined,
    datePublished: published,
    dateModified: published,
    author: { '@type': 'Organization', name: AUTHOR_NAME, url: SITE_URL },
    publisher: PUBLISHER,
    articleSection: catLabel,
    inLanguage: 'bn-BD',
    isAccessibleForFree: true,
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: catLabel, item: `${SITE_URL}/c/${a.category}` },
      { '@type': 'ListItem', position: 3, name: a.title, item: url },
    ],
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <JsonLd data={[newsJsonLd, breadcrumbJsonLd]} />
      <AdRails category={a.category} />
      <TopBanner category={a.category} />

      {/* Breadcrumbs */}
      <nav className="text-sm text-ink-500 mb-3" aria-label="breadcrumb">
        <Link href="/" className="hover:text-brand-600">হোম</Link>
        <span className="mx-1.5">›</span>
        <Link href={`/c/${a.category}`} className="hover:text-brand-600">{catLabel}</Link>
      </nav>

      <span className="text-sm text-brand-600 font-semibold">{catLabel}</span>
      <h1 className="font-head font-bold text-3xl md:text-4xl mt-2 leading-tight">{a.title}</h1>
      {a.subtitle && <p className="text-lg text-ink-700 mt-2">{a.subtitle}</p>}
      <p className="mt-3 text-sm text-ink-500">
        <span className="font-medium text-ink-700">{AUTHOR_NAME}</span>
        <span className="mx-1.5">·</span>
        {formatBnDate(ts)}
      </p>
      {(a.thumbnail_url ?? a.hero_image_url) && (
        <img src={a.thumbnail_url ?? a.hero_image_url ?? ''} alt={a.title} className="my-6 rounded-xl w-full object-cover aspect-[16/9]"/>
      )}
      <ShareButtons url={url} title={a.title} />
      <div className="prose-bn text-[1.05rem]">
        {(a.body ?? '').split(/\n\n+/).map((p, i) => (
          <div key={i}><p>{p}</p></div>
        ))}
      </div>
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-head font-bold text-2xl mb-4">আরো {catLabel} সংবাদ</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {related.map((r) => <NewsCard key={r.id} a={r} />)}
          </div>
        </section>
      )}

      <Ads category={a.category} />
    </article>
  );
}
