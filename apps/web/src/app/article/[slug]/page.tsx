import { getArticle, formatBnDate } from '@/lib/api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Ads, TopBanner, InlineAd, AdRails } from '@/components/Ads';

export const revalidate = 30;

const CAT_LABEL: Record<string, string> = {
  bangladesh: 'বাংলাদেশ', bidesh: 'বিদেশ', kheladhula: 'খেলাধুলা',
  binodon: 'বিনোদন', islamic: 'ইসলামিক',
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await getArticle(params.slug);
  if (!a) return {};
  return {
    title: a.seo_title ?? a.title,
    description: a.seo_description ?? a.summary ?? undefined,
    alternates: { canonical: `/article/${params.slug}` },
    openGraph: {
      title: a.seo_title ?? a.title,
      description: a.seo_description ?? a.summary ?? undefined,
      url: `/article/${params.slug}`,
      images: a.og_image_url ? [{ url: a.og_image_url }] : (a.hero_image_url ? [{ url: a.hero_image_url }] : []),
      type: 'article',
    },
  };
}

function parseSources(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = await getArticle(params.slug);
  if (!a) notFound();
  const ts = a.published_at ?? a.created_at;
  const sources = parseSources(a.source_urls);
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <AdRails category={a.category} />
      <TopBanner category={a.category} />
      <Link href={`/c/${a.category}`} className="text-sm text-brand-600 font-semibold">{CAT_LABEL[a.category] ?? a.category}</Link>
      <h1 className="font-head font-bold text-3xl md:text-4xl mt-2 leading-tight">{a.title}</h1>
      {a.subtitle && <p className="text-lg text-ink-700 mt-2">{a.subtitle}</p>}
      <p className="mt-3 text-sm text-ink-500">{formatBnDate(ts)}</p>
      {(a.thumbnail_url ?? a.hero_image_url) && (
        <img src={a.thumbnail_url ?? a.hero_image_url ?? ''} alt={a.title} className="my-6 rounded-xl w-full object-cover aspect-[16/9]"/>
      )}
      <div className="prose-bn text-[1.05rem]">
        {(a.body ?? '').split(/\n\n+/).map((p, i, arr) => (
          <div key={i}>
            <p>{p}</p>
            {/* one in-article rectangle, after the 3rd paragraph (only if the article is long enough) */}
            {i === 2 && arr.length > 4 && <InlineAd size="300x250" category={a.category} />}
          </div>
        ))}
      </div>
      {sources.length > 0 && (
        <details className="mt-8 border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink-700">তথ্যসূত্র</summary>
          <ul className="mt-2 text-sm space-y-1">
            {sources.map((u, i) => (
              <li key={i}><a href={u} target="_blank" rel="noopener" className="text-brand-600 hover:underline break-all">{u}</a></li>
            ))}
          </ul>
        </details>
      )}
      <Ads category={a.category} />
    </article>
  );
}
