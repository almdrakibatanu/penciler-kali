import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import Script from 'next/script';
import { JsonLd } from '@/components/JsonLd';
import { PushSubscribe } from '@/components/PushSubscribe';
import { BreakingTicker } from '@/components/BreakingTicker';
import { SITE_URL, SITE_NAME, SITE_DESC, LOGO_URL, SOCIAL } from '@/lib/site';

// Google Analytics 4 — only loads when NEXT_PUBLIC_GA_ID is set in .env.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: { default: 'PencilerKali.com — বাংলাদেশের সর্বশেষ বাংলা সংবাদ', template: '%s — PencilerKali.com' },
  description: SITE_DESC,
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: SITE_NAME, locale: 'bn_BD', type: 'website' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/logo', shortcut: '/logo', apple: '/logo' },
  // NOTE: no global `canonical` here — a blanket '/' makes every page declare
  // itself a duplicate of the homepage, so Facebook/Google scrape the homepage
  // instead of the article. Each page sets its own canonical below.
  robots: { index: true, follow: true },
};

// Site-wide structured data: who publishes this (Organization) and a sitelinks
// search box (WebSite). Rendered once in the layout so it's on every page.
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
  description: SITE_DESC,
  sameAs: [SOCIAL.facebook, SOCIAL.youtube],
};
const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'bn-BD',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const NAV = [
  { href: '/',                  label: 'হোম' },
  { href: '/c/bangladesh',      label: 'বাংলাদেশ' },
  { href: '/c/bidesh',          label: 'বিদেশ' },
  { href: '/c/kheladhula',      label: 'খেলাধুলা' },
  { href: '/c/binodon',         label: 'বিনোদন' },
  { href: '/c/islamic',         label: 'ইসলামিক' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body className="min-h-screen flex flex-col bg-slate-50 text-ink-900">
        <JsonLd data={[ORG_JSONLD, WEBSITE_JSONLD]} />
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
            </Script>
          </>
        )}
        <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.jpg" alt="PencilerKali.com" className="h-9 w-auto rounded" />
              <span className="font-head font-bold text-xl tracking-tight">PencilerKali<span className="text-brand-600">.com</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 ml-2 flex-1 overflow-x-auto">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-100 whitespace-nowrap">
                  {n.label}
                </Link>
              ))}
            </nav>
            <form action="/search" className="ml-auto flex items-center gap-2">
              <input name="q" placeholder="অনুসন্ধান…" className="w-36 md:w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"/>
            </form>
            <PushSubscribe />
          </div>
          <nav className="md:hidden border-t border-slate-100 overflow-x-auto">
            <div className="flex gap-1 px-2 py-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap hover:bg-slate-100">{n.label}</Link>
              ))}
            </div>
          </nav>
        </header>

        <BreakingTicker />

        <main className="flex-1">{children}</main>

        <footer className="mt-12 border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="font-head font-bold text-lg mb-2">PencilerKali.com</div>
              <p className="text-ink-500">বাংলাদেশ, বিদেশ, খেলাধুলা, বিনোদন ও ইসলামিক সংবাদের নির্ভরযোগ্য বাংলা সংবাদমাধ্যম। ২৪/৭ আপডেট।</p>
            </div>
            <div>
              <div className="font-semibold mb-2">বিভাগ</div>
              <ul className="space-y-1 text-ink-700">
                {NAV.slice(1, 6).map((n) => <li key={n.href}><Link href={n.href} className="hover:text-brand-600">{n.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-2">সাইট</div>
              <ul className="space-y-1 text-ink-700">
                <li><Link href="/about" className="hover:text-brand-600">About Us</Link></li>
                <li><Link href="/editorial-policy" className="hover:text-brand-600">Editorial Policy</Link></li>
                <li><Link href="/privacy" className="hover:text-brand-600">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-brand-600">Terms &amp; Disclaimer</Link></li>
                <li><Link href="/contact" className="hover:text-brand-600">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-2">সোশ্যাল</div>
              <ul className="space-y-1 text-ink-700">
                <li><a target="_blank" rel="noopener" className="hover:text-brand-600" href="https://www.facebook.com/profile.php?id=100066384905135">Facebook</a></li>
                <li><a target="_blank" rel="noopener" className="hover:text-brand-600" href="https://www.youtube.com/@AMRWorld-gd2sl">YouTube</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 py-4 text-center text-xs text-ink-500">© {new Date().getFullYear()} PencilerKali.com — সকল অধিকার সংরক্ষিত।</div>
        </footer>
      </body>
    </html>
  );
}
