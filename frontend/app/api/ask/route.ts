import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { MARKET_THEMES } from "../../../lib/themeData";
import { calculateTradePlanZones, buildTradePlanRationale } from "@/lib/tradePlanEngine";
import { hasAnyAuth } from "@/lib/apiAuth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Herkese açık /graphic sayfaları buraya tek ticker'lık önizleme için
// kimliksiz istek atar (bilinçli tasarım) — ama her istek gerçek Gemini/Claude
// çağrısı tetikleyebildiği için IP başına gevşek bir üst sınır şart.
const ASK_MAX_REQUESTS = 40;
const ASK_WINDOW_MS = 15 * 60 * 1000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FINANCIAL_KEYWORDS = [
  "stock", "price", "market", "nasdaq", "nyse", "dow", "s&p", "vix", "spy", "ema",
  "rsi", "macd", "swing", "trade", "option", "call", "put", "gold", "oil", "forex",
  "crypto", "bitcoin", "ethereum", "bond", "yield", "dividend", "earnings", "pe",
  "ipo", "etf", "sector", "momentum", "breakout", "resistance", "support", "bollinger",
  "stochastic", "adx", "atr", "volume", "open interest", "volatility", "delta", "gamma",
  "theta", "vega", "hisse", "borsa", "endeks", "altın", "petrol", "dolar", "euro",
  "para", "ekonomi", "enflasyon", "faiz", "merkez bankası", "fed", "ecb", "turkey",
  "türkiye", "bist", "xauusd", "wti", "brent", "nasdaq100", "russell", "hang seng",
  "nikkei", "dax", "ftse", "cac", "stoxx", "sensex", "kospi", "asx", "shanghai",
  "bull", "bear", "hedge", "spread", "collar", "straddle", "strangle", "scalp",
];

const OUT_OF_SCOPE_KEYWORDS = [
  "recipe", "cook", "movie", "game", "music", "song", "joke", "entertainment",
  "sports", "football", "basketball", "tennis", "weather", "history", "biology",
];

const MAGNIFICENT_7_PROMPT = `
Sen bir finansal piyasa analiz asistanısın.
Aşağıdaki Magnificent 7 hisselerini analiz et:
AAPL (Apple), NVDA (Nvidia), MSFT (Microsoft), AMZN (Amazon), GOOGL (Alphabet), META (Meta Platforms), TSLA (Tesla)

Her hisse için Yahoo Finance üzerinden aşağıdaki verileri sorgula ve raporla (gerçek zamanlı verileri simüle et veya bildiğin en güncel veriyi kullan):

📊 VERİ NOKTALARI
- Anlık fiyat ve günlük değişim (% ve $)
- Günlük işlem hacmi ve 10 günlük ortalama hacme oranı (RVOL)
- 52 hafta yüksek/düşük ve mevcut fiyatın bu aralıktaki konumu
- Bugünkü en önemli 2-3 haber başlığı ve kısa özeti

📋 HER HİSSE İÇİN FORMAT
### [TICKER] — [Şirket]
💰 Fiyat     : $X.XX  (%X.X bugün)
📦 Hacim     : X.XM  (RVOL: X.Xx)
📍 52H Konum : $XX (düşük) — ► şu an — $XX (yüksek)
📰 Haberler  :
   • [Başlık] — [1 cümle özet, sentiment: 🟢/🟡/🔴]
   • [Başlık] — [1 cümle özet, sentiment: 🟢/🟡/🔴]
⚡ Genel Durum: [Güçlü / Nötr / Zayıf] — [1 cümle gerekçe]

📊 ÖZET TABLO (en sona)
| Ticker | Fiyat | Değişim | RVOL | 52H Konum | Durum  |
|--------|-------|---------|------|-----------|--------|
...
Tabloyu günlük değişime göre büyükten küçüğe sırala.

⚠️ KURALLAR
- Yanıt Türkçe olsun.
- Sadece bugünün verilerini kullan, tahmin yapma.
- Alım/satım tavsiyesi verme.
- Veri eksikse "N/A" yaz.
`;

const SECTOR_ANALYSIS_PROMPT = `
Sen bir finansal piyasa analiz asistanısın.
ABD borsasının tüm ana sektörlerini bugünkü verilerle analiz et.
Her sektörü temsil eden SPDR ETF'leri baz al:
XLK (Teknoloji), XLY (Tüketici Döngüsel), XLF (Finans), XLV (Sağlık), XLI (Sanayi), XLC (İletişim), XLB (Hammadde), XLRE (Gayrimenkul), XLP (Savunmacı Tüketici), XLU (Kamu Hizmetleri), XLE (Enerji)

📋 HER SEKTÖR İÇİN FORMAT
### [ETF] — [Sektör Adı]
💰 Fiyat      : $X.XX  (Günlük: %X.X | Haftalık: %X.X | Aylık: %X.X)
📦 RVOL       : X.Xx  (Hacim ivmesi: Güçlü / Normal / Zayıf)
📍 52H Konum  : %XX (0=dip, 100=zirve)
📰 Katalizör  : [Sektörü bugün etkileyen en önemli gelişme — 1-2 cümle]
🏷️ Rejim      : [🔥 Lider / 📈 Güçlü / ➖ Nötr / 📉 Zayıf / 🥶 Kaçınılan]

📊 SEKTÖR ROTASYON HARİTASI (en sona)
1) PERFORMANS SIRALAMASI — Günlük değişime göre tablo (Ticker, Sektör, Günlük, Haftalık, Aylık, RVOL, Rejim)
2) PARA AKIŞI YORUMU — 3-4 cümle (Para nereye akıyor? Satış baskısı nerede? Risk iştahı nasıl?)

⚠️ KURALLAR
- Yanıt Türkçe olsun.
- Alım/satım tavsiyesi verme.
`;

const SYSTEM_PROMPT = `You are BOGA AI, financial analyst for global markets.

BOGA AI KİMLİK VE TANIM BİLGİSİ:
Kullanıcı BOGA AI'ın ne olduğunu sorduğunda veya sistem hakkında bilgi talep ettiğinde MUTLAKA aşağıdaki bilgileri içeren net, açıklayıcı ve güncel bir yanıt ver:
- BOGA AI; AFK DaSYS tarafından geliştirilen, ABD Borsaları (US Stock Markets) odaklı, öğrenme ve kendini geliştirme süreci kesintisiz olarak devam eden yapay zeka destekli bir interactive charts sistemidir.
- Türkçe dahil +50 dil desteği ile geliştirilmekte ve küresel piyasalarda analiz yapabilmektedir.

EXPERTISE: Stocks, options, technical analysis (EMA, RSI, MACD), commodities, forex, crypto, economics.

IMPORTANT - DO NOT MENTION:
- Claude, Claude AI, Anthropic
- Gemini, Google AI
- Any AI model names or source attribution

GUIDELINES:
1. Answer in user's language (Default: Turkish)
2. Be concise, data-driven, professional
3. Use bullet points
4. Provide analysis directly
5. Be specific about technical levels and indicators

For out-of-scope questions, politely redirect in user's language.`;

function getDynamicSystemPrompt(lang: "tr" | "en" | "pt" = "tr"): string {
  const masterPaths = [
    path.join(process.cwd(), "..", "data", "latest", "master.json"),
    path.join(process.cwd(), "data", "latest", "master.json"),
    path.join(process.cwd(), "..", "..", "data", "latest", "master.json"),
    path.resolve(__dirname, "..", "..", "..", "..", "data", "latest", "master.json"),
  ];
  let masterJson: any = null;
  for (const p of masterPaths) {
    try {
      if (fs.existsSync(p)) {
        masterJson = JSON.parse(fs.readFileSync(p, "utf-8"));
        break;
      }
    } catch {}
  }

  let dataSummary = "";
  if (masterJson) {
    const regime = masterJson.market_regime || "Neutral";
    
    // Extract top picks
    const breakout = masterJson.menus?.breakout?.tickers?.slice(0, 10) || [];
    const momentum = masterJson.menus?.momentum?.tickers?.slice(0, 10) || [];
    const reversal = masterJson.menus?.reversal?.tickers?.slice(0, 10) || [];
    const value = masterJson.menus?.value?.tickers?.slice(0, 10) || [];
    const dividend = masterJson.menus?.dividend?.tickers?.slice(0, 10) || [];

    // Extract sector summaries
    const sectors = Object.entries(masterJson.sector_summary || {}).map(([name, data]: [string, any]) => {
      const topTickers = data.top_tickers?.slice(0, 8) || [];
      return `- ${name}: Ortalama Skor ${data.avg_score}/100, Lider Hisse: ${data.top_ticker || "N/A"} (Öne Çıkan Hisseler: ${topTickers.join(", ")})`;
    }).join("\n");

    dataSummary = `
BUGÜNÜN REEL PİYASA VE BOGA AI TERMİNAL VERİLERİ (Veri Tarihi: ${masterJson.date || "Güncel"}):
- Piyasa Rejimi (Market Regime): ${regime}
- BOGA AI Kırılım (Breakout) Tercihleri: ${breakout.join(", ")}
- BOGA AI Momentum Tercihleri: ${momentum.join(", ")}
- BOGA AI Dönüş (Reversal) Tercihleri: ${reversal.join(", ")}
- BOGA AI Değer (Value) Tercihleri: ${value.join(", ")}
- BOGA AI Temettü (Dividend) Tercihleri: ${dividend.join(", ")}

SEKTÖR BAZINDA GÜNCEL BULGULAR VE EN İYİ HİSSELER:
${sectors}
`;
  }

  const langDirective = lang === "en"
    ? "\nLANGUAGE OVERRIDE: Always respond in English, regardless of how short or ambiguous the user's message is (e.g. a bare ticker symbol). Do not default to Turkish.\n"
    : lang === "pt"
    ? "\nLANGUAGE OVERRIDE: Always respond in Brazilian Portuguese (pt-BR), regardless of how short or ambiguous the user's message is (e.g. a bare ticker symbol). Do not default to Turkish or English.\n"
    : "\nDİL KURALI: Kullanıcının mesajı ne kadar kısa veya belirsiz olursa olsun (örn. sadece bir ticker sembolü) her zaman Türkçe yanıt ver.\n";

  return `${SYSTEM_PROMPT}
${langDirective}
${dataSummary}

KRİTİK TALİMATLAR VE YÖNLENDİRME KURALLARI:
1. BOGA AI Terminali'ndeki günlük seçimleri (picks) veya taramaları doğrudan sormayan genel sektörel/konusal sorularda (Örn: "son zamanlarda yükselen enerji hisseleri", "çip hisseleri" vb.) yukarıdaki BOGA AI terminal verilerini/listelerini referans alma veya önerme. Bunun yerine, Gemini/Claude işbirliğiyle sana iletilen [SİSTEM TARAFINDAN SAĞLANAN GÜNCEL HABERLER] verilerindeki canlı haberleri ve orada geçen hisseleri temel alarak yanıt üret. Sadece kullanıcı doğrudan BOGA AI terminal verilerini, günlük tarama listelerini veya top picks seçimlerini sorduğunda yukarıdaki BOGA AI terminal listelerini referans al.
2. Önerdiğin ya da metin içinde adı geçen her hisse senedinin ticker sembolünü MUTLAKA şu markdown formatında tıklandığında analiz tetikleyecek link olarak yaz: [TICKER](/ai?ticker=TICKER) (Örneğin: [AAPL](/ai?ticker=AAPL), [NVDA](/ai?ticker=NVDA), [DELL](/ai?ticker=DELL)). Ticker dışında başka hiçbir kelimeye veya açıklamaya bu linki ekleme. Sadece ticker sembolüne ekle.
3. Kullanıcı belirli bir hissenin detaylı analizini, teknik seviyelerini, destek/direnç, EMA 200 veya Monte Carlo simülasyonunu görmek istediğinde, doğrudan o hissenin ticker butonuna tıklamasını söyle veya analiz butonunu sun.
   Tıklanan her ticker butonu, arayüzde BOGA AI detaylı teknik analiz rapor formatını (şablonunu) otomatik olarak tetikleyecektir. Bunu kullanıcıya belirtebilirsin.`;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

const getLatestSwingPicks = () => {
  try {
    const candidates: string[] = [];
    
    // 1. process.cwd() based
    candidates.push(path.join(process.cwd(), "public/data/swing2026"));
    candidates.push(path.join(process.cwd(), "frontend/public/data/swing2026"));
    
    // 2. __dirname based (reliable on Vercel)
    // frontend/app/api/ask/route.ts -> ../../../../public/data/swing2026
    const dirBase = path.resolve(__dirname, "..", "..", "..", "..");
    candidates.push(path.join(dirBase, "public", "data", "swing2026"));
    
    // 3. One more level up for safety
    candidates.push(path.join(dirBase, "..", "public", "data", "swing2026"));

    for (const dataDir of candidates) {
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir).filter(f => f.startsWith("swing_") && f.endsWith(".json"));
        if (files.length > 0) {
          files.sort((a, b) => b.localeCompare(a)); // Newest first
          const latestFile = path.join(dataDir, files[0]);
          return JSON.parse(fs.readFileSync(latestFile, "utf-8"));
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Error reading swing picks:", e);
    return null;
  }
};

function translateQueryToEnglish(query: string): string {
  let q = query.toLowerCase();
  const replacements: Record<string, string> = {
    "enerji": "energy",
    "teknoloji": "technology",
    "hisseleri": "stocks",
    "hisse": "stock",
    "haberleri": "news",
    "haberi": "news",
    "haber": "news",
    "finans": "finance",
    "yapay zeka": "ai",
    "yarı iletken": "semiconductor",
    "çip": "chip",
    "sağlık": "healthcare",
    "havacılık": "aviation",
    "savunma": "defense",
    "otomotiv": "automotive",
    "banka": "bank",
    "bankacılık": "banking",
    "tarım": "agriculture",
    "altın": "gold",
    "petrol": "oil",
    "emtia": "commodities",
    "yükselen": "rising",
    "düşen": "falling",
    "kazandıran": "gaining",
    "kaybettiren": "losing",
    "en iyi": "best",
    "popüler": "popular",
    "siber": "cyber",
    "güvenlik": "security",
    "uzay": "space"
  };
  for (const [tr, en] of Object.entries(replacements)) {
    q = q.replace(new RegExp(tr, "g"), en);
  }
  return q;
}

function findMatchingThemes(query: string): any[] {
  const q = query.toLowerCase();
  const matched: any[] = [];
  
  const mappings: Record<string, string[]> = {
    "siber": ["cybersecurity"],
    "cyber": ["cybersecurity"],
    "güvenlik": ["cybersecurity"],
    "uzay": ["aerospace & defense"],
    "space": ["aerospace & defense"],
    "havacılık": ["aerospace & defense", "transportation - airlines", "aviation mro"],
    "aviation": ["aerospace & defense", "aviation mro"],
    "savunma": ["aerospace & defense"],
    "defense": ["aerospace & defense"],
    "enerji": ["energy", "integrated majors - us", "e&p - us", "oilfield services", "refining & marketing", "midstream & pipeline - us", "lng & shipping", "renewables", "uranium (nükleer talep)"],
    "energy": ["energy", "integrated majors - us", "e&p - us", "oilfield services", "refining & marketing", "midstream & pipeline - us", "lng & shipping", "renewables", "uranium (nükleer talep)"],
    "teknoloji": ["technology", "mega-cap platform & cloud", "semiconductors & hardware", "software & cloud applications", "ai & data", "infrastructure & networking", "hardware & devices"],
    "technology": ["technology", "mega-cap platform & cloud", "semiconductors & hardware", "software & cloud applications", "ai & data", "infrastructure & networking", "hardware & devices"],
    "çip": ["semiconductors & hardware"],
    "chip": ["semiconductors & hardware"],
    "yarı iletken": ["semiconductors & hardware"],
    "semiconductor": ["semiconductors & hardware"],
    "yazılım": ["software & cloud applications"],
    "software": ["software & cloud applications"],
    "yapay zeka": ["ai & data"],
    "ai": ["ai & data"],
    "sağlık": ["healthcare", "large-cap pharma - us", "medical devices & equipment", "diagnostics & services", "health insurance & services"],
    "healthcare": ["healthcare", "large-cap pharma - us", "medical devices & equipment", "diagnostics & services", "health insurance & services"],
    "ilaç": ["large-cap pharma - us", "large-cap pharma - global"],
    "pharma": ["large-cap pharma - us", "large-cap pharma - global"],
    "finans": ["financials", "money-center banks - us", "investment banking & asset management", "payment networks", "brokerage & exchange", "fintech & crypto"],
    "financial": ["financials", "money-center banks - us", "investment banking & asset management", "payment networks", "brokerage & exchange", "fintech & crypto"],
    "banka": ["money-center banks - us", "money-center banks - canada", "money-center banks - europe/asia", "regional banks - us"],
    "bank": ["money-center banks - us", "money-center banks - canada", "money-center banks - europe/asia", "regional banks - us"],
    "kripto": ["fintech & crypto"],
    "crypto": ["fintech & crypto"],
    "e-ticaret": ["e-commerce & marketplace"],
    "ecommerce": ["e-commerce & marketplace"],
    "otomotiv": ["automotive & ev"],
    "auto": ["automotive & ev"],
    "elektrikli araç": ["automotive & ev"],
    "ev": ["automotive & ev"],
    "ulaşım": ["transportation - rail", "transportation - parcel & air", "transportation - trucking", "transportation - airlines"],
    "transport": ["transportation - rail", "transportation - parcel & air", "transportation - trucking", "transportation - airlines"],
    "havayolu": ["transportation - airlines"],
    "airline": ["transportation - airlines"],
    "altın": ["gold mining"],
    "gold": ["gold mining"],
    "gümüş": ["silver mining"],
    "silver": ["silver mining"],
    "bakır": ["copper & base metals"],
    "copper": ["copper & base metals"],
    "maden": ["diversified mining", "gold mining", "silver mining", "copper & base metals", "lithium & battery metals"],
    "mining": ["diversified mining", "gold mining", "silver mining", "copper & base metals", "lithium & battery metals"],
    "lityum": ["lithium & battery metals"],
    "lithium": ["lithium & battery metals"],
    "petrol": ["integrated majors - us", "e&p - us", "oilfield services", "refining & marketing", "midstream & pipeline - us"],
    "oil": ["integrated majors - us", "e&p - us", "oilfield services", "refining & marketing", "midstream & pipeline - us"],
    "gaz": ["integrated majors - us", "e&p - us", "midstream & pipeline - us", "lng & shipping"],
    "gas": ["integrated majors - us", "e&p - us", "midstream & pipeline - us", "lng & shipping"],
    "yenilenebilir": ["renewables"],
    "renewable": ["renewables"],
    "uranyum": ["uranium (nükleer talep)"],
    "uranium": ["uranium (nükleer talep)"],
    "gıda": ["food & snacks", "food service distribution"],
    "food": ["food & snacks", "food service distribution"],
    "perakende": ["retail", "retail / wholesale"],
    "retail": ["retail", "retail / wholesale"]
  };

  const matchedNames = new Set<string>();
  for (const [key, targetThemes] of Object.entries(mappings)) {
    if (q.includes(key)) {
      for (const t of targetThemes) {
        matchedNames.add(t.toLowerCase());
      }
    }
  }

  for (const theme of MARKET_THEMES) {
    const tName = theme.name.toLowerCase();
    const tSector = theme.sector.toLowerCase();
    if (q.includes(tName) || q.includes(tSector) || matchedNames.has(tName) || matchedNames.has(tSector)) {
      matched.push(theme);
    }
  }
  return matched;
}


async function searchGoogleNews(query: string, lang = "tr"): Promise<any[]> {
  const hl = lang === "tr" ? "tr" : "en-US";
  const gl = lang === "tr" ? "TR" : "US";
  const ceid = lang === "tr" ? "TR:tr" : "US:en";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  };
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const xml = await res.text();
      const items: any[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
        const sourceMatch = itemContent.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/);
        if (titleMatch && titleMatch[1]) {
          const title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
          const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
          const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "Google News";
          items.push({
            title,
            publisher: source,
            link,
            entities: []
          });
        }
      }
      return items;
    }
  } catch (err: any) {
    console.error("searchGoogleNews error:", err.message);
  }
  return [];
}

async function fetchGlobalMarketNews(userQuery?: string, matchedThemes: any[] = []): Promise<any[]> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://finance.yahoo.com/"
  };

  const queries = ["market outlook"];
  
  if (matchedThemes && matchedThemes.length > 0) {
    matchedThemes.forEach(t => {
      queries.unshift(`${t.name} stocks`);
      const trName = t.name.toLowerCase() === "cybersecurity" ? "siber güvenlik" :
                     t.name.toLowerCase().includes("aerospace") ? "uzay" : t.name;
      queries.unshift(`${trName} hisseleri`);
      if (t.tickers && t.tickers.length > 0) {
        t.tickers.slice(0, 3).forEach((tic: string) => {
          queries.unshift(`${tic} stock news`);
        });
      }
    });
  }

  if (userQuery) {
    const clean = userQuery.replace(/[/?.,!#*()]/g, " ").trim();
    const stopWords = ["neler", "almalıyım", "hangileri", "ne", "nedir", "nelerdir", "önerirsiniz", "tavsiye", "edersiniz", "hakkında", "analiz", "yorumu", "hisselerinden", "hisseleri", "hissesi", "stocks", "stock"];
    const keywords = clean.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w.toLowerCase()));
    if (keywords.length > 0) {
      const searchTerms = keywords.join(" ");
      queries.unshift(searchTerms);
      const translated = translateQueryToEnglish(searchTerms);
      if (translated !== searchTerms) {
        queries.unshift(translated);
      }
    }
  } else {
    queries.push("stock news", "breaking business news");
  }

  const newsItems: any[] = [];
  const titles = new Set<string>();

  // Parallel Google News fetching
  const primaryQueries = Array.from(new Set(queries)).slice(0, 5);
  for (const q of primaryQueries) {
    try {
      const [gTr, gEn] = await Promise.all([
        searchGoogleNews(q, "tr"),
        searchGoogleNews(q, "en")
      ]);
      for (const item of [...gTr, ...gEn]) {
        const cleanTitle = item.title.toLowerCase();
        if (item.title && !titles.has(cleanTitle)) {
          titles.add(cleanTitle);
          newsItems.push(item);
        }
      }
    } catch (e: any) {
      console.error(`Google News fetch failed for: ${q}`, e.message);
    }
  }

  // Fetch from Yahoo Finance Search
  for (const q of primaryQueries) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=15`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const items = data?.news || [];
        for (const item of items) {
          const cleanTitle = item.title.toLowerCase();
          if (item.title && !titles.has(cleanTitle)) {
            titles.add(cleanTitle);
            newsItems.push({
              title: item.title,
              publisher: item.publisher || "Yahoo Finance",
              link: item.link || "",
              entities: item.relatedTickers || []
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`fetchGlobalMarketNews error for query "${q}":`, err.message);
    }
  }
  return newsItems.slice(0, 25);
}

function calcEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  let sum = 0;
  for (let i = trs.length - period; i < trs.length; i++) {
    sum += trs[i];
  }
  return sum / period;
}

// calculateSupportResistance1h buradan lib/tradePlanEngine.ts'e tasindi
// (calculateTradePlanZones olarak) — preorder-analysis/route.ts (grafik
// sayfasi) ile ayni motoru paylassinlar diye. Ayrica Python uretim
// motoruyla (swing117_boga.py) ayni %5 stop tabani da eklendi.

function check15mMicroTrend(
  closes15m: number[] | null,
  opens15m: number[] | null,
  highs15m: number[] | null
) {
  if (!closes15m || !opens15m || !highs15m || closes15m.length < 8) {
    return { is_valid: true, score_bonus: 0.0, msg: "⚠️ 15m veri yetersiz (nötr)" };
  }

  // Get last 8 candles (recent 2 hours)
  const c = closes15m.slice(-8);
  const o = opens15m.slice(-8);
  const h = highs15m.slice(-8);

  const net_change_pct = ((c[7] - c[0]) / c[0]) * 100;
  let green_candles = 0;
  for (let i = 0; i < 8; i++) {
    if (c[i] > o[i]) green_candles++;
  }

  // Lower highs check: h[7] < h[5] and h[5] < h[2]
  const is_bleeding = (h[7] < h[5]) && (h[5] < h[2]);

  if (net_change_pct < -1.0 && green_candles <= 3 && is_bleeding) {
    return { is_valid: false, score_bonus: -10.0, msg: "🚨 15m KANAMA: Son 2 saatte yoğun dağıtım (İptal)" };
  }

  if (net_change_pct > 0.5 && green_candles >= 5) {
    return { is_valid: true, score_bonus: 4.0, msg: `🔥 15m ONAY: Son 2 saat net trend (+${net_change_pct.toFixed(2)}%)` };
  }

  if (net_change_pct < 0 && green_candles < 4) {
    return { is_valid: true, score_bonus: -2.0, msg: "⚠️ 15m Uyarı: Son 2 saat yön aşağı" };
  }

  return { is_valid: true, score_bonus: 1.0, msg: "⚖️ 15m Yatay/Sıkışma: Gürültü yok" };
}

interface ForecastDay {
  day: number;
  date: string;
  bearish: number;
  base: number;
  bullish: number;
  probabilityOfProfit: number;
}

function generateBogaSimulation(
  currentPrice: number,
  atrPct: number,
  masterScore: number,
  emaStackBullish: boolean,
  rsi: number,
  cmf: number,
  targetPrice: number,
  stopLoss: number
): { daily: ForecastDay[]; milestones: Record<string, ForecastDay> } {
  // Akıllı sınırlar ve varsayılanlar
  const tp = targetPrice && targetPrice > currentPrice ? targetPrice : currentPrice * 1.15;
  const sl = stopLoss && stopLoss < currentPrice ? stopLoss : currentPrice * 0.93;

  // 1. Zımni Swing Getirisini Hesapla (Mevcut Fiyat -> Hedef Fiyat)
  const rawSwingReturn = (tp - currentPrice) / currentPrice;
  
  // Sinyal gücüne (Master Score) göre bu getiri katsayısını ölçekle
  const scoreFactor = Math.pow(masterScore / 100, 1.2); 
  const expectedSwingReturn = rawSwingReturn * scoreFactor; 
  
  // 20 işlem günü (28 takvim günü) için günlük drift
  const dailyDrift = Math.log(1 + expectedSwingReturn) / 20;

  // Oynaklığı (dailyVol) ATR ve stop loss mesafesine göre kalibre et
  const stopLossReturn = (sl - currentPrice) / currentPrice;
  const baseDailyVol = (atrPct / 100) / Math.sqrt(252);
  const impliedVol = Math.abs(stopLossReturn) / Math.sqrt(20);
  const dailyVol = (baseDailyVol * 0.3) + (impliedVol * 0.7);

  const numPaths = 1000;
  const daysToForecast = 28;
  const paths: number[][] = Array.from({ length: numPaths }, () => []);

  // 2. Monte Carlo Yollarını Simüle Et
  for (let p = 0; p < numPaths; p++) {
    let price = currentPrice;
    for (let d = 0; d < daysToForecast; d++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const rand = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      price = price * Math.exp((dailyDrift - 0.5 * Math.pow(dailyVol, 2)) + dailyVol * rand);
      paths[p].push(price);
    }
  }

  // 3. Yüzdelik Dilimleri Hesapla
  const getPercentile = (arr: number[], percentile: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor(percentile * (sorted.length - 1));
    return sorted[index];
  };

  const dailyForecasts: ForecastDay[] = [];
  const today = new Date();

  for (let d = 0; d < daysToForecast; d++) {
    const dayPrices = paths.map(path => path[d]);
    const bearish = getPercentile(dayPrices, 0.10);
    const base = getPercentile(dayPrices, 0.50);
    const bullish = getPercentile(dayPrices, 0.90);
    const profitPaths = dayPrices.filter(p => p > currentPrice).length;
    const probabilityOfProfit = Math.round((profitPaths / numPaths) * 100);

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + d + 1);

    dailyForecasts.push({
      day: d + 1,
      date: targetDate.toISOString().split('T')[0],
      bearish: parseFloat(bearish.toFixed(2)),
      base: parseFloat(base.toFixed(2)),
      bullish: parseFloat(bullish.toFixed(2)),
      probabilityOfProfit
    });
  }

  return {
    daily: dailyForecasts.slice(0, 7),
    milestones: {
      "14d": dailyForecasts[13],
      "21d": dailyForecasts[20],
      "28d": dailyForecasts[27]
    }
  };
}

async function fetchYahooWithCrumb(ticker: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
  };
  try {
    const fcRes = await fetch("https://fc.yahoo.com", { headers, signal: AbortSignal.timeout(4000) });
    const setCookie = fcRes.headers.get("set-cookie");
    if (!setCookie) return null;
    const cookieMatch = setCookie.match(/A3=[^;]+/);
    if (!cookieMatch) return null;
    const cookie = cookieMatch[0];
    headers["Cookie"] = cookie;

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers, signal: AbortSignal.timeout(4000) });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;

    const quoteUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,assetProfile,financialData,defaultKeyStatistics&crumb=${crumb}`;
    const quoteRes = await fetch(quoteUrl, { headers, signal: AbortSignal.timeout(6000) });
    if (!quoteRes.ok) return null;
    return await quoteRes.json();
  } catch (err: any) {
    console.error(`fetchYahooWithCrumb failed for ${ticker}:`, err.message);
    return null;
  }
}

async function fetchYahooLive(ticker: string) {
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=252d&interval=1d`;
    const chart1hUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10d&interval=1h`;
    const chart15mUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=15m`;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://finance.yahoo.com/"
    };

    const [chartRes, chart1hRes, chart15mRes, quoteSummary] = await Promise.all([
      fetch(chartUrl, { headers, signal: AbortSignal.timeout(10000) }),
      fetch(chart1hUrl, { headers, signal: AbortSignal.timeout(10000) }).catch(() => null),
      fetch(chart15mUrl, { headers, signal: AbortSignal.timeout(10000) }).catch(() => null),
      fetchYahooWithCrumb(ticker)
    ]);

    if (!chartRes.ok) return null;

    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    
    const rawCloses = quote.close || [];
    const rawOpens = quote.open || [];
    const rawHighs = quote.high || [];
    const rawLows = quote.low || [];
    const rawVolumes = quote.volume || [];

    const closes: number[] = [];
    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] !== null && rawOpens[i] !== null && rawHighs[i] !== null && rawLows[i] !== null) {
        closes.push(rawCloses[i]);
        opens.push(rawOpens[i]);
        highs.push(rawHighs[i]);
        lows.push(rawLows[i]);
        volumes.push(rawVolumes[i] || 0);
      }
    }

    if (closes.length < 50) return null;

    const currentPrice = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] || currentPrice;
    const changePct = ((currentPrice - prevClose) / prevClose) * 100;

    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const emaStackBullish = (ema20 > ema50) && (ema50 > ema200);

    const rsi14 = calcRSI(closes, 14);

    const last5dVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const last30dVol = volumes.slice(-30).reduce((a, b) => a + b, 0) / 30;
    const rvol = last30dVol > 0 ? last5dVol / last30dVol : 1.0;

    const high52w = Math.max(...highs);
    const low52w = Math.min(...lows);

    // 1-Hour micro-timing calculation
    let closes1h: number[] | null = null;
    let highs1h: number[] | null = null;
    let lows1h: number[] | null = null;
    let opens1h: number[] | null = null;
    let volumes1h: number[] | null = null;

    if (chart1hRes && chart1hRes.ok) {
      try {
        const c1hData = await chart1hRes.json();
        const res1h = c1hData?.chart?.result?.[0];
        if (res1h) {
          const q1h = res1h.indicators?.quote?.[0] || {};
          const rCl1h = q1h.close || [];
          const rOp1h = q1h.open || [];
          const rHi1h = q1h.high || [];
          const rLo1h = q1h.low || [];
          const rVo1h = q1h.volume || [];

          closes1h = [];
          highs1h = [];
          lows1h = [];
          opens1h = [];
          volumes1h = [];

          for (let i = 0; i < rCl1h.length; i++) {
            if (rCl1h[i] !== null && rOp1h[i] !== null && rHi1h[i] !== null && rLo1h[i] !== null) {
              closes1h.push(rCl1h[i]);
              opens1h.push(rOp1h[i]);
              highs1h.push(rHi1h[i]);
              lows1h.push(rLo1h[i]);
              volumes1h.push(rVo1h[i] || 0);
            }
          }
        }
      } catch (err) {
        console.error("1h chart parse error:", err);
      }
    }

    // 15-Minute micro-direction calculation
    let closes15m: number[] | null = null;
    let opens15m: number[] | null = null;
    let highs15m: number[] | null = null;

    if (chart15mRes && chart15mRes.ok) {
      try {
        const c15mData = await chart15mRes.json();
        const res15m = c15mData?.chart?.result?.[0];
        if (res15m) {
          const q15m = res15m.indicators?.quote?.[0] || {};
          const rCl15m = q15m.close || [];
          const rOp15m = q15m.open || [];
          const rHi15m = q15m.high || [];

          closes15m = [];
          opens15m = [];
          highs15m = [];

          for (let i = 0; i < rCl15m.length; i++) {
            if (rCl15m[i] !== null && rOp15m[i] !== null && rHi15m[i] !== null) {
              closes15m.push(rCl15m[i]);
              opens15m.push(rOp15m[i]);
              highs15m.push(rHi15m[i]);
            }
          }
        }
      } catch (err) {
        console.error("15m chart parse error:", err);
      }
    }

    const zones = calculateTradePlanZones(
      closes,
      highs,
      lows,
      closes1h,
      highs1h,
      lows1h,
      opens1h,
      volumes1h,
      currentPrice
    );

    // Gun ici VWAP yaklasik degeri — 15m kapanislarinin son ~2 saatlik
    // ortalamasi (preorder-analysis/route.ts'deki ayni yaklasim, gercek
    // hacim-agirlikli VWAP icin 15m hacim verisi bu akiste tutulmuyor).
    const vwapApprox = closes15m && closes15m.length > 0
      ? closes15m.slice(-26).reduce((a, b) => a + b, 0) / Math.min(26, closes15m.length)
      : currentPrice;

    const tradeRationale = buildTradePlanRationale({
      price: currentPrice, ema20, ema50, ema200, vwap: vwapApprox, rvol, rsi: rsi14,
      zones, lang: "tr",
    });

    const micro15 = check15mMicroTrend(closes15m, opens15m, highs15m);

    const qResult = quoteSummary?.quoteSummary?.result?.[0] || {};
    const sumDetail = qResult.summaryDetail || {};
    const assetProfile = qResult.assetProfile || {};
    const finData = qResult.financialData || {};
    const stats = qResult.defaultKeyStatistics || {};

    let sector = assetProfile.sector || "Unknown";
    let industry = assetProfile.industry || "Unknown";

    if (sector === "Unknown" || industry === "Unknown") {
      try {
        const searchRes = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}`, { headers, signal: AbortSignal.timeout(5000) });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const match = searchData?.quotes?.find((q: any) => q.symbol?.toUpperCase() === ticker.toUpperCase());
          if (match) {
            if (match.sector || match.sectorDisp) {
              sector = match.sectorDisp || match.sector;
            }
            if (match.industry || match.industryDisp) {
              industry = match.industryDisp || match.industry;
            }
          }
        }
      } catch (err) {
        console.error("Yahoo search fallback error:", err);
      }
    }

    let marketCap = sumDetail.marketCap?.raw || 0;
    let peRatio = sumDetail.trailingPE?.raw || 0;
    let pbRatio = stats.priceToBook?.raw || 0;
    let grossMargin = finData.grossMargins?.raw || 0;
    let operatingMargin = finData.operatingMargins?.raw || 0;
    let netMargin = finData.profitMargins?.raw || 0;
    let revenueGrowth = finData.revenueGrowth?.raw || 0;
    let fcf = finData.freeCashflow?.raw || 0;
    let dividendRate = sumDetail.dividendRate?.raw || 0;
    let dividendYield = sumDetail.dividendYield?.raw || 0;

    // Fallback if quoteSummary failed or was blocked (all values are 0 or empty)
    if (marketCap === 0 && peRatio === 0) {
      try {
        const v7Res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`, { headers, signal: AbortSignal.timeout(5000) });
        if (v7Res.ok) {
          const v7Data = await v7Res.json();
          const v7Match = v7Data?.quoteResponse?.result?.[0];
          if (v7Match) {
            marketCap = v7Match.marketCap || 0;
            peRatio = v7Match.trailingPE || v7Match.forwardPE || 0;
            pbRatio = v7Match.priceToBook || 0;
            dividendRate = v7Match.dividendRate || v7Match.trailingAnnualDividendRate || v7Match.trailingAnnualDividendYield || 0;
            dividendYield = v7Match.dividendYield || v7Match.trailingAnnualDividendYield || 0;
            // Standard fallbacks for margins from public quotes
            grossMargin = v7Match.grossMargins || 0.35;
            operatingMargin = v7Match.operatingMargins || 0.15;
            netMargin = v7Match.netIncomeToCommon || v7Match.profitMargins || 0.10;
            revenueGrowth = v7Match.revenueGrowth || 0.05;
          }
        }
      } catch (err) {
        console.error("Yahoo v7 quote fallback error:", err);
      }
    }

    const fcfYield = (fcf && marketCap) ? fcf / marketCap : 0.04;
    const debtToEquity = stats.debtToEquity?.raw || 0;

    // CMF / MFI formulation from swing117_boga
    let cmf = 0.05;
    let mfi = 55;
    try {
      const posMF: number[] = [];
      const negMF: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        const prevC = closes[i-1];
        const currC = closes[i];
        const currH = highs[i];
        const currL = lows[i];
        const currV = volumes[i];
        const tp = (currH + currL + currC) / 3;
        const prevTP = (highs[i-1] + lows[i-1] + closes[i-1]) / 3;
        const mf = tp * currV;
        if (tp > prevTP) {
          posMF.push(mf);
          negMF.push(0);
        } else {
          posMF.push(0);
          negMF.push(mf);
        }
      }
      let sumMFV = 0;
      let sumVol = 0;
      for (let i = closes.length - 20; i < closes.length; i++) {
        const prevC = closes[i-1] || closes[i];
        const currC = closes[i];
        const currH = highs[i];
        const currL = lows[i];
        const currV = volumes[i];
        const trueH = Math.max(currH, prevC);
        const trueL = Math.min(currL, prevC);
        const trueRange = trueH - trueL;
        const mf_mult = trueRange > 0 ? ((currC - trueL) - (trueH - currC)) / trueRange : 0;
        sumMFV += mf_mult * currV;
        sumVol += currV;
      }
      cmf = sumVol > 0 ? sumMFV / sumVol : 0.05;

      const last14Pos = posMF.slice(-14).reduce((a, b) => a + b, 0);
      const last14Neg = negMF.slice(-14).reduce((a, b) => a + b, 0);
      mfi = last14Neg > 0 ? (100 - 100 / (1 + (last14Pos / last14Neg))) : 50;
    } catch {}

    // detect_rising_stock mapping
    const recent_ret = (currentPrice - closes[closes.length - 10]) / closes[closes.length - 10];
    const recent_5d = (currentPrice - closes[closes.length - 6]) / closes[closes.length - 6];
    let risingScore = 0;
    let risingPattern = "Flat Trend";
    if (recent_ret >= 0.0 || recent_5d >= 0.01) {
      if (recent_5d > 0 && recent_ret > 0) {
        const accel = recent_5d / recent_ret;
        if (accel >= 0.55) {
          risingScore += 2.5;
          risingPattern = "Accelerating";
        } else if (accel < 0.20) {
          risingScore -= 1.0;
          risingPattern = "Decelerating";
        }
      }
      if (recent_ret > 0.15) {
        risingScore -= 2.0;
        risingPattern = "High Momentum Leader";
      } else if (recent_ret > 0.08) {
        risingScore += 1.0;
        risingPattern = "Mature Trend";
      } else if (recent_ret > 0.02) {
        risingScore += 4.0;
        risingPattern = "Fresh Breakout";
      } else {
        risingScore += 1.0;
        risingPattern = "Mild Uptrend";
      }
    }

    // Smart Money score mapping
    let smScore = 0;
    if (cmf > 0.15) smScore += 6.0;
    else if (cmf > 0.05) smScore += 3.2;
    else if (cmf < -0.10) smScore -= 3.2;

    if (mfi > 60) smScore += 4.0;
    else if (mfi < 30) smScore -= 2.0;

    // Technical base score
    let tScore = 30;
    if (currentPrice > ema20) tScore += 15;
    if (currentPrice > ema50) tScore += 15;
    if (currentPrice > ema200) tScore += 15;
    if (emaStackBullish) tScore += 15;
    if (rsi14 >= 45 && rsi14 <= 65) tScore += 10;
    else if (rsi14 < 30) tScore += 10;
    if (rvol > 1.3) tScore += 5;
    tScore = Math.max(10, Math.min(100, tScore));

    // Financial health score
    let healthScore = 0;
    if (grossMargin > 0.35) healthScore += 2.0;
    if (operatingMargin > 0.15) healthScore += 2.0;
    if (netMargin > 0.10) healthScore += 2.0;
    if (revenueGrowth > 0.10) healthScore += 3.0;
    else if (revenueGrowth > 0.05) healthScore += 1.5;
    if (debtToEquity > 0 && debtToEquity < 1.5) healthScore += 1.5;
    if (fcfYield > 0.03) healthScore += 2.0;
    else if (fcfYield < 0) healthScore -= 4.0;
    if (netMargin < 0) healthScore -= 4.0;
    healthScore = Math.max(-10, Math.min(15, healthScore));

    // Normalized fundamental score
    let fScore = 50 + (healthScore * 3.3);
    fScore = Math.max(10, Math.min(100, fScore));

    // Momentum score
    let mScore = 50 + (risingScore * 6);
    if (rvol > 1.2) mScore += 10;
    mScore = Math.max(10, Math.min(100, mScore));

    // Composite master score using exact swing117 weights + 15m trend score bonus!
    let compositeScore = (tScore * 0.40) + (fScore * 0.25) + (mScore * 0.20) + (50 + smScore * 4) * 0.15;
    compositeScore += micro15.score_bonus;
    
    let finalMaster = Math.max(10, Math.min(100, Math.round(compositeScore)));

    // Hard Reject handling if toxic distribution
    if (!micro15.is_valid) {
      finalMaster = Math.min(35, finalMaster);
    }

    let signalType = "NEUTRAL";
    if (finalMaster >= 70) signalType = "STRONG_BUY";
    else if (finalMaster >= 58) signalType = "BUY";
    else if (finalMaster <= 42) signalType = "STRONG_SELL";
    else if (finalMaster <= 49) signalType = "SELL";

    return {
      ticker: ticker.toUpperCase(),
      company: meta.longName || stats.longName || `${ticker.toUpperCase()} Corp.`,
      date: new Date().toISOString().split("T")[0],
      generated_at: new Date().toISOString(),
      sector: sector,
      industry: industry,
      price: {
        current: currentPrice,
        open: opens[opens.length - 1],
        high: highs[highs.length - 1],
        low: lows[lows.length - 1],
        prev_close: prevClose,
        change_pct: changePct,
        change_pct_1w: recent_5d * 100,
        change_pct_1m: recent_ret * 100,
        change_pct_1y: ((currentPrice - closes[0]) / closes[0]) * 100,
        volume: volumes[volumes.length - 1],
        avg_volume_30d: last30dVol * 30
      },
      scores: {
        master_score: finalMaster,
        technical_score: tScore,
        fundamental_score: fScore,
        momentum_score: mScore,
        sentiment_score: 70,
        signal_type: signalType,
        score_type: finalMaster >= 70 ? "HIGH_CONVICTION" : finalMaster >= 58 ? "POSITIVE_BIAS" : finalMaster <= 42 ? "UNDERPERFORM" : "NEUTRAL",
        micro_15m: micro15
      },
      technical: {
        rsi_14: rsi14,
        macd: 0.1,
        macd_signal: 0.1,
        macd_histogram: 0.0,
        ema_20: ema20,
        ema_50: ema50,
        ema_200: ema200,
        ema_stack_bullish: emaStackBullish,
        bb_upper: currentPrice * 1.05,
        bb_middle: currentPrice,
        bb_lower: currentPrice * 0.95,
        bb_width: 10,
        atr: zones.atr1d,
        atr_pct: zones.atrPct,
        rvol: rvol,
        "52w_high": high52w,
        "52w_low": low52w
      },
      fundamental: {
        pe_ratio: peRatio,
        pb_ratio: pbRatio,
        gross_margin: grossMargin,
        operating_margin: operatingMargin,
        net_margin: netMargin,
        market_cap: marketCap,
        revenue_growth_ttm: revenueGrowth,
        fcf_yield: fcfYield,
        institutional_ownership_pct: stats.heldPercentInstitutions?.raw || 0.70,
        dividend_rate: dividendRate,
        dividend_yield: dividendYield
      },
      scores_detail: {
        entry_range_low: zones.buyZone.low,
        entry_range_high: zones.buyZone.high,
        target_range_low: zones.sellZone.low,
        target_range_high: zones.sellZone.high,
        target_1: zones.tp1,
        target_2: zones.tp2,
        target_3: zones.tp3,
        stop_loss: zones.stopZone.high,
        risk_reward_ratio: zones.riskReward,
        entry_engine: zones.entryEngine,
        entry_condition: tradeRationale.entryCondition,
        stop_rationale: tradeRationale.stopRationale,
        rationale_ema: tradeRationale.ema,
        rationale_vwap: tradeRationale.vwap,
        rationale_volume: tradeRationale.volume,
        rationale_rsi: tradeRationale.rsi
      }
    };
  } catch (e) {
    console.error("fetchYahooLive error:", e);
    return null;
  }
}

async function lookupTickerFromQuery(query: string): Promise<string | null> {
  const clean = query.trim().toUpperCase();
  if (/^[A-Z]{1,5}$/.test(clean)) {
    return clean;
  }

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    };
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=0`;
    const res = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const match = data?.quotes?.find((q: any) => 
        q.symbol && 
        (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.exchange)
      );
      if (match && match.symbol) {
        console.log(`[BOGA AI] Mapped query "${query}" to ticker "${match.symbol.toUpperCase()}" via Yahoo Search`);
        return match.symbol.toUpperCase();
      }
    }
  } catch (err: any) {
    console.error(`[BOGA AI] Ticker lookup failed for query "${query}":`, err.message);
  }
  return null;
}

async function translateNewsList(news: any[], apiKey: string): Promise<any[]> {
  if (!news || news.length === 0 || !apiKey) return news;
  
  const newsToTranslate = news.slice(0, 5);
  const titles = newsToTranslate.map(n => n.title);
  
  try {
    const prompt = `Translate the following English financial news headlines into clear, professional Turkish for a stock analysis report. Return ONLY a valid JSON array of strings in the exact same order, without any markdown code blocks, preambles or explanations.
    
    Format example:
    ["Baslik 1", "Baslik 2"]
    
    Headlines to translate:
    ${JSON.stringify(titles)}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            responseMimeType: "application/json"
          }
        }),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        const translatedTitles = JSON.parse(text);
        if (Array.isArray(translatedTitles)) {
          return news.map((item, idx) => {
            if (idx < translatedTitles.length) {
              return {
                ...item,
                title: translatedTitles[idx]
              };
            }
            return item;
          });
        }
      }
    }
  } catch (err) {
    console.error("News translation failed:", err);
  }
  return news;
}

async function fetchMarketIndicesAndSector(sectorName: string) {
  const sectorMap: Record<string, string> = {
    "technology": "XLK",
    "energy": "XLE",
    "financials": "XLF",
    "financial services": "XLF",
    "healthcare": "XLV",
    "consumer discretionary": "XLY",
    "consumer cyclical": "XLY",
    "consumer staples": "XLP",
    "consumer defensive": "XLP",
    "industrials": "XLI",
    "materials": "XLB",
    "basic materials": "XLB",
    "real estate": "XLRE",
    "utilities": "XLU",
    "communication services": "XLC"
  };
  const targetSectorEtf = sectorMap[(sectorName || "").toLowerCase()] || "";
  const tickersToFetch = ["^GSPC", "^IXIC", "^VIX"];
  if (targetSectorEtf) {
    tickersToFetch.push(targetSectorEtf);
  }

  const results: Record<string, { price: number | null; change_1d: number | null }> = {};
  
  await Promise.all(tickersToFetch.map(async (ticker) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        const chart = data?.chart?.result?.[0];
        if (chart) {
          const closes = (chart.indicators?.quote?.[0]?.close || []).filter((v: any) => v != null);
          const current = chart.meta?.regularMarketPrice ?? closes[closes.length - 1];
          const prev = closes[closes.length - 2] ?? closes[closes.length - 1];
          const change = prev ? ((current - prev) / prev) * 100 : null;
          results[ticker] = { price: current, change_1d: change };
        }
      }
    } catch (e) {
      console.error(`Failed to fetch index/ETF: ${ticker}`, e);
    }
  }));

  return {
    sp500Change: results["^GSPC"]?.change_1d ?? null,
    nasdaqChange: results["^IXIC"]?.change_1d ?? null,
    vixPrice: results["^VIX"]?.price ?? null,
    sectorEtf: targetSectorEtf || "N/A",
    sectorChange: targetSectorEtf ? (results[targetSectorEtf]?.change_1d ?? null) : null
  };
}

export async function POST(req: NextRequest) {
  if (isRateLimited(getClientIp(req), ASK_MAX_REQUESTS, ASK_WINDOW_MS)) {
    return NextResponse.json({ text: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." }, { status: 429 });
  }

  let body: { message: string; history?: Message[]; lang?: string; pageContext?: any };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ text: "Geçersiz istek." });
  }

  const { message, history = [], lang: langRaw = "tr", pageContext = null } = body;
  const lang: "tr" | "en" | "pt" = langRaw === "pt" ? "pt" : (langRaw === "en" || langRaw === "fr" || langRaw === "es") ? "en" : "tr";
  if (!message?.trim()) {
    return NextResponse.json({ text: "Lütfen bir mesaj girin." });
  }

  const lowerMsg = message.toLowerCase();
  const useClaude = lowerMsg.includes("claude");
  const cleanMsg = message.replace(/claude/gi, "").trim();

  // ── TICKER / COMPANY NAME RESOLUTION ─────────────────────────────────────
  let resolvedTicker: string | null = null;
  const isDirectTicker = /^[A-Z]{1,4}$/.test(cleanMsg); // Only exact 1-4 letter UPPERCASE queries
  
  if (isDirectTicker && !cleanMsg.startsWith("/")) {
    resolvedTicker = cleanMsg.toUpperCase();
  } else {
    // If it's a short query and not a general question, let's see if it's a company name or lowercase ticker
    const isShortQuery = cleanMsg.split(/\s+/).length <= 4 && cleanMsg.length <= 40;
    const isGeneralQuestion = 
      cleanMsg.includes("?") || 
      /^(nedir|nasil|nasıl|neden|niye|kim|ne|hangi|how|what|why|who|where|explain|tanimla|tanımla|yaz|analiz|goster|göster)/i.test(cleanMsg);
      
    if (isShortQuery && !isGeneralQuestion && !cleanMsg.startsWith("/")) {
      resolvedTicker = await lookupTickerFromQuery(cleanMsg);
    }
  }

  // ── BOGA SWING TERMINAL — Yerel JSON Motoru ──────────────────────────────
  if (resolvedTicker) {
    const ticker = resolvedTicker;

    // Veri yolları (Vercel + lokal uyumlu)
    const dataPaths = [
      path.join(process.cwd(), "..", "data", "latest", "stocks", `${ticker}.json`),
      path.join(process.cwd(), "data", "latest", "stocks", `${ticker}.json`),
      path.join(process.cwd(), "..", "..", "data", "latest", "stocks", `${ticker}.json`),
    ];

    let stockJson: any = null;
    let needsUpdate = true;

    // 1. Check if we have a fresh copy (< 4 hours old)
    for (const p of dataPaths) {
      try {
        if (fs.existsSync(p)) {
          const fileContent = fs.readFileSync(p, "utf-8");
          const parsed = JSON.parse(fileContent);
          if (parsed && parsed.generated_at) {
            const ageHours = (Date.now() - new Date(parsed.generated_at).getTime()) / (1000 * 60 * 60);
            if (
              ageHours < 4 && 
              parsed.scores?.micro_15m && 
              parsed.scores_detail?.entry_engine &&
              parsed.fundamental &&
              parsed.fundamental.market_cap > 0
            ) {
              stockJson = parsed;
              needsUpdate = false;
              break;
            }
          }
        }
      } catch {}
    }

    // 2. If no fresh copy exists, trigger the dynamic fetcher
    if (needsUpdate) {
      try {
        console.log(`[BOGA AI] Attempting pure JavaScript dynamic live Yahoo Finance fetch for: ${ticker}`);
        const liveData = await fetchYahooLive(ticker);
        if (liveData) {
          stockJson = liveData;
          // Save to local directories if writable (safe for both local dev and serverless deploy)
          const targetPaths = [
            path.join(process.cwd(), "..", "data", "latest", "stocks", `${ticker}.json`),
            path.join(process.cwd(), "data", "latest", "stocks", `${ticker}.json`),
            path.join(process.cwd(), "frontend", "public", "data", "latest", "stocks", `${ticker}.json`),
            path.join(process.cwd(), "public", "data", "latest", "stocks", `${ticker}.json`),
          ];
          for (const targetPath of targetPaths) {
            try {
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(targetPath, JSON.stringify(liveData, null, 2), "utf-8");
            } catch (writeErr: any) {
              // Expected to fail silently on read-only environments like Vercel serverless
            }
          }
        }
      } catch (e: any) {
        console.error(`[BOGA AI] Pure JS live Yahoo fetcher failed for ${ticker}:`, e.message);
      }

      // 2b. Python fallback if pure JS fetch failed and we are running in local environment
      if (!stockJson) {
        try {
          console.log(`[BOGA AI] Falling back to dynamic Python scraper for: ${ticker}`);
          const pythonPath = "C:\\Users\\afksm\\finma\\venv313\\Scripts\\python.exe";
          const scriptPath = "C:\\Users\\afksm\\finma\\fetch_live_ticker_analysis.py";
          if (fs.existsSync(pythonPath) && fs.existsSync(scriptPath)) {
            const resultStdout = execSync(`"${pythonPath}" "${scriptPath}" ${ticker}`, { encoding: "utf-8", timeout: 15000 });
            if (resultStdout.trim()) {
              const parsed = JSON.parse(resultStdout.trim());
              if (parsed && !parsed.error) {
                stockJson = parsed;
              }
            }
          }
        } catch (e: any) {
          console.error(`[BOGA AI] Dynamic Python fallback failed for ${ticker}:`, e.message);
        }
      }
    }

    // 3. Fallback to stale local copy if python failed
    if (!stockJson) {
      for (const p of dataPaths) {
        try {
          if (fs.existsSync(p)) {
            stockJson = JSON.parse(fs.readFileSync(p, "utf-8"));
            break;
          }
        } catch {}
      }
    }

    // master.json'dan market_regime oku
    const masterPaths = [
      path.join(process.cwd(), "..", "data", "latest", "master.json"),
      path.join(process.cwd(), "data", "latest", "master.json"),
    ];
    let masterJson: any = null;
    for (const p of masterPaths) {
      try { if (fs.existsSync(p)) { masterJson = JSON.parse(fs.readFileSync(p, "utf-8")); break; } } catch {}
    }

    // Fetch Yahoo Finance Search data for news and correct sector/industry
    let news: any[] = [];
    try {
      const searchRes = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://finance.yahoo.com/"
        },
        signal: AbortSignal.timeout(6000)
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        news = searchData?.news || [];
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && news.length > 0) {
          news = await translateNewsList(news, apiKey);
        }
        if (stockJson) {
          const match = searchData?.quotes?.find((q: any) => q.symbol?.toUpperCase() === ticker.toUpperCase());
          if (match) {
            if (!stockJson.sector && (match.sector || match.sectorDisp)) {
              stockJson.sector = match.sectorDisp || match.sector;
            }
            if (!stockJson.industry && (match.industry || match.industryDisp)) {
              stockJson.industry = match.industryDisp || match.industry;
            }
          }
        }
      }
    } catch (err) {
      console.error("Dynamic news fetch error:", err);
    }

    if (stockJson) {
      stockJson.news = news;
    }

    if (!stockJson) {
      return NextResponse.json({
        text: `⚠️ **Sembol Bulunamadı:** '${ticker}' için BOGA Finance AI veya yerel sistemde geçerli veri bulunamadı. Lütfen geçerli bir borsa sembolü girin (Örn: AAPL, TSLA, CLDX, MSFT).`,
        source: "system_warning"
      });
    }

    // Fetch market indices and sector status
    const marketOverview = await fetchMarketIndicesAndSector(stockJson.sector || "");
    if (stockJson) {
      stockJson.market_overview = marketOverview;
    }

    const sp500ChangeStr = marketOverview.sp500Change != null ? (marketOverview.sp500Change >= 0 ? "+" : "") + marketOverview.sp500Change.toFixed(2) + "%" : "N/A";
    const nasdaqChangeStr = marketOverview.nasdaqChange != null ? (marketOverview.nasdaqChange >= 0 ? "+" : "") + marketOverview.nasdaqChange.toFixed(2) + "%" : "N/A";
    const vixPriceStr = marketOverview.vixPrice != null ? marketOverview.vixPrice.toFixed(2) : "N/A";
    const sectorChangeStr = marketOverview.sectorChange != null ? (marketOverview.sectorChange >= 0 ? "+" : "") + marketOverview.sectorChange.toFixed(2) + "%" : "N/A";
    const sectorEtf = marketOverview.sectorEtf;

    // Verileri düzenli şekilde çıkar
    const s = stockJson;
    const pr = s.price || {};
    const sc = s.scores || {};
    const tech = s.technical || {};
    const fund = s.fundamental || {};
    const regime = masterJson?.market_regime || "N/A";
    const scoresDetail = s.scores_detail || s.strategy || {};

    const price       = pr.current?.toFixed(2)       ?? "N/A";
    const change      = pr.change_pct?.toFixed(2)     ?? "N/A";
    const change1w    = pr.change_pct_1w?.toFixed(2)  ?? "N/A";
    const change1m    = pr.change_pct_1m?.toFixed(2)  ?? "N/A";
    const change1y    = pr.change_pct_1y?.toFixed(2)  ?? "N/A";
    const volume      = pr.volume ? (pr.volume / 1e6).toFixed(1) + "M" : "N/A";
    const avgVol      = pr.avg_volume_30d ? (pr.avg_volume_30d / 1e6).toFixed(1) + "M" : "N/A";
    const rvol        = pr.volume && pr.avg_volume_30d ? (pr.volume / pr.avg_volume_30d).toFixed(2) : "N/A";

    const rsi         = tech.rsi_14?.toFixed(1)       ?? "N/A";
    const macd        = tech.macd?.toFixed(3)          ?? "N/A";
    const macdHist    = tech.macd_histogram?.toFixed(3)?? "N/A";
    const ema20       = tech.ema_20?.toFixed(2)        ?? "N/A";
    const ema50       = tech.ema_50?.toFixed(2)        ?? "N/A";
    const ema200      = tech.ema_200?.toFixed(2)       ?? "N/A";
    const emaStack    = tech.ema_stack_bullish ? "✅ Boğa (EMA20>50>200)" : "⚠️ Ayı (Karışık)";
    const bbUpper     = tech.bb_upper?.toFixed(2)      ?? "N/A";
    const bbLower     = tech.bb_lower?.toFixed(2)      ?? "N/A";
    const support     = tech.support_level?.toFixed(2) ?? pr.low?.toFixed(2) ?? "N/A";
    const resistance  = tech.resistance_level?.toFixed(2) ?? pr.high?.toFixed(2) ?? "N/A";
    const atr         = tech.atr?.toFixed(2)           ?? "N/A";

    const masterScore = sc.master_score?.toFixed(0)    ?? "N/A";
    const signal      = sc.signal_type                 ?? "N/A";

    const mcap        = fund.market_cap ? (fund.market_cap / 1e9).toFixed(1) + "B" : "N/A";
    const pe          = fund.pe_ratio?.toFixed(1)      ?? "N/A";
    const pb          = fund.pb_ratio?.toFixed(2)      ?? "N/A";
    const grossMargin = fund.gross_margin != null ? (fund.gross_margin * 100).toFixed(1) + "%" : "N/A";
    const netMargin   = fund.net_margin != null ? (fund.net_margin * 100).toFixed(1) + "%" : "N/A";
    const revGrowth   = fund.revenue_growth_ttm != null ? (fund.revenue_growth_ttm * 100).toFixed(1) + "%" : "N/A";
    const fcfYield    = fund.fcf_yield != null ? (fund.fcf_yield * 100).toFixed(1) + "%" : "N/A";

    // Giriş/Hedef/Stop seviyeleri (scores_detail veya ATR bazlı)
    const entryLow    = scoresDetail.entry_range_low?.toFixed(2)  ?? (pr.current ? (pr.current * 0.985).toFixed(2) : "N/A");
    const entryHigh   = scoresDetail.entry_range_high?.toFixed(2) ?? price;
    const targetLow   = scoresDetail.target_range_low?.toFixed(2) ?? (pr.current ? (pr.current * 1.10).toFixed(2) : "N/A");
    const targetHigh  = scoresDetail.target_range_high?.toFixed(2)?? (pr.current ? (pr.current * 1.15).toFixed(2) : "N/A");
    const stopLoss    = scoresDetail.stop_loss?.toFixed(2)         ?? (pr.current ? (pr.current * 0.95).toFixed(2) : "N/A");
    const tp1Str      = scoresDetail.target_1?.toFixed(2) ?? targetLow;
    const tp2Str      = scoresDetail.target_2?.toFixed(2) ?? targetHigh;
    const tp3Str      = scoresDetail.target_3?.toFixed(2) ?? targetHigh;

    // lib/tradePlanEngine.ts'den gelen deterministik gerekce notlari — LLM'e
    // GEREKÇE'yi bu somut EMA/VWAP/hacim/RSI notlarina dayandirmasi icin
    // veriliyor (uydurma yorum degil, gercek hesaplanmis degerler).
    const entryConditionNote = scoresDetail.entry_condition || "";
    const stopRationaleNote  = scoresDetail.stop_rationale || "";
    const emaRationaleNote   = scoresDetail.rationale_ema || "";
    const vwapRationaleNote  = scoresDetail.rationale_vwap || "";
    const volumeRationaleNote = scoresDetail.rationale_volume || "";
    const rsiRationaleNote   = scoresDetail.rationale_rsi || "";

    const newsHeadlineList = news && news.length > 0
      ? news.slice(0, 5).map((n: any) => `- [${n.publisher || "Yahoo Finance"}] ${n.title || "Headline"}`).join("\n")
      : "Son haber bulunamadı.";

    const prompt = `Sen BOGA AI swing trading terminalinin analistisin. Aşağıdaki verileri kullanarak ${ticker} için BOGA SWING RAPORU yaz.
Kritik Kurallar (Format Bütünlüğü):
1. Rapor formatını, başlıkları, emojileri ve etiketleri kesinlikle TÜRKÇE format şablonunda birebir korumalısın. Başlıkları asla başka bir dile çevirme (Örn: "🌍 PİYASA FİLTRESİ", "💵 FİYAT & HACİM", "┌─ 🎯 İŞLEM PLANI", "📌 ONAY LİSTESİ", "📊 TEKNİK & PERFORMANS", "💼 FİNANSAL SAĞLIK", "⚡ SON KARAR", "AKSİYON", "GEREKÇE" ifadeleri aynen Türkçe olarak kalmalıdır).
2. Sadece ve sadece başlıkların altındaki açıklamaları, onay listesi yorumlarını ve gerekçeyi (GEREKÇE) kullanıcının sorduğu/istediği dilde (İngilizce ise İngilizce, Türkçe ise Türkçe, Almanca ise Almanca, İspanyolca ise İspanyolca, Arapça ise Arapça vb.) yaz.
3. Çıktıya kesinlikle hiçbir ön konuşma veya açıklama ekleme ("İşte raporunuz...", "Gerne..." gibi ifadeler kesinlikle yasaktır). Çıktı doğrudan '════════════════════════════════════════' ile başlamalıdır.
4. Raporun genel tonu ve tüm detay metinleri, hissenin BOGA Skoru (${masterScore}/100) ve Sinyali (${signal}) ile tam uyumlu olmalıdır. Eğer sinyal STRONG_SELL veya SELL ise, detay metinlerinde, onay listesinde, uzun vadeli değerlendirmelerde ve gerekçede asla hisseyi güçlüymüş gibi öven veya alım/biriktirme öneren ifadeler kullanma; aksine teknik/temel zayıflıkları, riskleri ve satım/uzak durma nedenlerini vurgula. Ton ve konu bütünlüğü tam olarak sağlanmalıdır.
5. Sunulan "📰 Son Şirket Haberleri ve Gelişmeler" listesini analiz ederek "💎 TEMEL HİKAYE & KATALİZÖRLER" ve "💼 FİNANSAL SAĞLIK" bölümlerine en güncel şirket/sektör gelişmelerini, katalizörlerini ve haberlerini entegre et.
6. Eğer endeksler (S&P 500 / NASDAQ) ve sektörel değişim oranı negatif ise (düşüyorsa), rapordaki "🌍 PİYASA FİLTRESİ" ve "⚡ SON KARAR" bölümlerinde mutlaka "Endeksler ve sektörel görünüm düştüğü için alımlarda daha dikkatli olunmalı veya temkinli yaklaşım benimsenmelidir" uyarısını ekle.

📊 CANLI PİYASA & SEKTÖR MATRİSİ:
• S&P 500 Değişim Oranı: ${sp500ChangeStr}
• NASDAQ Değişim Oranı: ${nasdaqChangeStr}
• VIX Korku Endeksi: ${vixPriceStr}
• Sektör Durumu (${s.sector || "N/A"}): ${sectorEtf} ETF Değişim Oranı: ${sectorChangeStr}

📰 Son Şirket Haberleri ve Gelişmeler (Yahoo Finance):
${newsHeadlineList}

════════════════════════════════════════
${ticker}  |  ${s.sector || "N/A"}  |  ${s.company || ""}
════════════════════════════════════════
Tarih: ${s.date || "N/A"}  |  Piyasa Rejimi: ${regime}  |  BOGA Skoru: ${masterScore}/100  |  Sinyal: ${signal}
⚡ Zaman Dilimi Yön Analizi:
• Mikro Durum: ${sc.micro_15m?.msg || "15m Yatay/Sıkışma"}
• Timing Durumu: ${s.scores_detail?.entry_engine?.type || "WAITING_FOR_VOLUME"}

🌍 Piyasa Rejimi: ${regime}

💵 Fiyat: $${price} (%${change})  |  Piyasa Değeri: ${mcap}
• Hacim: ${volume}  |  30G Ort: ${avgVol}  |  RVOL: ${rvol}x
• Performans: 1H=%${change1w}  1A=%${change1m}  1Y=%${change1y}

🎯 İşlem Planı:
• Giriş Bölgesi: $${entryLow} - $${entryHigh}
• Giriş Şartı: ${entryConditionNote || "N/A"}
• Hedef Bölge: $${targetLow} - $${targetHigh} (TP1: $${tp1Str} | TP2: $${tp2Str} | TP3: $${tp3Str})
• Stop Loss: $${stopLoss}
• Stop Gerekçesi: ${stopRationaleNote || "N/A"}

📌 Onceden Hesaplanmis Gerekce Notlari (GEREKÇE yazarken bunlara dayan, uydurma):
• EMA: ${emaRationaleNote || "N/A"}
• VWAP: ${vwapRationaleNote || "N/A"}
• Hacim: ${volumeRationaleNote || "N/A"}
• RSI: ${rsiRationaleNote || "N/A"}

📊 Teknik Metris:
• RSI(14): ${rsi}  |  MACD: ${macd}  |  MACD Hist: ${macdHist}
• EMA20: $${ema20}  |  EMA50: $${ema50}  |  EMA200: $${ema200}
• EMA Stack: ${emaStack}
• Bollinger: Alt=$${bbLower}  Üst=$${bbUpper}
• Destek: $${support}  |  Direnç: $${resistance}  |  ATR: $${atr}

💼 Finansal Durum:
• F/K (P/E): ${pe}x  |  PD/DD (P/B): ${pb}x
• Brüt Marj: ${grossMargin}  |  Net Marj: ${netMargin}
• Gelir Büyümesi: ${revGrowth}  |  FCF Verimi: ${fcfYield}

RAPOR FORMAT ŞABLONU (Bu yapıyı, başlıkları ve Türkçe etiketleri aynen koru):
════════════════════════════════════════
${ticker} | ${s.sector || ""} | Multi-Horizon Strateji
════════════════════════════════════════

🌍 PİYASA FİLTRESİ
• Piyasa Rejimi: ${regime} → [POZİTİF / NÖTR / RİSKLİ ifadelerinden birini seçerek yaz]

💵 FİYAT & HACİM
• Fiyat: $${price} (%${change})  |  Piyasa Değeri: ${mcap}
• Hacim: ${volume}  |  30G Ort: ${avgVol}  |  RVOL: ${rvol}x
• Performans: 1H=%${change1w}  1A=%${change1m}  1Y=%${change1y}

┌─ 🎯 İŞLEM PLANI (SWING TRADE)
│  🟢 Giriş: $${entryLow} - $${entryHigh}
│  🎯 Hedef: TP1 $${tp1Str} | TP2 $${tp2Str} | TP3 $${tp3Str}
│  🛑 Stop:  $${stopLoss}
│  ⚖️ R/R: 1:[hesapla ve yaz]
└─────────────────

💎 UZUN VADELİ YATIRIM (INVESTMENT) & TEMETTÜ
• +1 Yıl Değerlendirmesi: [Biriktir / Tut / Riskli]
• +5 Yıl Değerlendirmesi: [Biriktir / Tut / Riskli]
• Temettü Hissesi Mi?: [Evet ise miktar/verim/dönem yaz, Hayır ise Büyüme odaklı olduğunu belirt]
• Aylık Lot Önerisi: [Hesaplanan lot miktarını yaz]

📌 ONAY LİSTESİ
[X/ ] RSI durumu: [değeri yaz ve kullanıcının dilediği dilde yorumla]
[X/ ] EMA Stack: [değeri yaz ve kullanıcının dilediği dilde yorumla]
[X/ ] Hacim: [RVOL değerini yaz ve kullanıcının dilediği dilde yorumla]
[X/ ] Yatırım Profili: [Swing/Investment/Temettü uygunluğu özeti]

📊 TEKNİK & PERFORMANS
• [tüm teknik göstergeleri listele ve kullanıcının dilediği dilde kısaca yorumla]

💼 FİNANSAL SAĞLIK
• [tüm finansal sağlık göstergelerini listele ve kullanıcının dilediği dilde kısaca yorumla]

⚡ SON KARAR
│ AKSİYON: [İŞLEME GİR / İZLE / ÇIKIŞ seçeneklerinden birini yaz]
│ GEREKÇE: [3-4 cümle, kullanıcının dilediği dilde. Yukarıdaki "Önceden Hesaplanmış Gerekçe Notları"ndaki EMA, VWAP, Hacim ve RSI notlarını MUTLAKA gerekçeye entegre et — kendi başına yorum uydurma, verilen bu dört nota dayan. Ayrıca Giriş Şartı ve Stop Gerekçesi notlarını da kısaca özetle.]
└─────────────────`;

    if (stockJson && !stockJson.forecast) {
      try {
        const pr = stockJson.price || {};
        const sc = stockJson.scores || {};
        const tech = stockJson.technical || {};
        const sd = stockJson.scores_detail || stockJson.strategy || {};
        const currentPrice = pr.current || 100;
        const atr = tech.atr || currentPrice * 0.03;
        const atrPct = (atr / currentPrice) * 100;
        const masterScore = sc.master_score || 50;
        const emaStackBullish = !!tech.ema_stack_bullish;
        const rsi = tech.rsi_14 || 50;
        const cmf = tech.cmf || 0.05;
        
        const targetPrice = sd.target_price || tech.resistance_level || currentPrice * 1.08;
        const stopLoss = sd.stop_loss || tech.support_level || currentPrice * 0.95;

        stockJson.forecast = generateBogaSimulation(
          currentPrice,
          atrPct,
          masterScore,
          emaStackBullish,
          rsi,
          cmf,
          targetPrice,
          stopLoss
        );
      } catch (err: any) {
        console.error("Failed to dynamically append forecast:", err.message);
      }
    }

    const aiResponse = useClaude ? await handleClaude(prompt, history, lang) : await handleGemini(prompt, history, lang);
    try {
      const aiJson = await aiResponse.json();
      return NextResponse.json({
        text: aiJson.text,
        source: aiJson.source,
        followUp: aiJson.followUp || [],
        type: "stock_report",
        ticker: ticker,
        stockData: stockJson,
        masterData: masterJson
      });
    } catch (e) {
      return aiResponse;
    }
  }

  // Ticker-önizleme dalının altındaki genel BOGA AI sohbet asistanı — bu,
  // /global/{locale}/ai sayfasının özelliği ve o sayfa zaten middleware'de
  // üyelik gerektiriyor. API'yi doğrudan çağırarak o kapıyı atlamayı
  // engellemek için burada da aynı kontrolü uyguluyoruz.
  if (!(await hasAnyAuth(req))) {
    return NextResponse.json({ text: "Bu özellik için giriş yapmalısınız." }, { status: 401 });
  }

  try {
    const hasOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) =>
      lowerMsg.includes(kw)
    );

    if (hasOutOfScope) {
      return handleOutOfScope(cleanMsg);
    }

    // Special Command Handling
    if (cleanMsg === "/top5") {
      const picksData = getLatestSwingPicks();
      if (!picksData || !picksData.picks) {
        return NextResponse.json({ text: "Güncel TOP5 verisi şu an sistemde hazır değil. Lütfen daha sonra tekrar deneyiniz." });
      }
      
      const top5 = picksData.picks.slice(0, 5).map((p: any) => ({
        ticker: p.ticker,
        score: p.score,
        status: p.status,
        price: p.current_price,
        entry: `${p.buy_zone?.low} - ${p.buy_zone?.high}`,
        target: `${p.profit_zone?.low} - ${p.profit_zone?.high}`,
        stop: `${p.stop_zone?.low} - ${p.stop_zone?.high}`,
        reason: p.reasoning
      }));

      const prompt = `Aşağıdaki TOP5 hisse seçimlerini analiz et ve raporla:\n\n${JSON.stringify(top5)}\n\nFormat: BOGA AI Market Analysis tarzında, her hisse için Score, Status, Technical Analysis, Strategy (Entry/Target/Stop) kısımlarını içersin. Yanıt tamamen Türkçe olsun.`;
      return useClaude ? await handleClaude(prompt, history, lang) : await handleGemini(prompt, history, lang);
    }

    if (cleanMsg === "/swing") {
      return useClaude ? await handleClaude(MAGNIFICENT_7_PROMPT, history, lang) : await handleGemini(MAGNIFICENT_7_PROMPT, history, lang);
    }

    // /analiz TICKER — Deep analysis
    const analizMatch = cleanMsg.match(/^\/analiz\s+([A-Z]{1,5})$/i);
    if (analizMatch) {
      const ticker = analizMatch[1].toUpperCase();
      try {
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
        const deepRes = await fetch(`${protocol}://${host}/api/deep-analysis?ticker=${ticker}`, { signal: AbortSignal.timeout(15000) });
        if (!deepRes.ok) throw new Error(`Deep analysis failed: ${deepRes.status}`);
        const stockData = await deepRes.json();

        return NextResponse.json({
          role: "assistant",
          type: "stock_report",
          ticker,
          stockData,
          text: `${ticker} için derin analiz raporu hazırlanıyor...`,
        });
      } catch (e: any) {
        console.error(`[ask] /analiz ${ticker} failed:`, e?.message);
        return NextResponse.json({ role: "assistant", text: `${ticker} için rapor yüklenemedi: ${e?.message}` });
      }
    }

    if (cleanMsg === "/analiz") {
      return useClaude ? await handleClaude(SECTOR_ANALYSIS_PROMPT, history, lang) : await handleGemini(SECTOR_ANALYSIS_PROMPT, history, lang);
    }

    // Default Routing with Live News & Dynamic Search
    let finalUserMessage = cleanMsg;
    try {
      const matchedThemes = findMatchingThemes(cleanMsg);
      const marketNews = await fetchGlobalMarketNews(cleanMsg, matchedThemes);
      
      let contextText = "";
      if (pageContext) {
        if (pageContext.type === "ticker") {
          contextText += `\n[SAYFA BAĞLAMI: Kullanıcı şu anda ${pageContext.value} hissesinin sayfasında grafikleri ve verileri inceliyor. Eğer soru bağlamsızsa (örn: "destek direnç nedir?"), bu hisseyi kastettiğini varsay.]\n`;
        } else if (pageContext.page) {
          contextText += `\n[SAYFA BAĞLAMI: Kullanıcı şu anda ${pageContext.page} sayfasında geziniyor.]\n`;
        }
      }

      if (marketNews && marketNews.length > 0) {
        const newsText = marketNews.map(n => `- [${n.publisher}] ${n.title} (İlişkili Hisseler: ${n.entities?.join(", ") || "Yok"})`).join("\n");
        contextText += `\n[SİSTEM TARAFINDAN SAĞLANAN GÜNCEL CANLI WEB VE BORSA HABERLERİ - ${new Date().toLocaleDateString("tr-TR")}]:\n${newsText}\n`;
      }

      if (contextText) {
        finalUserMessage = `${cleanMsg}\n\n${contextText}\n
KRİTİK TALİMATLAR (ODAKLI CANLI ÇIKTI KONTROLÜ VE FORMAT):
1. Kullanıcının sorduğu sektör, tema veya hisse grubu için yukarıda canlı arama motorundan gelen güncel canlı web ve borsa haberlerini analiz et.
2. Hiçbir şekilde "veritabanı", "fallback", "sistem kısıtı", "yerel veri", "Alpha Commander" vb. teknik/sistem terimlerini veya bot isimlerini KESİNLİKLE KULLANMA. 
3. Canlı haberlerden ve verilerden yararlanarak en az 5 adet en alakalı hisseyi belirle ve listele. Yanıtında kesinlikle en az 5 adet hisseye yer ver, asla 5'ten az hisse önerme.
4. Yanıtı tamamen doğal, akıcı ve şablon kalıp kelimelerden (Örn: "Sektör Odağı", "Teknik ve Temel Durum", "Alpha Commander Notu" gibi kalıp ifadeler) arındırılmış bir şekilde yaz. Her hisseyi kendi cümlelerinle doğal paragraflarla açıkla.
5. Yanıtı şu sade yapıda oluştur:

[SEKTÖR/TEMA ADI] HİSSELERİ STRATEJİK ANALİZİ

ÖZET
[Sektörün genel durumunu, büyüme dinamiklerini, canlı haberlerde öne çıkan gelişmeleri ve makro riskleri özetleyen 1 paragraflık akıcı bir metin yaz.]

DETAYLI HİSSE LİSTESİ
* **[TICKER](/ai?ticker=TICKER)** (Şirket Adı)
  [Hissenin o sektördeki rolünü, en son canlı gelişmelerini, kontratlarını, finansal gücünü ve genel durumunu anlatan 3-4 cümlelik tamamen doğal ve akıcı bir analiz paragrafı yaz. Hiçbir kalıp alt başlık/şablon ifadesi kullanma.]

(Listelenecek en az 5 hisse için yukarıdaki sade yapıyı uygula. Ticker butonlarını mutlaka [TICKER](/ai?ticker=TICKER) formatında bağımsız link/buton olarak yaz, Örn: [LMT](/ai?ticker=LMT)).`;
      }
    } catch (e) {
      console.error("Failed to append global news:", e);
    }

    if (useClaude) {
      return await handleClaude(finalUserMessage, history, lang);
    }

    return await handleGemini(finalUserMessage, history, lang);
  } catch (e: any) {
    console.error("[ask] error:", e?.message);
    return NextResponse.json({
      text: "Sistem şu an analiz yapamıyor. Lütfen kısa bir süre sonra tekrar deneyin.",
    });
  }
}

async function handleClaude(message: string, history: Message[], lang: "tr" | "en" | "pt" = "tr") {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: "Claude servisi şu an devre dışı (API anahtarı eksik). Lütfen normal aramaya devam edin.", source: "claude" });
  }
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2000,
      system: getDynamicSystemPrompt(lang),
      messages: [
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.text })),
        { role: "user", content: message },
      ],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    if (!text) throw new Error("Empty response from Claude");

    return NextResponse.json({ text, source: "claude", followUp: [] });
  } catch (e) {
    console.error("[claude] error:", e);
    // Fallback to Gemini if Claude fails and it's not a special command (handled in POST)
    return await handleGemini(message, history, lang);
  }
}

async function handleGemini(message: string, history: Message[], lang: "tr" | "en" | "pt" = "tr") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      text: "Service temporarily unavailable.",
    });
  }

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: getDynamicSystemPrompt(lang) }] },
          contents,
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 4096,
            topP: 0.95,
            topK: 40
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(`[gemini] HTTP ${res.status}`, errData);
      return NextResponse.json({
        text: `Analiz üretilemedi. (Hata: ${res.status}) ${errData.error?.message || ""}`,
      });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return NextResponse.json({
        text: "Unable to generate response.",
      });
    }

    return NextResponse.json({
      text,
      source: "gemini",
      followUp: [],
    });
  } catch (e: any) {
    console.error("[gemini] error:", e?.message);
    return NextResponse.json({
      text: "Service temporarily unavailable.",
    });
  }
}

function handleOutOfScope(message: string): NextResponse {
  const response = `Bu soru BOGA AI'ın uzmanlık alanı dışında. Ben şu alanlarda uzmanlaşmışım:\n\n• Hisse senedi piyasaları ve teknik analiz\n• Ticaret stratejileri ve opsiyon ticareti\n• Emtialar ve forex\n• Kripto para\n• Ekonomik göstergeler\n\nLütfen finansal piyasalar hakkında soru sorun!`;
  return NextResponse.json({ text: response, source: "gemini", followUp: [] });
}
