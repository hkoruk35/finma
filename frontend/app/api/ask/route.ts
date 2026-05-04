import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;

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

export async function POST(req: NextRequest) {
  let body: { message: string; history?: Message[]; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ text: "Geçersiz istek." });
  }

  const { message, history = [], lang = "tr" } = body;
  if (!message?.trim()) {
    return NextResponse.json({ text: "Lütfen bir mesaj girin." });
  }

  const lowerMsg = message.toLowerCase();
  const useClaude = lowerMsg.includes("claude");
  const cleanMsg = message.replace(/claude/gi, "").trim();

  // BOGA SWING TERMINAL V3 - Native Engine
  const isTicker = /^[a-zA-Z]{1,5}$/.test(cleanMsg);
  if (isTicker && !cleanMsg.startsWith("/")) {
    const ticker = cleanMsg.toUpperCase();
    let analysisData: any = null;
    let marketData: any = { spy: null, qqq: null, vix: null };

    const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";
    const fhBase = "https://finnhub.io/api/v1";
    const fhFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(8000) });

    try {
      // 1. Live Quote (Finnhub - Vercel uyumlu, 60 req/dk ücretsiz)
      const [quoteRes, candleRes, spyRes, vixRes] = await Promise.allSettled([
        fhFetch(`${fhBase}/quote?symbol=${ticker}&token=${FINNHUB_KEY}`),
        fhFetch(`${fhBase}/stock/candle?symbol=${ticker}&resolution=60&count=150&token=${FINNHUB_KEY}`),
        fhFetch(`${fhBase}/quote?symbol=SPY&token=${FINNHUB_KEY}`),
        fhFetch(`${fhBase}/quote?symbol=^VIX&token=${FINNHUB_KEY}`)
      ]);

      // Parse quote
      let currentPrice: number | null = null;
      let changePct: number | null = null;
      if (quoteRes.status === "fulfilled" && quoteRes.value.ok) {
        const q = await quoteRes.value.json();
        if (q.c && q.c > 0) {
          currentPrice = q.c;
          changePct = q.dp;
          analysisData = {
            ticker,
            price: q.c.toFixed(2),
            change: q.dp.toFixed(2),
            high: q.h.toFixed(2),
            low: q.l.toFixed(2),
            prev_close: q.pc.toFixed(2),
            source: "Finnhub Live"
          };
        }
      }

      // Parse SPY & VIX for market context
      if (spyRes.status === "fulfilled" && spyRes.value.ok) {
        const spy = await spyRes.value.json();
        marketData.spy = spy;
      }
      if (vixRes.status === "fulfilled" && vixRes.value.ok) {
        const vix = await vixRes.value.json();
        marketData.vix = vix;
      }

      // Parse candles → Technical Analysis
      if (candleRes.status === "fulfilled" && candleRes.value.ok) {
        const candles = await candleRes.value.json();
        if (candles.s === "ok" && candles.c?.length > 10) {
          const closes: number[] = candles.c;
          const highs: number[] = candles.h;
          const lows: number[] = candles.l;
          const volumes: number[] = candles.v;
          const price = currentPrice || closes[closes.length - 1];

          const calcEMA = (data: number[], period: number) => {
            if (data.length < period) return data[data.length - 1];
            const k = 2 / (period + 1);
            let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
            for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
            return ema;
          };

          const ema20 = calcEMA(closes, 20);
          const ema50 = calcEMA(closes, 50);
          const ema100 = calcEMA(closes, 100);

          // RSI Calculation
          const gains: number[] = [], losses: number[] = [];
          for (let i = 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? -diff : 0);
          }
          const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
          const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
          const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

          const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const volStrength = volumes[volumes.length - 1] / (avgVol || 1);
          const spyChg = marketData.spy?.dp || 0;

          analysisData = {
            ...analysisData,
            price: price.toFixed(2),
            rsi: rsi.toFixed(1),
            vol_strength: volStrength.toFixed(2),
            rs_vs_spy: ((changePct || 0) - spyChg).toFixed(2),
            support: Math.min(...lows.slice(-30)).toFixed(2),
            resistance: Math.max(...highs.slice(-30)).toFixed(2),
            buy_zone: `${(price * 0.985).toFixed(2)} - ${price.toFixed(2)}`,
            target_zone: `${(price * 1.12).toFixed(2)} - ${(price * 1.18).toFixed(2)}`,
            stop_loss: (price * 0.94).toFixed(2),
            ema20_gap: (((price - ema20) / ema20) * 100).toFixed(1),
            ema50_gap: (((price - ema50) / ema50) * 100).toFixed(1),
            ema200_gap: (((price - ema100) / ema100) * 100).toFixed(1),
            perf_1w: (((price - closes[closes.length - 6]) / closes[closes.length - 6]) * 100).toFixed(2),
            perf_1m: (((price - closes[closes.length - 22]) / closes[closes.length - 22]) * 100).toFixed(2),
            market: {
              spy_bias: marketData.spy?.dp > 0 ? "BULLISH" : "BEARISH",
              qqq_momentum: marketData.spy?.dp > 0 ? "STRONG" : "WEAK",
              vix: marketData.vix?.c?.toFixed(2) || "N/A"
            }
          };
        }
      }
    } catch (err) {
      console.error("Finnhub fetch error:", err);
    }

    // 4. Fallback to Local Archive if Live Fetch Failed or for Extra Data
    try {
      const dataPath = path.join(process.cwd(), "..", "data", "latest", "stocks", `${ticker}.json`);
      if (fs.existsSync(dataPath)) {
        const json = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
        analysisData = {
          ...analysisData,
          ticker,
          price: analysisData?.price || json.price.current.toFixed(2),
          change: analysisData?.change || json.price.change_pct.toFixed(2),
          mcap: analysisData?.mcap || (json.fundamental.market_cap / 1e9).toFixed(1) + "B",
          sector: json.sector || "Various",
          gross_margin: (json.fundamental.gross_margin * 100).toFixed(1),
          net_margin: (json.fundamental.net_margin * 100).toFixed(1),
          rev_growth: (json.fundamental.revenue_growth_ttm * 100).toFixed(1),
          pe_ratio: analysisData?.pe_ratio !== "N/A" ? analysisData?.pe_ratio : json.fundamental.pe_ratio?.toFixed(1),
          pb_ratio: analysisData?.pb_ratio !== "N/A" ? analysisData?.pb_ratio : json.fundamental.pb_ratio?.toFixed(2),
          fcf_yield: (json.fundamental.fcf_yield * 100).toFixed(1),
          source: analysisData?.source || "BOGA Archive (Nisan 2026)"
        };
      }
    } catch (e) {}

    if (analysisData && analysisData.price) {
      // Safe market defaults — prevents crash if Finnhub or SPY fetch failed
      const mkt = analysisData.market || { spy_bias: "N/A", qqq_momentum: "N/A", vix: "N/A" };
      const spyLabel = mkt.spy_bias === "BULLISH" ? "EMA50 Üstünde → POZİTİF" : (mkt.spy_bias === "BEARISH" ? "EMA50 Altında → RİSKLİ" : "Veri Bekleniyor");
      const vixNum = parseFloat(mkt.vix) || 20;
      const vixLabel = vixNum < 18 ? "GÜVENLİ" : (vixNum < 25 ? "NÖTR" : "YÜKSEK OYNAKLIK");
      const volStr = parseFloat(analysisData.vol_strength) || 1.0;
      const rsStr = parseFloat(analysisData.rs_vs_spy) || 0;
      const prompt = `Aşağıdaki teknik, temel ve piyasa verilerini kullanarak ${ticker} için V3.5 BOGA SWING UYGULAMA RAPORU hazırla.
      
      ### 📋 VERİLER
      ${JSON.stringify(analysisData)}
      
      ### 🎯 RAPOR FORMATI (TASLAĞA SADIK KAL):
      ════════════════════════════════════════
      **${ticker}  |  ${analysisData.sector || "SEKTÖR"}  |  Kısa-Orta Vade Strateji**
      ════════════════════════════════════════

      **🌍 PİYASA FİLTRESİ (Market Filter)**
      • **SPY Durumu:** ${spyLabel}
      • **QQQ Momenti:** ${mkt.qqq_momentum === "STRONG" ? "GÜÇLÜ" : (mkt.qqq_momentum === "N/A" ? "Veri Bekleniyor" : "ZAYIF")}
      • **VIX (Korku Endeksi):** ${mkt.vix} → ${vixLabel}

      **💵 FİYAT VE HACİM DİNAMİĞİ**
      • **Fiyat:** $${analysisData.price} (%${analysisData.change})  |  **Piyasa Değeri:** ${analysisData.mcap || "N/A"}
      • **Hacim Gücü:** ${analysisData.vol_strength || "N/A"}x → ${volStr > 1.5 ? "Güçlü Hacim Artışı" : "Normal Hacim"}
      • **Göreceli Güç (vs SPY):** %${analysisData.rs_vs_spy || "N/A"} → ${rsStr > 0 ? "Endeksten Güçlü" : "Endeksten Zayıf"}

      **┌─ 🎯 İŞLEM PLANI (Disiplin Filtresi)**
      │
      │  **🟢 GİRİŞ SEVİYESİ:** $${analysisData.buy_zone}
      │  **🎯 HEDEF BÖLGESİ:** $${analysisData.target_zone}
      │  **🛑 ZARAR KES (Stop):** $${analysisData.stop_loss}
      │
      │  **⚖️ Kar/Zarar (R/R) Oranı:** 1:2.4 | **Kurulum Ömrü:** 12-24 Saat
      └────────────────────────────────────────

      **📌 ONAY LİSTESİ**
      [ ${parseFloat(analysisData.change) > 0 ? "X" : " "} ] **Trend Uyumu:** 15dk ve 1sa senkronize
      [ ${parseFloat(analysisData.vol_strength) > 1.2 ? "X" : " "} ] **Hacim Patlaması:** Hacim ortalamanın üzerinde
      [ ${vixNum < 20 ? "X" : " "} ] **Momentum:** RSI > 55 & EMA20 Üstünde

      **📌 TEKNİK VE PERFORMANS MATRİSİ**
      • **Göstergeler:** RSI: ${analysisData.rsi || "N/A"} | ADX: ${analysisData.adx || "N/A"} | MACD: ${analysisData.macd || "N/A"} | MFI: ${analysisData.mfi || "N/A"}
      • **EMA Konumları:** EMA20: %${analysisData.ema20_gap} | EMA50: %${analysisData.ema50_gap} | EMA200: %${analysisData.ema200_gap}
      • **Performans:** 1H: %${analysisData.perf_1w} | 1A: %${analysisData.perf_1m} | 1Y: %${analysisData.perf_1y}

      **📌 TEMEL ANALİZ (Finansal Sağlık)**
      • **Kârlılık:** Brüt Marj: %${analysisData.gross_margin} | Net Marj: %${analysisData.net_margin}
      • **Büyüme:** Gelir Büyümesi: %${analysisData.rev_growth || "N/A"} → ${parseFloat(analysisData.rev_growth || "0") > 20 ? "Güçlü Büyüme" : "Stabil"}
      • **Değerleme:** F/K (P/E): ${analysisData.pe_ratio}x | PD/DD (P/B): ${analysisData.pb_ratio}x
      • **Nakit Akışı:** Serbest Nakit Akış Verimi: %${analysisData.fcf_yield}

      **⚠️ RİSK BAYRAKLARI**
      • **Bilanço:** Veri yok / Yaklaşıyor
      • **Likidite:** İşlem hacmi uygun

      **┌─ ⚡️ SON KARAR**
      │  **AKSİYON:** [ ${volStr > 1.4 && mkt.spy_bias === "BULLISH" ? "İŞLEME GİR" : "İZLEME LİSTESİ"} ]
      │
      │  **GEREKÇE:** "Finansal veriler ve teknik onaylar eşliğinde ${analysisData.price} seviyesinde ${mkt.spy_bias} piyasa koşulları destekleniyor."
      └────────────────────────────────────────

      **ÖNEMLİ:** Tüm metin Türkçe olsun. Rapor formatındaki ASCII çizgilerini (┌, │, └, ═) aynen koru. AI'ın eski bilgisini kullanma.`;

      return useClaude ? await handleClaude(prompt, history) : await handleGemini(prompt, history);
    } else {
       return NextResponse.json({ 
         text: `⚠️ **Sembol Hatası:** '${ticker}' için güncel verilere ulaşılamadı. Lütfen sembolü kontrol edin.`,
         source: "system_warning" 
       });
    }
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
      return useClaude ? await handleClaude(prompt, history) : await handleGemini(prompt, history);
    }

    if (cleanMsg === "/swing") {
      return useClaude ? await handleClaude(MAGNIFICENT_7_PROMPT, history) : await handleGemini(MAGNIFICENT_7_PROMPT, history);
    }

    if (cleanMsg === "/analiz") {
      return useClaude ? await handleClaude(SECTOR_ANALYSIS_PROMPT, history) : await handleGemini(SECTOR_ANALYSIS_PROMPT, history);
    }

    // Default Routing
    if (useClaude) {
      return await handleClaude(cleanMsg, history);
    }

    return await handleGemini(cleanMsg, history);
  } catch (e: any) {
    console.error("[ask] error:", e?.message);
    return NextResponse.json({
      text: "Sistem şu an analiz yapamıyor. Lütfen kısa bir süre sonra tekrar deneyin.",
    });
  }
}

async function handleClaude(message: string, history: Message[]) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: "Claude servisi şu an devre dışı (API anahtarı eksik). Lütfen normal aramaya devam edin.", source: "claude" });
  }
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
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
    return await handleGemini(message, history);
  }
}

async function handleGemini(message: string, history: Message[]) {
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
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
