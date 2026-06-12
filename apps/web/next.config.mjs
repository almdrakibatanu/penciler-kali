/** @type {import('next').NextConfig} */
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';
const nextConfig = {
  reactStrictMode: true,
  // Don't let the client-side Router Cache serve stale pages — a news site needs
  // fresh content on every navigation (e.g. switching Bangladesh → Islamic).
  experimental: { staleTimes: { dynamic: 0, static: 0 } },
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
      { source: '/cdn/:path*', destination: `${apiBase}/cdn/:path*` },
    ];
  },
};
export default nextConfig;
