/**
 * SEO Configuration for BOGA AI
 * Shared SEO settings across the application
 */

export const SEO_CONFIG = {
  baseUrl: "https://bogastock.com",
  siteName: "BOGA AI - Blue One Global Analysis",
  title: "BOGA AI - Blue One Global Analysis - Daily +8000 | AI-Powered US Stock Analysis & Signals",
  description: "Daily AI analysis of +8000 top US stocks by BOGA AI. Breakout signals, momentum picks, undervalued screener. Free stock watchlist and alerts.",
  keywords: [
    "US stock AI analysis",
    "daily stock signals",
    "stock screener",
    "breakout stocks",
    "momentum stocks",
    "stock analysis",
    "trading signals",
    "stock picker",
    "best stocks today",
    "stock watchlist",
  ],
  image: {
    url: "https://bogastock.com/finmawave.png",
    width: 1200,
    height: 630,
    alt: "BOGA AI - Blue One Global Analysis",
  },
  socialProfiles: {
    twitter: "https://twitter.com/bogaai",
    linkedin: "https://linkedin.com/company/bogaai",
    instagram: "https://instagram.com/bogaai",
  },
  author: "BOGA AI",
  language: "en",
  locale: "en_US",
  themeColor: "#3b82f6",
};

// Page-specific SEO defaults
export const PAGE_DEFAULTS = {
  home: {
    changeFrequency: "daily" as const,
    priority: 1.0,
  },
  stock: {
    changeFrequency: "daily" as const,
    priority: 0.7,
  },
  sector: {
    changeFrequency: "daily" as const,
    priority: 0.8,
  },
  academy: {
    changeFrequency: "monthly" as const,
    priority: 0.7,
  },
  legal: {
    changeFrequency: "yearly" as const,
    priority: 0.5,
  },
};

// Content type keywords for different pages
export const CONTENT_KEYWORDS = {
  stock: (ticker: string, company: string) => [
    `${ticker} stock analysis`,
    `${company} stock price`,
    `${ticker} trading signals`,
    "stock technical analysis",
    "daily stock signals",
  ],
  sector: (sector: string) => [
    `${sector} stocks`,
    `${sector} sector analysis`,
    `${sector} stock picks`,
    `best ${sector} stocks`,
  ],
  academy: (topic: string) => [
    `how to ${topic}`,
    `${topic} guide`,
    `${topic} tutorial`,
    `${topic} strategies`,
  ],
};
