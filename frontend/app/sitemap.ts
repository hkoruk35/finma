import { MetadataRoute } from "next";
import { getAllTickers } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://bogastock.com";

  // Fetch all tickers for dynamic routes
  let allTickers: string[] = [];
  try {
    const data = await getAllTickers();
    allTickers = Array.isArray(data) ? data.map((stock: any) => stock.ticker) : [];
  } catch (error) {
    console.error("Error fetching tickers for sitemap:", error);
  }

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    // Main pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/swing-picks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/swing-performance`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/watchlist`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.75,
    },

    // Sector pages
    {
      url: `${baseUrl}/sector/technology`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sector/finance`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sector/healthcare`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sector/energy`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sector/consumer`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },

    // Academy pages
    {
      url: `${baseUrl}/academy`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/academy/ai-stock-picking`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/academy/momentum-trading`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/academy/rsi-indicator`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/academy/how-to-start-investing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // About pages
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about/how-it-works`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Legal pages
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Dynamic stock pages (up to 500)
  const dynamicPages: MetadataRoute.Sitemap = allTickers.slice(0, 500).map((ticker) => ({
    url: `${baseUrl}/stock/${ticker.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...dynamicPages];
}
