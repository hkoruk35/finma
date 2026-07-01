import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SEO Optimizations
  poweredByHeader: false, // Remove X-Powered-By header for security
  reactStrictMode: true,

  // Security headers for crawlers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },
      // Disable indexing for admin pages
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },

  // Image optimization — avif %50 daha küçük, webp fallback
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 86400, // 24 saat cache
  },

  // Backwards compatibility redirects
  async redirects() {
    return [
      // Trading
      { source: "/swing/:path*", destination: "/admin/trading/swing/:path*", permanent: false },
      { source: "/daytrade", destination: "/admin/trading/daytrade", permanent: false },
      { source: "/daytrade-options", destination: "/admin/trading/daytrade-options", permanent: false },
      { source: "/daytrade-performance", destination: "/admin/trading/daytrade-performance", permanent: false },
      { source: "/options/:path*", destination: "/admin/trading/options/:path*", permanent: false },
      { source: "/optanaliz", destination: "/admin/trading/optanaliz", permanent: false },
      { source: "/optanaliz-performance", destination: "/admin/trading/optanaliz-performance", permanent: false },
      { source: "/preorder/:path*", destination: "/admin/trading/preorder/:path*", permanent: false },
      { source: "/csp/:path*", destination: "/admin/trading/csp/:path*", permanent: false },

      // Portfolio
      { source: "/tracker", destination: "/admin/portfolio/tracker", permanent: false },
      { source: "/watchlist", destination: "/admin/portfolio/watchlist", permanent: false },
      { source: "/smart-tracker", destination: "/admin/portfolio/smart-tracker", permanent: false },
      { source: "/order/:path*", destination: "/admin/portfolio/order/:path*", permanent: false },

      // Analytics
      { source: "/performance/:path*", destination: "/admin/analytics/performance/:path*", permanent: false },
      { source: "/terminal", destination: "/admin/analytics/terminal", permanent: false },
      { source: "/screener/:path*", destination: "/admin/analytics/screener/:path*", permanent: false },
      { source: "/hourly", destination: "/admin/analytics/hourly", permanent: false },

      // Education
      { source: "/academy/:path*", destination: "/admin/education/academy/:path*", permanent: false },

      // Stocks
      { source: "/stock/:path*", destination: "/admin/stocks/:path*", permanent: false },
      { source: "/category/:path*", destination: "/admin/stocks/category/:path*", permanent: false },
      { source: "/sector/:path*", destination: "/admin/stocks/sector/:path*", permanent: false },

      // AI
      { source: "/ai/:path*", destination: "/admin/ai/:path*", permanent: false },
      { source: "/daily/:path*", destination: "/admin/ai/daily/:path*", permanent: false },

      // Account
      { source: "/login", destination: "/admin/account/login", permanent: false },
      { source: "/register", destination: "/admin/account/register", permanent: false },

      // Archive
      { source: "/archive/:path*", destination: "/admin/archive/:path*", permanent: false },

      // Other
      { source: "/pro", destination: "/admin/pro", permanent: false },
      { source: "/theme/:path*", destination: "/admin/settings/theme/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
