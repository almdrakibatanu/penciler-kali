import { listVideos } from '@/lib/api';
import { Ads } from '@/components/Ads';

export const revalidate = 60;

export default async function VideoPage() {
  const { items } = await listVideos();
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-head font-bold text-3xl mb-6">ভিডিও</h1>
      {items.length === 0 ? (
        <p className="text-ink-500">এখনো কোনো ভিডিও প্রকাশিত হয়নি।</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((v) => (
            <a key={v.id} href={v.youtube_id ? `https://youtube.com/watch?v=${v.youtube_id}` : '#'} target="_blank" rel="noopener" className="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md">
              <div className="aspect-video bg-slate-200">
                {v.youtube_id && <img alt="" src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`} className="w-full h-full object-cover"/>}
                {!v.youtube_id && v.thumbnail_url && <img alt="" src={v.thumbnail_url} className="w-full h-full object-cover"/>}
              </div>
              <div className="p-4">
                <h3 className="font-head font-bold text-lg leading-snug">{v.title}</h3>
              </div>
            </a>
          ))}
        </div>
      )}
      <Ads />
    </div>
  );
}
