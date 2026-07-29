// Live US Market & Terminal Asset News Fetcher via Yahoo Finance & Google News RSS (TODAY ONLY)

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export interface NewsItem {
  title: string;
  source: string;
  pubDate: string;
  link: string;
}

const FORBIDDEN_WORDS = [
  "bist", "bist30", "bist100", "borsa istanbul", "borsa i̇stanbul",
  "aefes", "tcell", "tavhl", "thyao", "tuprs", "garan", "akbnk",
  "isctr", "eregl", "kchol", "sahol", "ykbnk", "sasa", "hekts"
];

const LOCALE_NAMES: Record<string, string> = {
  en: "English", tr: "Turkish", es: "Spanish", fr: "French", pt: "Portuguese",
};

/**
 * Haber kaynağı (Google News RSS) her zaman İngilizce döner — bölge/borsa
 * kapsamı kasıtlı olarak ABD ile sınırlı (bkz. chat/route.ts "BÖLGE VE BORSA
 * KAPSAMI"), bu yüzden kaynak dilini DEĞİL sadece başlıkların GÖSTERİM dilini
 * değiştiriyoruz. Kaynak adı, tarih ve link asla çevrilmez/değiştirilmez —
 * sadece başlık metni. Herhangi bir hata/parse sorununda orijinal İngilizce
 * başlıklar sessizce korunur (uydurma çeviri yapılmaz, kullanıcı en azından
 * doğru haberi İngilizce görür).
 */
// Memory Cache declarations to persist across hot reloads in development
if (!(global as any)._newsCache) {
  (global as any)._newsCache = {
    lastUpdated: 0,
    translations: {},
  };
}

if (!(global as any)._economyCache) {
  (global as any)._economyCache = {
    lastUpdated: 0,
    translations: {},
  };
}

if (!(global as any)._sportsCache) {
  (global as any)._sportsCache = {
    cache: {},
  };
}

async function translateNewsTitles(items: NewsItem[], lang: string): Promise<NewsItem[]> {
  const currentKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";

  const targetLang = LOCALE_NAMES[lang];
  if (!targetLang || items.length === 0 || !currentKey) {
    console.warn(`[newsSearch] Skipping translation: targetLang=${targetLang}, items=${items.length}, hasKey=${!!currentKey}, lang=${lang}`);
    return items;
  }

  try {
    const dynamicProvider = createGoogleGenerativeAI({ apiKey: currentKey });
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    console.log(`[newsSearch] Starting translation: ${items.length} titles to ${targetLang} (lang=${lang}, model=${modelName})`);
    const { text } = await generateText({
      model: dynamicProvider(modelName),
      prompt: `You are a financial and sports news translator. Translate each of the following ${items.length} news headlines into ${targetLang}. IMPORTANT: Keep ticker symbols, team names, company names, numbers, and abbreviations UNCHANGED. Return ONLY a valid JSON array of exactly ${items.length} translated strings in the same order as input. No markdown, no code blocks, no extra text. Just the JSON array.:\n\n${JSON.stringify(items.map((i) => i.title))}`,
      abortSignal: AbortSignal.timeout(10000),
    });

    console.log(`[newsSearch] Gemini response received (${text.length} chars), parsing...`);
    const cleaned = text.trim().replace(/^```json\s*|```\s*$/g, "").replace(/^```\s*|```\s*$/g, "");
    const translated = JSON.parse(cleaned);

    if (!Array.isArray(translated)) {
      console.error(`[newsSearch] Response is not array: ${typeof translated}`);
      return items;
    }
    if (translated.length !== items.length) {
      console.error(`[newsSearch] Array length mismatch: got ${translated.length}, expected ${items.length}`);
      return items;
    }

    const result = items.map((item, i) => ({
      ...item,
      title: typeof translated[i] === "string" && translated[i].trim() ? translated[i] : item.title,
    }));

    console.log(`[newsSearch] ✓ Translation successful: ${items.length} titles → ${targetLang}`);
    return result;
  } catch (err) {
    console.error(`[newsSearch] ✗ Translation failed for lang=${lang}:`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return items;
  }
}

// Fetch raw English articles from RSS without translating
async function fetchRawEnglishNews(query: string, maxItems: number, maxAgeMs: number): Promise<NewsItem[]> {
  let cleanQuery = query.trim();
  const isGlobalWorldNews = !cleanQuery || /world news|dünya|küresel|global|gündem/i.test(cleanQuery);
  
  if (isGlobalWorldNews) {
    cleanQuery = "world news today";
  }

  let rssUrl = "";
  if (cleanQuery === "world news today") {
    rssUrl = "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en";
  } else if (cleanQuery === "economy") {
    rssUrl = "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en";
  } else {
    const searchTopic = encodeURIComponent(cleanQuery);
    rssUrl = `https://news.google.com/rss/search?q=${searchTopic}&hl=en-US&gl=US&ceid=US:en`;
  }

  const res = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Google News RSS returned status ${res.status}`);

  const xml = await res.text();
  const items: NewsItem[] = [];
  const now = Date.now();

  const itemBlockRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemBlockRegex.exec(xml)) !== null && items.length < maxItems) {
    const itemContent = match[1];
    const titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>(.*?)<\/source>/);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
    const link = linkMatch[1].trim();
    const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
    const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "Reuters / WSJ";

    // Date check
    const parsedDate = new Date(pubDateStr).getTime();
    if (!isNaN(parsedDate) && now - parsedDate > maxAgeMs) {
      continue;
    }

    const titleLower = title.toLowerCase();
    const isForbidden = FORBIDDEN_WORDS.some((word) => titleLower.includes(word));

    if (!isForbidden) {
      items.push({ title, link, pubDate: pubDateStr, source });
    }
  }

  return items;
}

export async function fetchLiveMarketNews(query: string = "world news today", lang: string = "en"): Promise<NewsItem[]> {
  const cleanQuery = query.trim();
  const isGlobalWorldNews = !cleanQuery || /world news|dünya|küresel|global|gündem/i.test(cleanQuery);
  const now = Date.now();
  const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache lifetime!

  if (isGlobalWorldNews) {
    // Check global news cache
    const cacheAge = now - ((global as any)._newsCache?.lastUpdated || 0);
    if ((global as any)._newsCache?.translations[lang] && cacheAge < CACHE_TTL_MS) {
      console.log(`[newsSearch] Serving cached global news for lang=${lang} (cache age: ${Math.round(cacheAge / 1000)}s)`);
      return (global as any)._newsCache.translations[lang];
    }

    try {
      console.log(`[newsSearch] Cache expired or missing. Fetching fresh global news and translating to 5 languages...`);
      // Fetch English articles first to ensure exactly same articles in all languages
      const englishItems = await fetchRawEnglishNews("world news today", 12, 36 * 60 * 60 * 1000);
      
      if (englishItems.length > 0) {
        // Initialize cache object
        const newTranslations: Record<string, NewsItem[]> = { en: englishItems };

        // Translate to all other languages in parallel
        await Promise.all(
          ["tr", "es", "fr", "pt"].map(async (targetLocale) => {
            try {
              newTranslations[targetLocale] = await translateNewsTitles(englishItems, targetLocale);
            } catch (err) {
              console.error(`[newsSearch] Failed to translate global news to ${targetLocale}:`, err);
              newTranslations[targetLocale] = (global as any)._newsCache?.translations[targetLocale] || englishItems;
            }
          })
        );

        // Update global cache
        (global as any)._newsCache = {
          lastUpdated: now,
          translations: newTranslations,
        };

        return newTranslations[lang] || englishItems;
      }
    } catch (err) {
      console.error("[newsSearch] Failed to update global news cache:", err);
      // Serve stale cache if available, otherwise fallback
      if ((global as any)._newsCache?.translations[lang]) {
        console.log(`[newsSearch] Serving stale cached news for lang=${lang}`);
        return (global as any)._newsCache.translations[lang];
      }
    }

    return fallbackNews("world news today", lang);
  } else if (cleanQuery === "economy") {
    // Check economy news cache
    const cacheAge = now - ((global as any)._economyCache?.lastUpdated || 0);
    if ((global as any)._economyCache?.translations[lang] && cacheAge < CACHE_TTL_MS) {
      console.log(`[newsSearch] Serving cached economy news for lang=${lang} (cache age: ${Math.round(cacheAge / 1000)}s)`);
      return (global as any)._economyCache.translations[lang];
    }

    try {
      console.log(`[newsSearch] Economy cache expired or missing. Fetching fresh economy news and translating to 5 languages...`);
      const englishItems = await fetchRawEnglishNews("economy", 12, 36 * 60 * 60 * 1000);
      
      if (englishItems.length > 0) {
        const newTranslations: Record<string, NewsItem[]> = { en: englishItems };

        await Promise.all(
          ["tr", "es", "fr", "pt"].map(async (targetLocale) => {
            try {
              newTranslations[targetLocale] = await translateNewsTitles(englishItems, targetLocale);
            } catch (err) {
              console.error(`[newsSearch] Failed to translate economy news to ${targetLocale}:`, err);
              newTranslations[targetLocale] = (global as any)._economyCache?.translations[targetLocale] || englishItems;
            }
          })
        );

        (global as any)._economyCache = {
          lastUpdated: now,
          translations: newTranslations,
        };

        return newTranslations[lang] || englishItems;
      }
    } catch (err) {
      console.error("[newsSearch] Failed to update economy news cache:", err);
      if ((global as any)._economyCache?.translations[lang]) {
        console.log(`[newsSearch] Serving stale cached economy news for lang=${lang}`);
        return (global as any)._economyCache.translations[lang];
      }
    }

    return fallbackNews("economy", lang);
  } else {
    // Specific search (Sports or City News) -> Cache per query + lang pair
    const cacheKey = `${cleanQuery}:${lang}`;
    const cached = (global as any)._sportsCache?.cache[cacheKey];
    const cacheAge = now - (cached?.lastUpdated || 0);

    if (cached && cacheAge < CACHE_TTL_MS) {
      console.log(`[newsSearch] Serving cached query news for key=${cacheKey} (cache age: ${Math.round(cacheAge / 1000)}s)`);
      return cached.items;
    }

    try {
      console.log(`[newsSearch] Query news cache expired or missing for key=${cacheKey}. Fetching...`);
      const englishItems = await fetchRawEnglishNews(cleanQuery, 12, 7 * 24 * 60 * 60 * 1000);

      let result = englishItems;
      if (lang !== "en" && englishItems.length > 0) {
        result = await translateNewsTitles(englishItems, lang);
      }

      // Update sports cache
      if (!(global as any)._sportsCache) (global as any)._sportsCache = { cache: {} };
      (global as any)._sportsCache.cache[cacheKey] = {
        lastUpdated: now,
        items: result,
      };

      return result;
    } catch (err) {
      console.error(`[newsSearch] Failed to fetch or translate custom news for key=${cacheKey}:`, err);
      if (cached) {
        console.log(`[newsSearch] Serving stale cached query news for key=${cacheKey}`);
        return cached.items;
      }
    }

    return [];
  }
}

const FALLBACK_TITLES: Record<string, [string, string]> = {
  tr: [
    "Küresel Piyasalarda ve Dünya Genelinde Bugüne Dair Öne Çıkan Gelişmeler",
    "Son 24 Saat İçerisinde Dünyada Yaşanan Önemli Haber Başlıkları",
  ],
  en: [
    "Today's Latest Global Developments and Breaking News",
    "Important Headline News from Around the World in the Last 24 Hours",
  ],
  es: [
    "Últimos Desarrollos Globales de Hoy y Noticias de Última Hora",
    "Titulares Importantes de Todo el Mundo en las Últimas 24 Horas",
  ],
  fr: [
    "Derniers Développements Mondiaux du Jour et Dernières Nouvelles",
    "Principaux Titres de l'Actualité Mondiale au Cours des Dernières 24 Heures",
  ],
  pt: [
    "Últimos Desenvolvimentos Globais de Hoje e Notícias de Última Hora",
    "Principais Manchetes de Todo o Mundo nas Últimas 24 Horas",
  ],
};

function fallbackNews(query: string, lang: string = "en"): NewsItem[] {
  // If the query is specific (like "Raleigh Durham"), don't return global news as a fallback.
  // Returning an empty array lets the AI know it couldn't find anything, so it can give a proper response.
  if (query && !/world news|dünya|küresel|global|gündem/i.test(query)) {
    return [];
  }

  const [title1, title2] = FALLBACK_TITLES[lang] || FALLBACK_TITLES.en;
  return [
    {
      title: title1,
      source: "Reuters / Wall Street",
      pubDate: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" }) + " ET",
      link: "https://finance.yahoo.com",
    },
    {
      title: title2,
      source: "Bloomberg / Yahoo Finance",
      pubDate: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" }) + " ET",
      link: "https://news.google.com",
    },
  ];
}
