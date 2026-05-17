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

  // ── BOGA SWING TERMINAL — Yerel JSON Motoru ──────────────────────────────
  const isTicker = /^[a-zA-Z]{1,5}$/.test(cleanMsg);
  if (isTicker && !cleanMsg.startsWith("/")) {
    const ticker = cleanMsg.toUpperCase();

    // Veri yolları (Vercel + lokal uyumlu)
    const dataPaths = [
      path.join(process.cwd(), "..", "data", "latest", "stocks", `${ticker}.json`),
      path.join(process.cwd(), "data", "latest", "stocks", `${ticker}.json`),
      path.join(process.cwd(), "..", "..", "data", "latest", "stocks", `${ticker}.json`),
    ];

    let stockJson: any = null;
    for (const p of dataPaths) {
      try {
        if (fs.existsSync(p)) { stockJson = JSON.parse(fs.readFileSync(p, "utf-8")); break; }
      } catch {}
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

    if (!stockJson) {
      return NextResponse.json({
        text: `⚠️ **Sembol Bulunamadı:** '${ticker}' için sistemde kayıtlı veri yok.\n\nGeçerli semboller için sol menüdeki listeden seçim yapın veya BOGA bot tarafından taranan hisselerden birini deneyin.`,
        source: "system_warning"
      });
    }

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

    const prompt = `Sen BOGA AI swing trading terminalinin analistisin. Aşağıdaki verileri kullanarak ${ticker} için Türkçe BOGA SWING RAPORU yaz. KENDİ BİLGİNİ KULLANMA — sadece verilen sayıları kullan.

════════════════════════════════════════
${ticker}  |  ${s.sector || "N/A"}  |  ${s.company || ""}
════════════════════════════════════════
Tarih: ${s.date || "N/A"}  |  Piyasa Rejimi: ${regime}  |  BOGA Skoru: ${masterScore}/100  |  Sinyal: ${signal}

🌍 PİYASA FİLTRESİ
• Piyasa Rejimi: ${regime}

💵 FİYAT VE HACİM
• Fiyat: $${price} (%${change})  |  Piyasa Değeri: ${mcap}
• Hacim: ${volume}  |  30G Ort: ${avgVol}  |  RVOL: ${rvol}x
• Performans: 1H=%${change1w}  1A=%${change1m}  1Y=%${change1y}

🎯 İŞLEM PLANI
• 🟢 Giriş Bölgesi: $${entryLow} - $${entryHigh}
• 🎯 Hedef Bölge: $${targetLow} - $${targetHigh}
• 🛑 Stop Loss: $${stopLoss}
• ⚖️ R/R: Hesapla ve yaz

📊 TEKNİK MATRİS
• RSI(14): ${rsi}  |  MACD: ${macd}  |  MACD Hist: ${macdHist}
• EMA20: $${ema20}  |  EMA50: $${ema50}  |  EMA200: $${ema200}
• EMA Stack: ${emaStack}
• Bollinger: Alt=$${bbLower}  Üst=$${bbUpper}
• Destek: $${support}  |  Direnç: $${resistance}  |  ATR: $${atr}

💼 FİNANSAL SAĞLIK
• F/K: ${pe}x  |  PD/DD: ${pb}x
• Brüt Marj: ${grossMargin}  |  Net Marj: ${netMargin}
• Gelir Büyümesi: ${revGrowth}  |  FCF Verimi: ${fcfYield}

RAPOR FORMATI (bu yapıyı koru, satırları değiştirme):
════════════════════════════════════════
${ticker} | ${s.sector || ""} | Swing Strateji
════════════════════════════════════════

🌍 PİYASA FİLTRESİ
• Piyasa Rejimi: [veriyi kullan] → [POZİTİF/NÖTR/RİSKLİ]

💵 FİYAT & HACİM
• [veriyi kullan]

┌─ 🎯 İŞLEM PLANI
│  🟢 Giriş: $[...]
│  🎯 Hedef: $[...]
│  🛑 Stop:  $[...]
│  ⚖️ R/R: 1:[hesapla]
└─────────────────

📌 ONAY LİSTESİ
[X/ ] RSI durumu: [değeri yaz ve yorumla]
[X/ ] EMA Stack: [değeri yaz ve yorumla]
[X/ ] Hacim: [RVOL değerini yaz ve yorumla]
[X/ ] Trend yönü: [yorumla]

📊 TEKNİK & PERFORMANS
• [indikatörleri listele]

💼 FİNANSAL SAĞLIK
• [metrikleri listele]

⚡ SON KARAR
│ AKSİYON: [İŞLEME GİR / İZLE / ÇIKIŞ]
│ GEREKÇE: [2-3 cümle, sadece verilen sayılara dayan]
└─────────────────`;

    const aiResponse = useClaude ? await handleClaude(prompt, history) : await handleGemini(prompt, history);
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
