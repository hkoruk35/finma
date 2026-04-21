import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Allow all bots access with security constraints
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
        ],
      },
      {
        // Google bot specific rules
        userAgent: "Googlebot",
        allow: "/",
        crawlDelay: 0.5, // Be nice to the server
      },
      {
        // AI crawlers - explicit allow for better indexing
        userAgent: ["GPTBot", "ChatGPT-User", "Google-Extended", "Claude-Web", "CCBot"],
        allow: "/",
      },
      {
        // Disallow bad bots
        userAgent: ["MJ12bot", "AhrefsBot", "SemrushBot"],
        disallow: "/",
      },
    ],
    sitemap: "https://bogastock.com/sitemap.xml",
    host: "https://bogastock.com",
  };
}
