import type { NextConfig } from "next";

// Next.js dev sunucusu (Fast Refresh/HMR) 'unsafe-eval' gerektirir; production
// build'de bu izin kaldırılır.
const isDev = process.env.NODE_ENV !== "production";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://generativelanguage.googleapis.com",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // SEO Optimizations
  poweredByHeader: false, // Remove X-Powered-By header for security
  reactStrictMode: true,

  // Native N-API modul (resvg) turbopack ile bundle edilemiyor — external birak.
  serverExternalPackages: ["@resvg/resvg-js"],

  // jsPDF'in optional dependency'si eski "html2canvas"i cekiyor (oklch/oklab
  // renk fonksiyonlarini desteklemiyor, PDF export'ta hataya sebep oluyordu).
  // Her "html2canvas" import'unu -pro fork'una yonlendir.
  turbopack: {
    resolveAlias: {
      html2canvas: "html2canvas-pro",
    },
  },

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
          // Clickjacking koruması — site başka bir origin'in iframe'ine gömülemez.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          // MIME-sniffing koruması.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
      { source: "/daytrade", destination: "/admin/trading/daytrade", permanent: false },
      { source: "/daytrade-options", destination: "/admin/trading/daytrade-options", permanent: false },
      { source: "/daytrade-performance", destination: "/admin/trading/daytrade-performance", permanent: false },
      { source: "/optanaliz", destination: "/admin/trading/optanaliz", permanent: false },
      { source: "/optanaliz-performance", destination: "/admin/trading/optanaliz-performance", permanent: false },
      { source: "/preorder/:path*", destination: "/admin/trading/preorder/:path*", permanent: false },
      { source: "/csp/:path*", destination: "/admin/trading/csp/:path*", permanent: false },

      // Portfolio
      { source: "/smart-tracker", destination: "/admin/portfolio/smart-tracker", permanent: false },
      { source: "/order/:path*", destination: "/admin/portfolio/order/:path*", permanent: false },

      // Analytics
      { source: "/hourly", destination: "/admin/analytics/hourly", permanent: false },

      // Stocks
      { source: "/category/:path*", destination: "/admin/stocks/category/:path*", permanent: false },

      // AI
      { source: "/daily/:path*", destination: "/admin/ai/daily/:path*", permanent: false },

      // Other
      { source: "/pro", destination: "/admin/pro", permanent: false },

      // Moved under /global
      { source: "/tr/hisse/:ticker", destination: "/global/tr/hisse/:ticker", permanent: true },

      // Stale Google-indexed URL with no matching route (404) — redirect to the
      // current login page instead of leaving it dead.
      { source: "/login", destination: "/global/en/login", permanent: true },
    ];
  },
};

export default nextConfig;
