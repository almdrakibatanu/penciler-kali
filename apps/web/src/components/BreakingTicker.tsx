import Link from 'next/link';
import { listArticles } from '@/lib/api';

// Thin "latest headlines" bar shown under the header on every page. Server
// component: pulls the newest articles live. The headline list is duplicated so
// the CSS marquee loops seamlessly; hover pauses it (see globals.css).
export async function BreakingTicker() {
  const { items } = await listArticles({ limit: 8 });
  if (items.length === 0) return null;
  const headlines = [...items, ...items]; // duplicate for a seamless loop

  return (
    <div className="bg-brand-900 text-white">
      <div className="max-w-6xl mx-auto flex items-stretch overflow-hidden">
        <span className="shrink-0 bg-red-600 text-white text-xs font-bold px-3 py-2 flex items-center gap-1 z-10">
          🔴 সর্বশেষ
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max animate-marquee whitespace-nowrap py-2">
            {headlines.map((a, i) => (
              <Link
                key={`${a.id}-${i}`}
                href={`/article/${a.slug}`}
                className="text-sm px-5 hover:text-brand-100 border-r border-white/15"
              >
                {a.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
