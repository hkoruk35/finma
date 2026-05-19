import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

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

function calculateSupportResistance1h(
  closes1d: number[],
  highs1d: number[],
  lows1d: number[],
  closes1h: number[] | null,
  highs1h: number[] | null,
  lows1h: number[] | null,
  opens1h: number[] | null,
  volumes1h: number[] | null,
  currentPrice: number
) {
  // 1. Daily macro structure and ATR
  const period = 14;
  const trs: number[] = [];
  for (let i = 1; i < closes1d.length; i++) {
    const hl = highs1d[i] - lows1d[i];
    const hc = Math.abs(highs1d[i] - closes1d[i - 1]);
    const lc = Math.abs(lows1d[i] - closes1d[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  let sum = 0;
  for (let i = Math.max(0, trs.length - period); i < trs.length; i++) {
    sum += trs[i];
  }
  const atr_1d = trs.length > 0 ? (sum / Math.min(period, trs.length)) : currentPrice * 0.03;
  const atr_pct = (atr_1d / currentPrice) * 100;

  const macro_support = Math.min(...lows1d.slice(-10));
  const macro_resist = Math.max(...highs1d.slice(-15));

  let support_1h = macro_support;
  let resist_1h = macro_resist;

  let entry_valid = false;
  let entry_type = "WAITING_FOR_VOLUME_OR_SWEEP";
  let entry_confidence = 0;

  if (closes1h && closes1h.length >= 20 && highs1h && lows1h && opens1h && volumes1h) {
    const curr_c = closes1h[closes1h.length - 1];
    const curr_o = opens1h[opens1h.length - 1];
    const curr_h = highs1h[highs1h.length - 1];
    const curr_l = lows1h[lows1h.length - 1];
    const curr_v = volumes1h[volumes1h.length - 1];

    const prev_c = closes1h[closes1h.length - 2];
    const prev_o = opens1h[opens1h.length - 2];

    const pivot_lows: number[] = [];
    const pivot_highs: number[] = [];
    for (let i = 2; i < lows1h.length - 2; i++) {
      if (lows1h[i] < lows1h[i-1] && lows1h[i] < lows1h[i+1]) {
        pivot_lows.push(lows1h[i]);
      }
      if (highs1h[i] > highs1h[i-1] && highs1h[i] > highs1h[i+1]) {
        pivot_highs.push(highs1h[i]);
      }
    }

    const supports_below = pivot_lows.filter(p => p < currentPrice - (atr_1d * 0.4));
    if (supports_below.length > 0) {
      support_1h = Math.max(Math.max(...supports_below), macro_support);
    }

    const resists_above = pivot_highs.filter(p => p > currentPrice + (atr_1d * 0.5));
    if (resists_above.length > 0) {
      resist_1h = Math.min(Math.min(...resists_above), macro_resist);
    }

    const vol_slice = volumes1h.slice(-20);
    const vol_avg_20 = vol_slice.reduce((a, b) => a + b, 0) / 20;
    const is_green_candle = curr_c > curr_o;
    const volume_spike_breakout = (curr_v > vol_avg_20 * 1.3) && is_green_candle;
    const volume_spike_sweep = (curr_v > vol_avg_20 * 1.8) && is_green_candle;

    const body = Math.abs(curr_c - curr_o);
    const lower_wick = Math.min(curr_c, curr_o) - curr_l;
    const upper_wick = curr_h - Math.max(curr_c, curr_o);

    const is_pinbar = (lower_wick > body * 2.0) && (upper_wick < body * 0.5);
    const is_bullish_engulfing = is_green_candle && (prev_c < prev_o) && (curr_c > prev_o) && (curr_o < prev_c);

    const is_liquidity_sweep = (curr_l < support_1h) && (curr_c > support_1h);
    
    const recent_high_slice = highs1h.slice(-11, -1);
    const recent_local_high = recent_high_slice.length > 0 ? Math.max(...recent_high_slice) : Math.max(...highs1h.slice(0, -1));
    const is_bos = (curr_c > recent_local_high) && volume_spike_breakout;

    const is_pullback = (curr_l >= support_1h && curr_l <= support_1h + (atr_1d * 0.3));

    const ema20_1h = calcEMA(closes1h, 20);
    const roc_1h = prev_c > 0 ? ((curr_c - prev_c) / prev_c) * 100 : 0.0;
    const is_early_momentum = (curr_c > ema20_1h) && (roc_1h > 0.8) && (curr_v > vol_avg_20 * 1.15);

    if (is_liquidity_sweep && (is_pinbar || volume_spike_sweep)) {
      entry_valid = true;
      entry_type = "REVERSAL (Liquidity Sweep)";
      entry_confidence = 95;
    } else if (is_bos) {
      entry_valid = true;
      entry_type = "BREAKOUT (BOS)";
      entry_confidence = 85;
    } else if (is_early_momentum) {
      entry_valid = true;
      entry_type = "EARLY MOMENTUM";
      entry_confidence = 80;
    } else if (is_pullback && (is_pinbar || is_bullish_engulfing) && volume_spike_breakout) {
      entry_valid = true;
      entry_type = "PULLBACK";
      entry_confidence = 80;
    }
  }

  if ((currentPrice - support_1h) < (atr_1d * 0.6)) {
    support_1h = currentPrice - (atr_1d * 0.8);
  }

  const is_momentum_entry = entry_valid && ["BREAKOUT (BOS)", "REVERSAL (Liquidity Sweep)"].includes(entry_type);

  let buy_zone_low = 0;
  let buy_zone_high = 0;

  if (is_momentum_entry) {
    buy_zone_low = currentPrice - (atr_1d * 0.25);
    buy_zone_high = currentPrice + (atr_1d * 0.15);
  } else {
    buy_zone_low = support_1h + (atr_1d * 0.2);
    buy_zone_high = currentPrice + (atr_1d * 0.1);
  }

  if (buy_zone_low >= buy_zone_high) {
    buy_zone_low = buy_zone_high - (atr_1d * 0.3);
  }

  const stop_high = support_1h - (atr_1d * 0.5);
  const stop_low = stop_high - (atr_1d * 0.2);

  const avg_entry = entry_valid ? (currentPrice * 0.995) : ((buy_zone_low + buy_zone_high) / 2);
  const risk = Math.max(avg_entry - stop_high, atr_1d * 1.0);

  const structural_reward = resist_1h - avg_entry;
  let reward = structural_reward > 0 ? Math.max(risk * 2.0, structural_reward) : risk * 2.5;

  const rr_cap = 4.0;
  if (reward > risk * rr_cap) {
    reward = risk * rr_cap;
  }

  const sell_zone_low = avg_entry + reward * 0.85;
  const sell_zone_high = avg_entry + reward;

  const actual_risk = avg_entry - stop_high;
  const actual_reward = sell_zone_high - avg_entry;
  const rr_ratio = actual_risk > 0 ? actual_reward / actual_risk : 0.0;

  return {
    entry_engine: {
      valid: entry_valid,
      type: entry_type,
      confidence: entry_confidence
    },
    buy_zone: { low: Number(buy_zone_low.toFixed(2)), high: Number(buy_zone_high.toFixed(2)) },
    sell_zone: { low: Number(sell_zone_low.toFixed(2)), high: Number(sell_zone_high.toFixed(2)) },
    stop_zone: { low: Number(stop_low.toFixed(2)), high: Number(stop_high.toFixed(2)) },
    support_1h: Number(support_1h.toFixed(2)),
    resist_1h: Number(resist_1h.toFixed(2)),
    atr_1d: Number(atr_1d.toFixed(2)),
    atr_pct: Number(atr_pct.toFixed(2)),
    rr_ratio: Number(rr_ratio.toFixed(2)),
    risk_usd: Number(actual_risk.toFixed(2)),
    reward_usd: Number(actual_reward.toFixed(2))
  };
}

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

    const timing = calculateSupportResistance1h(
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
        atr: timing.atr_1d,
        atr_pct: timing.atr_pct,
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
        entry_range_low: timing.buy_zone.low,
        entry_range_high: timing.buy_zone.high,
        target_range_low: timing.sell_zone.low,
        target_range_high: timing.sell_zone.high,
        stop_loss: timing.stop_zone.high,
        risk_reward_ratio: timing.rr_ratio,
        entry_engine: timing.entry_engine
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

    if (!stockJson) {
      return NextResponse.json({
        text: `⚠️ **Sembol Bulunamadı:** '${ticker}' için BOGA Finance AI veya yerel sistemde geçerli veri bulunamadı. Lütfen geçerli bir borsa sembolü girin (Örn: AAPL, TSLA, CLDX, MSFT).`,
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

    const prompt = `Sen BOGA AI swing trading terminalinin analistisin. Aşağıdaki verileri kullanarak ${ticker} için BOGA SWING RAPORU yaz.
Kritik Kurallar (Format Bütünlüğü):
1. Rapor formatını, başlıkları, emojileri ve etiketleri kesinlikle TÜRKÇE format şablonunda birebir korumalısın. Başlıkları asla başka bir dile çevirme (Örn: "🌍 PİYASA FİLTRESİ", "💵 FİYAT & HACİM", "┌─ 🎯 İŞLEM PLANI", "📌 ONAY LİSTESİ", "📊 TEKNİK & PERFORMANS", "💼 FİNANSAL SAĞLIK", "⚡ SON KARAR", "AKSİYON", "GEREKÇE" ifadeleri aynen Türkçe olarak kalmalıdır).
2. Sadece ve sadece başlıkların altındaki açıklamaları, onay listesi yorumlarını ve gerekçeyi (GEREKÇE) kullanıcının sorduğu/istediği dilde (İngilizce ise İngilizce, Türkçe ise Türkçe, Almanca ise Almanca, İspanyolca ise İspanyolca, Arapça ise Arapça vb.) yaz.
3. Çıktıya kesinlikle hiçbir ön konuşma veya açıklama ekleme ("İşte raporunuz...", "Gerne..." gibi ifadeler kesinlikle yasaktır). Çıktı doğrudan '════════════════════════════════════════' ile başlamalıdır.

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
• Hedef Bölge: $${targetLow} - $${targetHigh}
• Stop Loss: $${stopLoss}

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
│  🎯 Hedef: $${targetLow} - $${targetHigh}
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
│ GEREKÇE: [2-3 cümle ile sadece verilen sayılara dayanarak kullanıcının dilediği dilde gerekçe yaz]
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
