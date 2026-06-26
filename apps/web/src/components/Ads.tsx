// Ad slots disabled. All components are stubs so existing imports continue to
// compile without changes. Re-enable by replacing these with real ad components.
export type BannerSize = '728x90' | '468x60' | '320x50' | '300x250' | '160x600' | '160x300';

export function Ads({ category: _ }: { category?: string }) { return null; }
export function TopBanner({ category: _ }: { category?: string }) { return null; }
export function InlineAd({ category: _, size: __ = '300x250' }: { category?: string; size?: BannerSize }) { return null; }
export function AdRow({ category: _, sizes: __ }: { category?: string; sizes: BannerSize[] }) { return null; }
export function AdRails({ category: _ }: { category?: string }) { return null; }
