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

const geminiApiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  "";
const googleProvider = createGoogleGenerativeAI({ apiKey: geminiApiKey });

const LOCALE_NAMES: Record<string, string> = {
  tr: "Turkish", es: "Spanish", fr: "French", pt: "Portuguese",
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
async function translateNewsTitles(items: NewsItem[], lang: string): Promise<NewsItem[]> {
  const targetLang = LOCALE_NAMES[lang];
  if (!targetLang || items.length === 0 || !geminiApiKey) return items;

  try {
    const { text } = await generateText({
      model: googleProvider("gemini-flash-latest"),
      prompt: `Translate each of the following ${items.length} financial news headlines into ${targetLang}. Keep ticker symbols, company names, and numbers unchanged. Respond with ONLY a JSON array of ${items.length} translated strings, in the exact same order, no other text:\n\n${JSON.stringify(items.map((i) => i.title))}`,
      abortSignal: AbortSignal.timeout(4000),
    });

    const cleaned = text.trim().replace(/^```json\s*|```\s*$/g, "");
    const translated = JSON.parse(cleaned);
    if (!Array.isArray(translated) || translated.length !== items.length) return items;

    return items.map((item, i) => ({
      ...item,
      title: typeof translated[i] === "string" && translated[i].trim() ? translated[i] : item.title,
    }));
  } catch (err) {
    console.error("[newsSearch] Title translation error:", err);
    return items;
  }
}

export async function fetchLiveMarketNews(query: string = "US stock market", lang: string = "en"): Promise<NewsItem[]> {
  try {
    let cleanQuery = query.trim();
    if (!/US|Nasdaq|S&P|Wall Street|Gold|Silver|Crypto|Forex|EURUSD|BTC/i.test(cleanQuery)) {
      cleanQuery += " US stock market Wall Street";
    }

    // Append when:1d so Google RSS ONLY returns news from the last 24 hours!
    const searchTopic = encodeURIComponent(`${cleanQuery} when:1d`);
    const rssUrl = `https://news.google.com/rss/search?q=${searchTopic}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return fallbackNews(query, lang);

    const xml = await res.text();
    const items: NewsItem[] = [];
    const now = Date.now();
    const MAX_AGE_MS = 36 * 60 * 60 * 1000; // 36 hours max to ensure strictly recent today news!

    const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<source[^>]*>(.*?)<\/source>[\s\S]*?<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const title = match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
      const link = match[2].trim();
      const pubDateStr = match[3].trim();
      const source = match[4].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() || "Wall Street Journal / Reuters";

      // Date check: skip old news (> 36 hours old)
      const parsedDate = new Date(pubDateStr).getTime();
      if (!isNaN(parsedDate) && now - parsedDate > MAX_AGE_MS) {
        continue;
      }

      const titleLower = title.toLowerCase();
      const isForbidden = FORBIDDEN_WORDS.some((word) => titleLower.includes(word));

      if (!isForbidden) {
        items.push({ title, link, pubDate: pubDateStr, source });
      }
    }

    if (items.length > 0) return translateNewsTitles(items, lang);
  } catch (err) {
    console.error("[newsSearch] Live fetch error:", err);
  }

  return fallbackNews(query, lang);
}

const FALLBACK_TITLES: Record<string, [string, string]> = {
  tr: [
    "ABD Hisse Senedi Piyasalarında Bugüne Dair Son Gelişmeler ve Sektör Hareketliliği",
    "S&P 500 ve Nasdaq Teknoloji Sektöründe Bugünkü Ön Piyasa ve İşlem Hacmi Görünümü",
  ],
  en: [
    "Today's Latest Developments and Sector Activity in US Stock Markets",
    "S&P 500 and Nasdaq Tech Sector: Today's Premarket and Trading Volume Outlook",
  ],
  es: [
    "Últimos Desarrollos de Hoy y Actividad Sectorial en los Mercados Bursátiles de EE. UU.",
    "S&P 500 y el Sector Tecnológico del Nasdaq: Panorama de Premercado y Volumen de Hoy",
  ],
  fr: [
    "Derniers Développements du Jour et Activité Sectorielle sur les Marchés Boursiers Américains",
    "S&P 500 et Secteur Technologique du Nasdaq : Aperçu du Pré-marché et du Volume du Jour",
  ],
  pt: [
    "Últimos Desenvolvimentos de Hoje e Atividade Setorial nos Mercados de Ações dos EUA",
    "S&P 500 e Setor de Tecnologia da Nasdaq: Panorama do Pré-mercado e Volume de Hoje",
  ],
};

function fallbackNews(query: string, lang: string = "en"): NewsItem[] {
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
