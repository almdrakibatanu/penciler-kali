import { listArticles } from '@/lib/api';
import { NewsCard } from '@/components/NewsCard';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const { items } = q ? await listArticles({ q, limit: 30 }) : { items: [] };
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <form className="flex gap-2 mb-6" action="/search">
        <input name="q" defaultValue={q} placeholder="অনুসন্ধান করুন…" className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40"/>
        <button className="px-4 py-2 rounded-md bg-brand-600 text-white font-semibold">খুঁজুন</button>
      </form>
      {q && (
        <h1 className="font-head font-bold text-2xl mb-4">
          “{q}” — {items.length}টি ফলাফল
        </h1>
      )}
      {items.length === 0 ? (
        <p className="text-ink-500">{q ? 'কোনো ফলাফল পাওয়া যায়নি।' : 'উপরে অনুসন্ধান করুন।'}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((a) => <NewsCard key={a.id} a={a}/>)}
        </div>
      )}
    </div>
  );
}
