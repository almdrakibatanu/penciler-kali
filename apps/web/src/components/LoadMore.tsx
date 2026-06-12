'use client';

import { useState } from 'react';
import { NewsCard } from './NewsCard';
import type { ArticleListItem } from '@/lib/api';

// Renders a category grid that grows on demand. The server renders the first
// page; clicking "আরো দেখুন" fetches the next page from the public API (through
// the Next rewrite at /api/articles) and appends it. The button hides itself
// once a page comes back short — that means there's nothing more to show.
export function LoadMore({
  category,
  initial,
  pageSize = 30,
}: {
  category: string;
  initial: ArticleListItem[];
  pageSize?: number;
}) {
  const [items, setItems] = useState<ArticleListItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length < pageSize);

  async function loadMore() {
    setLoading(true);
    try {
      const u = new URL('/api/articles', window.location.origin);
      u.searchParams.set('category', category);
      u.searchParams.set('limit', String(pageSize));
      u.searchParams.set('offset', String(items.length));
      const r = await fetch(u, { cache: 'no-store' });
      const data = r.ok ? await r.json() : { items: [] };
      const next: ArticleListItem[] = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((n) => !seen.has(n.id))];
      });
      if (next.length < pageSize) setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((a) => <NewsCard key={a.id} a={a} />)}
      </div>
      {!done && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'লোড হচ্ছে…' : 'আরো দেখুন'}
          </button>
        </div>
      )}
    </>
  );
}
