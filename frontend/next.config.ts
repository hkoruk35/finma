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
};

export default nextConfig;
