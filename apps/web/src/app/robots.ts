import type { MetadataRoute } from 'next';

// Generates /robots.txt. Site URL matches layout.tsx's metadataBase.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pencilerkali.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /search is query-param driven (?q=…) — infinite URL space, no SEO value.
      disallow: ['/search'],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
