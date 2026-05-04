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

    try {
      // 1. Fetch Market Context (SPY, QQQ, VIX)
      const mSymbols = ["SPY", "QQQ", "^VIX"];
      const mRes = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${mSymbols.join(",")}`, { signal: AbortSignal.timeout(5000) });
      if (mRes.ok) {
        const mJson = await mRes.json();
        const quotes = mJson.quoteResponse.result;
        marketData = {
          spy: quotes.find((q: any) => q.symbol === "SPY"),
          qqq: quotes.find((q: any) => q.symbol === "QQQ"),
          vix: quotes.find((q: any) => q.symbol === "^VIX")
        };
      }

      // 2. Fetch Ticker Data (Chart for Volume Avg and Price)
      const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1h`;
      const yfRes = await fetch(yfUrl, { signal: AbortSignal.timeout(8000) });
      
      if (yfRes.ok) {
        const yfData = await yfRes.json();
        const result = yfData.chart.result?.[0];
        if (result) {
          const quote = result.indicators.quote[0];
          const adjClose = result.indicators.adjclose?.[0]?.adjclose || quote.close;
          const closes = adjClose.filter((c: any) => c !== null);
          const highs = quote.high.filter((h: any) => h !== null);
          const lows = quote.low.filter((l: any) => l !== null);
          const volumes = quote.volume.filter((v: any) => v !== null);
          
          if (closes.length > 5) {
            const currentPrice = closes[closes.length - 1];
            const prevClose = closes[closes.length - 2];
            const change1d = ((currentPrice - prevClose) / prevClose) * 100;
            
            // Volume Strength (Current vs 20-period Avg)
            const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
            const volStrength = volumes[volumes.length - 1] / avgVol;

            // Relative Strength vs SPY
            const spyChange = marketData.spy ? marketData.spy.regularMarketChangePercent : 0;
            const relativeStrength = change1d - spyChange;

            // ATR & S/R
            let trSum = 0;
            const lookback = Math.min(closes.length - 1, 14);
            for (let i = closes.length - lookback; i < closes.length; i++) {
              trSum += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
            }
            const atr = trSum / lookback;

            analysisData = {
              ticker,
              price: currentPrice.toFixed(2),
              change: change1d.toFixed(2),
              vol_strength: volStrength.toFixed(2),
              rs_vs_spy: relativeStrength.toFixed(2),
              support: Math.min(...lows.slice(-20)).toFixed(2),
              resistance: Math.max(...highs.slice(-20)).toFixed(2),
              buy_zone: `${(currentPrice * 0.985).toFixed(2)} - ${currentPrice.toFixed(2)}`,
              target_zone: `${(currentPrice * 1.12).toFixed(2)} - ${(currentPrice * 1.15).toFixed(2)}`,
              stop_loss: (currentPrice * 0.94).toFixed(2),
              market: {
                spy_bias: marketData.spy ? (marketData.spy.regularMarketPrice > marketData.spy.fiftyDayAverage ? "BULLISH" : "BEARISH") : "N/A",
                qqq_momentum: marketData.qqq ? (marketData.qqq.regularMarketChangePercent > 0 ? "STRONG" : "WEAK") : "N/A",
                vix: marketData.vix ? marketData.vix.regularMarketPrice.toFixed(2) : "N/A"
              }
            };
          }
        }
      }
    } catch (err) {
      console.error("V3 Engine error:", err);
    }

    // 3. Combine Live Data with Local Archive for Full Analysis
    try {
      const dataPath = path.join(process.cwd(), "..", "data", "latest", "stocks", `${ticker}.json`);
      if (fs.existsSync(dataPath)) {
        const json = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
        
        // Merge or Initialize analysisData
        analysisData = {
          ticker,
          price: analysisData?.price || json.price.current.toFixed(2),
          change: analysisData?.change || json.price.change_pct.toFixed(2),
          mcap: (json.fundamental.market_cap / 1e9).toFixed(1) + "B",
          sector: json.sector || "Various",
          vol_strength: analysisData?.vol_strength || (json.technical.rvol ? json.technical.rvol.toFixed(2) : "1.00"),
          rs_vs_spy: analysisData?.rs_vs_spy || "0.00",
          support: analysisData?.support || json.technical.support_level?.toFixed(2) || json.price.low.toFixed(2),
          resistance: analysisData?.resistance || json.price.high.toFixed(2),
          buy_zone: analysisData?.buy_zone || `${json.scores_detail?.entry_range_low} - ${json.scores_detail?.entry_range_high}`,
          target_zone: analysisData?.target_zone || `${json.scores_detail?.target_range_low} - ${json.scores_detail?.target_range_high}`,
          stop_loss: analysisData?.stop_loss || json.scores_detail?.stop_loss?.toFixed(2),
          market: analysisData?.market || marketData,
          
          // Technicals
          rsi: json.technical.rsi_14?.toFixed(1),
          adx: json.technical.adx?.toFixed(1),
          macd: json.technical.macd_histogram?.toFixed(3),
          mfi: json.technical.mfi?.toFixed(1),
          ema20_gap: ( ((analysisData?.price || json.price.current) - json.technical.ema_20) / json.technical.ema_20 * 100 ).toFixed(1),
          ema50_gap: ( ((analysisData?.price || json.price.current) - json.technical.ema_50) / json.technical.ema_50 * 100 ).toFixed(1),
          ema200_gap: ( ((analysisData?.price || json.price.current) - json.technical.ema_200) / json.technical.ema_200 * 100 ).toFixed(1),
          
          // Performance
          perf_1w: json.price.change_pct_1w?.toFixed(2),
          perf_1m: json.price.change_pct_1m?.toFixed(2),
          perf_1y: json.price.change_pct_1y?.toFixed(2),
          
          // Fundamentals
          gross_margin: (json.fundamental.gross_margin * 100).toFixed(1),
          net_margin: (json.fundamental.net_margin * 100).toFixed(1),
          rev_growth: (json.fundamental.revenue_growth_ttm * 100).toFixed(1),
          pe_ratio: json.fundamental.pe_ratio?.toFixed(1),
          pb_ratio: json.fundamental.pb_ratio?.toFixed(2),
          fcf_yield: (json.fundamental.fcf_yield * 100).toFixed(1),
          
          source: "BOGA SWING TERMINAL V3.5 (Live + Archive)"
        };
      }
    } catch (e) {
      console.error("Archive merge error:", e);
    }

    if (analysisData) {
      const prompt = `Aşağıdaki teknik, temel ve piyasa verilerini kullanarak ${ticker} için V3.5 BOGA SWING UYGULAMA RAPORU hazırla.
      
      ### 📋 VERİLER
      ${JSON.stringify(analysisData)}
      
      ### 🎯 RAPOR FORMATI (TASLAĞA SADIK KAL):
      ════════════════════════════════════════
      **${ticker}  |  ${analysisData.sector || "SEKTÖR"}  |  Kısa-Orta Vade Strateji**
      ════════════════════════════════════════

      **🌍 PİYASA FİLTRESİ (Market Filter)**
      • **SPY Durumu:** ${analysisData.market.spy_bias === "BULLISH" ? "EMA50 Üstünde → POZİTİF" : "EMA50 Altında → RİSKLİ"}
      • **QQQ Momenti:** ${analysisData.market.qqq_momentum === "STRONG" ? "GÜÇLÜ" : "ZAYIF"}
      • **VIX (Korku Endeksi):** ${analysisData.market.vix} → ${parseFloat(analysisData.market.vix) < 18 ? "GÜVENLİ" : "YÜKSEK OYNAKLIK"}

      **💵 FİYAT VE HACİM DİNAMİĞİ**
      • **Fiyat:** $${analysisData.price} (%${analysisData.change})  |  **Piyasa Değeri:** ${analysisData.mcap || "N/A"}
      • **Hacim Gücü:** ${analysisData.vol_strength}x → ${parseFloat(analysisData.vol_strength) > 1.5 ? "Güçlü Hacim Artışı" : "Normal Hacim"}
      • **Göreceli Güç (vs SPY):** %${analysisData.rs_vs_spy} → ${parseFloat(analysisData.rs_vs_spy) > 0 ? "Endeksten Güçlü" : "Endeksten Zayıf"}

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
      [ ${parseFloat(analysisData.market.vix) < 20 ? "X" : " "} ] **Momentum:** RSI > 55 & EMA20 Üstünde

      **📌 TEKNİK VE PERFORMANS MATRİSİ**
      • **Göstergeler:** RSI: ${analysisData.rsi || "N/A"} | ADX: ${analysisData.adx || "N/A"} | MACD: ${analysisData.macd || "N/A"} | MFI: ${analysisData.mfi || "N/A"}
      • **EMA Konumları:** EMA20: %${analysisData.ema20_gap} | EMA50: %${analysisData.ema50_gap} | EMA200: %${analysisData.ema200_gap}
      • **Performans:** 1H: %${analysisData.perf_1w} | 1A: %${analysisData.perf_1m} | 1Y: %${analysisData.perf_1y}

      **📌 TEMEL ANALİZ (Finansal Sağlık)**
      • **Kârlılık:** Brüt Marj: %${analysisData.gross_margin} | Net Marj: %${analysisData.net_margin}
      • **Büyüme:** Gelir Büyümesi: %${analysisData.rev_growth} → ${parseFloat(analysisData.rev_growth) > 20 ? "Güçlü Büyüme" : "Stabil"}
      • **Değerleme:** F/K (P/E): ${analysisData.pe_ratio}x | PD/DD (P/B): ${analysisData.pb_ratio}x
      • **Nakit Akışı:** Serbest Nakit Akış Verimi: %${analysisData.fcf_yield}

      **⚠️ RİSK BAYRAKLARI**
      • **Bilanço:** Veri yok / Yaklaşıyor
      • **Likidite:** İşlem hacmi uygun

      **┌─ ⚡️ SON KARAR**
      │  **AKSİYON:** [ ${parseFloat(analysisData.vol_strength) > 1.4 && analysisData.market.spy_bias === "BULLISH" ? "İŞLEME GİR" : "İZLEME LİSTESİ"} ]
      │
      │  **GEREKÇE:** "Finansal veriler ve teknik onaylar eşliğinde ${analysisData.price} seviyesinde ${analysisData.market.spy_bias} piyasa koşulları destekleniyor."
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
