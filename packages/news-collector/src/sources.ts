// ----------------------------------------------------------------------------
// Built-in source registry. The "category" column here is the *suggested*
// category — the AI rewriter has the final word based on content.
// ----------------------------------------------------------------------------

export interface SourceDef {
  name: string;
  kind: 'rss' | 'html' | 'facebook' | 'youtube';
  url: string;
  category: string;
  lang: 'bn' | 'en';
  enabled?: boolean;
}

export const DEFAULT_SOURCES: SourceDef[] = [
  // ---- Bangladeshi RSS feeds (Bengali) ----
  { name: 'Prothom Alo — Bangladesh',  kind: 'rss', url: 'https://www.prothomalo.com/feed', category: 'bangladesh', lang: 'bn' },
  { name: 'Jugantor — All',            kind: 'rss', url: 'https://www.jugantor.com/rss.xml',  category: 'bangladesh', lang: 'bn' },
  { name: 'Kaler Kantho — All',        kind: 'rss', url: 'https://www.kalerkantho.com/rss.xml', category: 'bangladesh', lang: 'bn' },
  { name: 'Samakal — All',             kind: 'rss', url: 'https://samakal.com/rss.xml',       category: 'bangladesh', lang: 'bn' },
  { name: 'BD Pratidin — All',         kind: 'rss', url: 'https://www.bd-pratidin.com/rss.xml', category: 'bangladesh', lang: 'bn' },
  { name: 'BBC Bangla',                kind: 'rss', url: 'https://feeds.bbci.co.uk/bengali/rss.xml', category: 'bangladesh', lang: 'bn' },

  // ---- English Bangladeshi (for Bidesh + tech crossover) ----
  { name: 'The Daily Star',            kind: 'rss', url: 'https://www.thedailystar.net/rss.xml', category: 'bangladesh', lang: 'en' },
  { name: 'TBS News',                  kind: 'rss', url: 'https://www.tbsnews.net/feed',         category: 'bangladesh', lang: 'en' },

  // ---- International ----
  { name: 'BBC World',                 kind: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'bidesh', lang: 'en' },
  { name: 'Al Jazeera',                kind: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'bidesh', lang: 'en' },
  { name: 'Reuters Top',               kind: 'rss', url: 'https://feeds.reuters.com/reuters/topNews', category: 'bidesh', lang: 'en' },

  // ---- Sports ----
  { name: 'ESPN Cricinfo',             kind: 'rss', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', category: 'kheladhula', lang: 'en' },
  { name: 'BBC Sport',                 kind: 'rss', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'kheladhula', lang: 'en' },

  // ---- Entertainment ----
  { name: 'Variety',                   kind: 'rss', url: 'https://variety.com/feed/', category: 'binodon', lang: 'en' },

  // ---- Islamic ----
  { name: 'IslamicFinder Blog',        kind: 'rss', url: 'https://www.islamicfinder.org/news/rss/', category: 'islamic', lang: 'en' },

  // ---- YouTube specific channels (handled by youtube fetcher) ----
  { name: 'AMR World (channel)',       kind: 'youtube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=PLACEHOLDER', category: 'binodon', lang: 'bn', enabled: false },
];
