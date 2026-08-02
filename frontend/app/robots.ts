import { MetadataRoute } from "next";
import { ALLOWED_CRAWLER_USER_AGENTS } from "@/lib/botUserAgents";

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
        // AI crawlers - explicit allow for better indexing. Kaynak:
        // lib/botUserAgents.ts (proxy.ts'in Faz 4 ölçümlü kapı muafiyetiyle
        // paylaşılan tek liste) — Googlebot burada tekrar edilmez, kendi
        // ayrı kuralı (crawlDelay ile) yukarıda zaten var.
        userAgent: ALLOWED_CRAWLER_USER_AGENTS.filter((ua) => ua !== "Googlebot"),
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
