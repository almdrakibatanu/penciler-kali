// ----------------------------------------------------------------------------
// Built-in source registry. The "category" column here is the *suggested*
// category — the AI rewriter has the final word based on content.
//
// Every feed below was health-checked (returns items). Dead feeds removed:
// Jugantor, Kaler Kantho, Samakal, Ittefaq, TBS, bdnews24, Dhaka Tribune,
// Bangla Tribune, Reuters, IslamicFinder, IslamiCity, Muslim Aid.
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
  // ---- Bangladeshi (Bengali) ----
  { name: 'Prothom Alo',     kind: 'rss', url: 'https://www.prothomalo.com/feed', category: 'bangladesh', lang: 'bn' },
  { name: 'BD Pratidin',     kind: 'rss', url: 'https://www.bd-pratidin.com/rss.xml', category: 'bangladesh', lang: 'bn' },
  { name: 'BBC Bangla',      kind: 'rss', url: 'https://feeds.bbci.co.uk/bengali/rss.xml', category: 'bangladesh', lang: 'bn' },
  { name: 'Jagonews24',      kind: 'rss', url: 'https://www.jagonews24.com/rss/rss.xml', category: 'bangladesh', lang: 'bn' },
  { name: 'RisingBD',        kind: 'rss', url: 'https://www.risingbd.com/rss/rss.xml', category: 'bangladesh', lang: 'bn' },

  // ---- English Bangladeshi ----
  { name: 'The Daily Star',  kind: 'rss', url: 'https://www.thedailystar.net/rss.xml', category: 'bangladesh', lang: 'en' },

  // ---- International (bidesh) ----
  { name: 'BBC World',       kind: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'bidesh', lang: 'en' },
  { name: 'Al Jazeera',      kind: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'bidesh', lang: 'en' },
  { name: 'NYT World',       kind: 'rss', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'bidesh', lang: 'en' },
  { name: 'The Guardian World', kind: 'rss', url: 'https://www.theguardian.com/world/rss', category: 'bidesh', lang: 'en' },
  { name: 'DW World',        kind: 'rss', url: 'https://rss.dw.com/rdf/rss-en-world', category: 'bidesh', lang: 'en' },
  { name: 'CNN World',       kind: 'rss', url: 'http://rss.cnn.com/rss/edition_world.rss', category: 'bidesh', lang: 'en' },

  // ---- Sports (kheladhula) ----
  { name: 'ESPN Cricinfo',   kind: 'rss', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', category: 'kheladhula', lang: 'en' },
  { name: 'BBC Sport',       kind: 'rss', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'kheladhula', lang: 'en' },
  { name: 'BBC Cricket',     kind: 'rss', url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml', category: 'kheladhula', lang: 'en' },
  { name: 'BBC Football',    kind: 'rss', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', category: 'kheladhula', lang: 'en' },
  { name: 'Sky Sports',      kind: 'rss', url: 'https://www.skysports.com/rss/12040', category: 'kheladhula', lang: 'en' },

  // ---- Entertainment (binodon) ----
  { name: 'Bollywood Hungama', kind: 'rss', url: 'https://www.bollywoodhungama.com/rss/news.xml', category: 'binodon', lang: 'en' },
  { name: 'NDTV Movies',     kind: 'rss', url: 'https://feeds.feedburner.com/ndtvmovies-latest', category: 'binodon', lang: 'en' },
  { name: 'BBC Entertainment', kind: 'rss', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', category: 'binodon', lang: 'en' },
  { name: 'Variety',         kind: 'rss', url: 'https://variety.com/feed/', category: 'binodon', lang: 'en' },
  { name: 'Hollywood Reporter', kind: 'rss', url: 'https://www.hollywoodreporter.com/feed/', category: 'binodon', lang: 'en' },

  // ---- Islamic ----
  // Good Islamic RSS feeds are scarce. AboutIslam (RSS) + Muslims Day (HTML
  // scrape — it has no feed) supply the Islamic section; the AI rewriter also
  // re-tags religious items from Bangla papers as islamic.
  { name: 'AboutIslam',      kind: 'rss',  url: 'https://aboutislam.net/feed/', category: 'islamic', lang: 'en' },
  { name: 'Muslims Day',     kind: 'html', url: 'https://muslimsday.com/blog/', category: 'islamic', lang: 'bn' },

  // ---- YouTube specific channels (handled by youtube fetcher) ----
  { name: 'AMR World (channel)', kind: 'youtube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=PLACEHOLDER', category: 'binodon', lang: 'bn', enabled: false },
];
