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

  // Image optimization for better SEO
  images: {
    unoptimized: false,
    formats: ["image/webp"],
  },
};

export default nextConfig;
