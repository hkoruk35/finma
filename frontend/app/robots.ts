import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Allow all bots access
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/login",
          "/register",
          "/api/auth/",
          "/*?*sort=", // Query parameters for sorting
          "/*?*filter=", // Query parameters for filtering
          "/*?*page=*", // Pagination
        ],
      },
      {
        // Google bot specific rules
        userAgent: "Googlebot",
        allow: "/",
        crawlDelay: 0.5, // Be nice to the server
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
