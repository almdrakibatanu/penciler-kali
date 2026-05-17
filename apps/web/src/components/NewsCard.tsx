import Link from 'next/link';
import { formatBnDate, type ArticleListItem } from '@/lib/api';

const CAT_LABEL: Record<string, string> = {
  bangladesh: 'বাংলাদেশ', bidesh: 'বিদেশ', kheladhula: 'খেলাধুলা',
  binodon: 'বিনোদন', islamic: 'ইসলামিক',
};

export function NewsCard({ a, size = 'md' }: { a: ArticleListItem; size?: 'sm' | 'md' | 'lg' }) {
  const ts = a.published_at ?? a.created_at;
  const img = a.thumbnail_url ?? a.hero_image_url;
  if (size === 'lg') {
    return (
      <Link href={`/article/${a.slug}`} className="group block rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
          {img ? <img src={img} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/> : <div className="w-full h-full bg-gradient-to-br from-brand-500 to-brand-900"/>}
        </div>
        <div className="p-5">
          <span className="text-xs text-brand-600 font-semibold">{CAT_LABEL[a.category] ?? a.category}</span>
          <h2 className="font-head font-bold text-2xl md:text-3xl mt-2 leading-tight group-hover:text-brand-700">{a.title}</h2>
          {a.summary && <p className="mt-2 text-ink-700 line-clamp-2">{a.summary}</p>}
          <p className="mt-3 text-xs text-ink-500">{formatBnDate(ts)}</p>
        </div>
      </Link>
    );
  }
  if (size === 'sm') {
    return (
      <Link href={`/article/${a.slug}`} className="group flex gap-3 p-3 rounded-lg hover:bg-slate-50">
        <div className="w-24 h-16 shrink-0 rounded-md bg-slate-100 overflow-hidden">
          {img ? <img src={img} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-brand-100"/>}
        </div>
        <div className="min-w-0">
          <span className="text-[11px] text-brand-600 font-semibold">{CAT_LABEL[a.category] ?? a.category}</span>
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-brand-700">{a.title}</h3>
        </div>
      </Link>
    );
  }
  return (
    <Link href={`/article/${a.slug}`} className="group block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
        {img ? <img src={img} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/> : <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300"/>}
      </div>
      <div className="p-4">
        <span className="text-xs text-brand-600 font-semibold">{CAT_LABEL[a.category] ?? a.category}</span>
        <h3 className="font-head font-bold text-lg mt-1 leading-snug line-clamp-2 group-hover:text-brand-700">{a.title}</h3>
        {a.summary && <p className="text-sm text-ink-700 mt-2 line-clamp-2">{a.summary}</p>}
        <p className="mt-2 text-xs text-ink-500">{formatBnDate(ts)}</p>
      </div>
    </Link>
  );
}
