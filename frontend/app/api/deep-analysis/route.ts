import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const maxDuration = 90;

// ── 1-hour in-memory cache ─────────────────────────────────────────────────────
const cache = new Map<string, { ts: number; data: any }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour ms

// ── Persistent file cache (ticker + date + version) ───────────────────────────
// 3 versions per day: v1=00-08h, v2=08-16h, v3=16-24h (covers pre-market, session, post-close)
const ANALYSIS_CACHE_DIR = path.join(process.cwd(), ".analysis-cache");

function getPersistentCacheKey(ticker: string, lang: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const h = new Date().getHours();
  const version = h < 8 ? 1 : h < 16 ? 2 : 3;
  return `${ticker.toUpperCase()}_${date}_v${version}_${lang}`;
}

async function readPersistentCache(key: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(path.join(ANALYSIS_CACHE_DIR, `${key}.json`), "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}

async function writePersistentCache(key: string, data: any): Promise<void> {
  try {
    await fs.mkdir(ANALYSIS_CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(ANALYSIS_CACHE_DIR, `${key}.json`), JSON.stringify(data), "utf-8");
  } catch (e: any) {
    console.warn("[deep-analysis] file cache write failed:", e?.message);
  }
}

// ── Sector peer map ───────────────────────────────────────────────────────────
const SECTOR_PEERS: Record<string, string[]> = {
  "Technology": ["AAPL", "MSFT", "NVDA", "META", "GOOGL", "AMZN", "AMD", "ORCL"],
  "Communication Services": ["META", "GOOGL", "NFLX", "DIS", "T", "VZ", "SNAP", "PINS"],
  "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "TGT", "BKNG"],
  "Consumer Defensive": ["WMT", "PG", "KO", "PEP", "COST", "MO", "PM", "CL"],
  "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "ABT", "LLY"],
  "Financial Services": ["JPM", "BAC", "WFC", "GS", "MS", "BRK-B", "C", "AXP"],
  "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "PXD", "MPC", "PSX"],
  "Industrials": ["GE", "CAT", "HON", "UPS", "BA", "RTX", "MMM", "DE"],
  "Basic Materials": ["LIN", "FCX", "NEM", "APD", "DD", "NUE", "ALB", "CF"],
  "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "PSA", "SPG", "O", "WELL"],
  "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL"],
};

// ── Yahoo Finance Auth (Crumb/Cookie) ─────────────────────────────────────────
const YF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
let _yfCrumb: string | null = null;
let _yfCookie: string | null = null;
let _yfCrumbTs = 0;
const YF_CRUMB_TTL = 50 * 60 * 1000; // 50 dakika

async function getYFAuth(): Promise<{ crumb: string; cookie: string } | null> {
  if (_yfCrumb && _yfCookie && Date.now() - _yfCrumbTs < YF_CRUMB_TTL) {
    return { crumb: _yfCrumb, cookie: _yfCookie };
  }
  try {
    // Step 1: Yahoo Finance cookie al
    const homeRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": YF_UA, "Accept": "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    const raw = homeRes.headers.get("set-cookie") || "";
    // A3 cookie en kararlısı
    const a3 = raw.match(/A3=([^;]+)/)?.[1];
    const a1 = raw.match(/A1=([^;]+)/)?.[1];
    const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");

    // Step 2: Crumb al
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YF_UA, "Accept": "text/plain", "Cookie": cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (crumbRes.ok) {
      const crumb = (await crumbRes.text()).trim();
      if (crumb && crumb.length < 20) {
        _yfCrumb = crumb;
        _yfCookie = cookie;
        _yfCrumbTs = Date.now();
        return { crumb, cookie };
      }
    }
  } catch (e: any) {
    console.warn("[deep-analysis] YF auth failed:", e?.message);
  }
  return null;
}

async function fetchYFSummary(ticker: string): Promise<any> {
  const auth = await getYFAuth();
  const modules = "insiderTransactions,recommendationTrend,upgradeDowngradeHistory,financialData,institutionOwnership,earningsHistory,calendarEvents";
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
  const headers: Record<string, string> = { "User-Agent": YF_UA, "Accept": "application/json" };
  if (auth?.cookie) headers["Cookie"] = auth.cookie;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}${crumbParam}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const json = await res.json();
      const result = json?.quoteSummary?.result?.[0] ?? null;
      if (result) {
        const keys = Object.keys(result);
        console.log(`[deep-analysis] quoteSummary OK: ${keys.join(", ")}`);
      }
      return result;
    }
    console.warn(`[deep-analysis] quoteSummary HTTP ${res.status}`);
    // 401 gelirse crumb'ı sıfırla
    if (res.status === 401) { _yfCrumb = null; _yfCookie = null; }
  } catch (e: any) {
    console.warn("[deep-analysis] quoteSummary error:", e?.message);
  }
  return null;
}

// ── Peer comparison fetch ─────────────────────────────────────────────────────
async function fetchPeerData(currentTicker: string, sector: string): Promise<any[]> {
  const allPeers = SECTOR_PEERS[sector] ?? SECTOR_PEERS["Technology"];
  const peers = allPeers.filter(t => t !== currentTicker.toUpperCase()).slice(0, 5);
  if (!peers.length) return [];
  try {
    const headers = { "User-Agent": YF_UA, "Accept": "application/json" };
    const symbols = peers.join(",");
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,marketCap,fiftyDayAverage`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.quoteResponse?.result ?? []).map((q: any) => ({
      ticker:     q.symbol ?? "",
      name:       q.shortName ?? q.symbol ?? "",
      price:      +(q.regularMarketPrice ?? 0).toFixed(2),
      changePct:  +(q.regularMarketChangePercent ?? 0).toFixed(2),
      marketCap:  q.marketCap ?? 0,
      rs20d:      0, // filled in by fetchPeer20dChanges
    }));
  } catch (e: any) {
    console.warn("[deep-analysis] peer fetch:", e?.message);
    return [];
  }
}

// ── 20-day RS for peers ───────────────────────────────────────────────────────
async function fetchPeer20dChanges(tickers: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  await Promise.all(tickers.map(async (t) => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=1mo&interval=1d`,
        { headers: { "User-Agent": YF_UA }, signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return;
      const data = await res.json();
      const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
      const valid = closes.filter((c): c is number => c != null);
      if (valid.length >= 2) {
        results[t] = +((valid[valid.length - 1] - valid[0]) / valid[0] * 100).toFixed(1);
      }
    } catch {}
  }));
  return results;
}

// ── News translation (TR only) ────────────────────────────────────────────────
async function translateNewsTitles(titles: string[]): Promise<string[]> {
  if (!titles.length) return titles;
  const prompt = `You are a professional financial news translator (English → Turkish).

Rules:
- Use natural, fluent financial Turkish (not machine translation)
- Keep company names, ticker symbols, and numbers unchanged
- Use correct financial terms: "hisse senedi", "kazanç", "bilanço", "yatırımcı", "hisse başına kâr", "hedef fiyat", "yükseltme", "düşürme", "not artırımı", "not indirimi", "kâr açıklaması", "borç", "gelir", "büyüme", "faiz oranı", "merkez bankası", "enflasyon"
- Translate idioms naturally ("beat estimates" → "tahminleri aştı", "raised guidance" → "beklentilerini yükseltti", "missed earnings" → "kazanç beklentisini karşılayamadı")
- Headlines must read like a real Turkish financial newspaper

Return ONLY a valid JSON array of strings, same count as input, no explanations.

Input: ${JSON.stringify(titles)}`;
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 1024,
        system: "You are a financial translator. Return ONLY a valid JSON array of strings.",
        messages: [{ role: "user", content: prompt }],
      });
      const raw = (msg.content[0] as any).text || "";
      const start = raw.indexOf("["); const end = raw.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        if (Array.isArray(parsed) && parsed.length === titles.length) return parsed;
      }
    } else if (process.env.GEMINI_API_KEY) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const start = raw.indexOf("["); const end = raw.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(raw.slice(start, end + 1));
          if (Array.isArray(parsed) && parsed.length === titles.length) return parsed;
        }
      }
    }
  } catch (e: any) {
    console.warn("[deep-analysis] translate news:", e?.message);
  }
  return titles; // fallback: return original English
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function safeNum(v: any, fb = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fb;
}
function calcEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}
function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (trs.length < period) return trs[trs.length - 1] || 0;
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}
// ── Live indicator calculations from OHLC (overrides stale stockData values) ──
function calcRSI14(closes: number[]): number {
  if (closes.length < 15) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const period = 14;
  // Initial averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  // Wilder smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  const rs = avgGain / (avgLoss || 1e-9);
  return +Math.min(100, Math.max(0, 100 - 100 / (1 + rs))).toFixed(1);
}

/** Real pivot-based support/resistance from OHLC bars */
function buildSRFromPivots(
  rows: Array<{ high: number; low: number; close: number }>,
  currentPrice: number,
  low52w: number,
  high52w: number
) {
  const WIN = 7; // local-extrema look-around window (7 bars = ~1.5 weeks, robust on 1y daily data)
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];

  for (let i = WIN; i < rows.length - WIN; i++) {
    const bar = rows[i];
    const leftH = rows.slice(i - WIN, i).map(r => r.high);
    const rightH = rows.slice(i + 1, i + WIN + 1).map(r => r.high);
    const leftL = rows.slice(i - WIN, i).map(r => r.low);
    const rightL = rows.slice(i + 1, i + WIN + 1).map(r => r.low);

    if (bar.high >= Math.max(...leftH) && bar.high >= Math.max(...rightH)) {
      pivotHighs.push(bar.high);
    }
    if (bar.low <= Math.min(...leftL) && bar.low <= Math.min(...rightL)) {
      pivotLows.push(bar.low);
    }
  }

  // Cluster nearby pivots (within 0.5% of each other)
  const cluster = (vals: number[], pct = 0.008) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const out: number[] = [];
    let last = -Infinity;
    for (const v of sorted) {
      if (v - last > last * pct) { out.push(v); last = v; }
    }
    return out;
  };

  const resistances = cluster(pivotHighs).filter(h => h > currentPrice * 0.995);
  const supports    = cluster(pivotLows ).filter(l => l < currentPrice * 1.005).reverse();

  // Fill gaps with percentage fallbacks if not enough pivots
  const r1 = resistances[0] ?? +(currentPrice * 1.04).toFixed(2);
  const r2 = resistances[1] ?? +(Math.max(r1 * 1.04, currentPrice * 1.08)).toFixed(2);
  const r3 = resistances[2] ?? +(Math.max(r2 * 1.04, high52w)).toFixed(2);
  const s1 = supports[0]    ?? +(currentPrice * 0.96).toFixed(2);
  const s2 = supports[1]    ?? +(Math.min(s1 * 0.95, currentPrice * 0.91)).toFixed(2);
  const s3 = supports[2]    ?? +(Math.min(s2 * 0.95, low52w)).toFixed(2);

  return {
    resistance3: +Math.max(r3, high52w).toFixed(2),
    resistance2: +r2.toFixed(2),
    resistance1: +r1.toFixed(2),
    support1:    +s1.toFixed(2),
    support2:    +s2.toFixed(2),
    support3:    +Math.min(s3, low52w).toFixed(2),
  };
}

// ── Volume / Flow indicators ──────────────────────────────────────────────────
function calcOBV(rows: Array<{ close: number; volume: number }>): number[] {
  let obv = 0;
  return rows.map((r, i) => {
    if (i === 0) return 0;
    if (r.close > rows[i - 1].close) obv += r.volume;
    else if (r.close < rows[i - 1].close) obv -= r.volume;
    return obv;
  });
}

function calcAD(rows: Array<{ high: number; low: number; close: number; volume: number }>): number[] {
  let ad = 0;
  return rows.map(r => {
    const mfm = r.high !== r.low ? ((r.close - r.low) - (r.high - r.close)) / (r.high - r.low) : 0;
    ad += mfm * r.volume;
    return ad;
  });
}

function calcMFI(rows: Array<{ high: number; low: number; close: number; volume: number }>, period = 14): number {
  if (rows.length < period + 1) return 50;
  const tp = rows.map(r => (r.high + r.low + r.close) / 3);
  let pos = 0, neg = 0;
  for (let i = rows.length - period; i < rows.length; i++) {
    const mf = tp[i] * rows[i].volume;
    if (tp[i] > tp[i - 1]) pos += mf; else neg += mf;
  }
  return +(100 - 100 / (1 + pos / (neg || 1))).toFixed(1);
}

function calcEMASlope(closes: number[], period: number): "yükselen" | "yatay" | "düşen" {
  if (closes.length < period + 5) return "yatay";
  const recent = calcEMA(closes, period);
  const older  = calcEMA(closes.slice(0, -5), period);
  const pct    = older > 0 ? (recent - older) / older * 100 : 0;
  if (pct >  0.4) return "yükselen";
  if (pct < -0.4) return "düşen";
  return "yatay";
}

function classifyEMAProfile(
  currentPrice: number, ema20: number, ema50: number, ema200: number,
  marketCap: number, goldenCross: boolean
): { profile: "A" | "B" | "C"; label: string; keyEMA: string; desc: string } {
  const aboveAll = currentPrice > ema20 && currentPrice > ema50 && currentPrice > ema200;
  if (aboveAll && goldenCross && marketCap > 10e9) {
    return { profile: "A", label: "Kurumsal", keyEMA: "EMA20",
      desc: "Bu bir EMA20 hissesidir — kırılım değerlendirmesi EMA20 üzerinden yapılmalıdır." };
  }
  if ((currentPrice > ema50 || currentPrice > ema200) && marketCap > 1e9) {
    return { profile: "B", label: "Büyüme", keyEMA: "EMA50",
      desc: "Bu bir EMA50 hissesidir — kırılım değerlendirmesi EMA50 üzerinden yapılmalıdır." };
  }
  return { profile: "C", label: "Spekülatif", keyEMA: "EMA200",
    desc: "Bu bir EMA200 hissesidir — kırılım değerlendirmesi EMA200 üzerinden yapılmalıdır." };
}

function calcFlowSummary(obvArr: number[], adArr: number[], mfi: number, currentPrice: number, rows: Array<{ close: number; volume: number }>) {
  const n = Math.min(20, obvArr.length);
  const obvRecent = obvArr.slice(-n);
  const adRecent  = adArr.slice(-n);
  const obvTrend  = obvRecent[n - 1] > obvRecent[0] ? "yükselen" : obvRecent[n - 1] < obvRecent[0] ? "düşen" : "yatay";
  const adTrend   = adRecent[n - 1] > adRecent[0]  ? "yükselen" : adRecent[n - 1] < adRecent[0]  ? "düşen" : "yatay";

  // Price vs OBV divergence check (last 10 bars)
  const recentRows = rows.slice(-10);
  const priceUp  = recentRows[recentRows.length - 1].close > recentRows[0].close;
  const obvUp    = obvArr[obvArr.length - 1] > obvArr[obvArr.length - 10];
  const divergence = (priceUp && !obvUp) ? "negatif" : (!priceUp && obvUp) ? "pozitif" : "yok";

  // Price-volume pattern last bar
  const last = recentRows[recentRows.length - 1];
  const prev = recentRows[recentRows.length - 2];
  const avgVol = recentRows.reduce((s, r) => s + r.volume, 0) / recentRows.length;
  let pvPattern = "nötr";
  if (last.close > prev.close && last.volume > avgVol * 1.3) pvPattern = "güçlü birikim";
  else if (last.close < prev.close && last.volume > avgVol * 1.3) pvPattern = "güçlü dağıtım";
  else if (last.close > prev.close && last.volume < avgVol * 0.7) pvPattern = "zayıf yükseliş";
  else if (last.close < prev.close && last.volume < avgVol * 0.7) pvPattern = "normal geri çekilme";

  return { obvTrend, adTrend, mfi, divergence, pvPattern,
    mfiLabel: mfi > 80 ? "Aşırı Alım" : mfi < 20 ? "Aşırı Satım" : "Normal" };
}

/** Compute all live indicators from 60-day OHLC */
function calcLiveIndicators(rows: Array<{ open: number; high: number; low: number; close: number; volume: number }>) {
  const closes  = rows.map(r => r.close);
  const highs   = rows.map(r => r.high);
  const lows    = rows.map(r => r.low);
  const volumes = rows.map(r => r.volume);

  const rsi14  = calcRSI14(closes);
  const ema20  = calcEMA(closes, 20);
  const ema50  = calcEMA(closes, 50);
  const atr14  = calcATR(highs, lows, closes, 14);
  const hv30   = (() => {
    const returns = closes.slice(-31).map((c, i, a) => i === 0 ? 0 : Math.log(c / a[i - 1]));
    const mean = returns.slice(1).reduce((a, b) => a + b, 0) / 30;
    const variance = returns.slice(1).reduce((a, b) => a + (b - mean) ** 2, 0) / 29;
    return +Math.sqrt(variance * 252) * 100;
  })();
  const avgVol30d = volumes.slice(-30).reduce((a, b) => a + b, 0) / 30;
  const rvol      = volumes.length > 0 ? +(volumes[volumes.length - 1] / (avgVol30d || 1)).toFixed(2) : 1;

  // MACD (12/26/9 EMA difference)
  const ema12  = calcEMA(closes, 12);
  const ema26  = calcEMA(closes, 26);
  const macd   = +(ema12 - ema26).toFixed(3);

  return { rsi14, ema20, ema50, atr14, hv30, avgVol30d, rvol, macd };
}

// Rough Black-Scholes approximation for OTM put premium
function estimatePutPremium(spot: number, strike: number, iv: number, dte: number): number {
  const ivDec = iv / 100;
  const t = dte / 252;
  const otmPct = Math.max(0, (spot - strike) / spot);
  const atm = spot * ivDec * Math.sqrt(t) * 0.4;
  const discount = Math.exp(-otmPct * 12);
  return Math.max(0.01, atm * discount);
}

// ── Yahoo Finance historical fetch ────────────────────────────────────────────
async function fetchHistory(ticker: string) {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Referer": "https://finance.yahoo.com/",
    };
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { rows: null, marketCap: 0 };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { rows: null, marketCap: 0 };
    const ts: number[] = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const opens: number[] = q.open || [];
    const closes: number[] = q.close || [];
    const highs: number[] = q.high || [];
    const lows: number[] = q.low || [];
    const volumes: number[] = q.volume || [];
    let marketCap = safeNum(result.meta?.marketCap, 0);

    // Fallback: Yahoo Finance quote API for marketCap if chart API didn't return it
    if (!marketCap) {
      try {
        const qUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d&includePrePost=false`;
        const qRes = await fetch(qUrl, { headers, signal: AbortSignal.timeout(5000) });
        if (qRes.ok) {
          const qData = await qRes.json();
          marketCap = safeNum(qData?.chart?.result?.[0]?.meta?.marketCap, 0);
        }
      } catch { /* ignore */ }
    }
    if (!marketCap) {
      try {
        const q2Url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=marketCap`;
        const q2Res = await fetch(q2Url, { headers, signal: AbortSignal.timeout(5000) });
        if (q2Res.ok) {
          const q2Data = await q2Res.json();
          marketCap = safeNum(q2Data?.quoteResponse?.result?.[0]?.marketCap, 0);
        }
      } catch { /* ignore */ }
    }

    // Filter nulls and zip
    const rows: Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }> = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null && opens[i] != null) {
        rows.push({
          date: new Date(ts[i] * 1000).toISOString().slice(0, 10), // ISO "YYYY-MM-DD" for chart parsing
          open: opens[i], close: closes[i], high: highs[i] || closes[i], low: lows[i] || closes[i],
          volume: volumes[i] || 0,
        });
      }
    }
    return { rows, marketCap };
  } catch { return { rows: null, marketCap: 0 }; }
}

// ── Build derived data from OHLC ──────────────────────────────────────────────
function buildHistoryTable(rows: Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }>, atr: number) {
  const last15 = rows.slice(-15);
  return last15.map((r, i) => {
    const prevClose = i === 0 ? r.open : last15[i - 1].close;
    const changePct = prevClose > 0 ? ((r.close - prevClose) / prevClose) * 100 : 0;
    const atrPct = atr > 0 ? ((r.high - r.low) / atr) * 100 : 0;
    return {
      date: r.date,
      open: +r.open.toFixed(2),
      close: +r.close.toFixed(2),
      changePct: +changePct.toFixed(2),
      volume: +(r.volume / 1e6).toFixed(2),
      atrPct: +atrPct.toFixed(1),
    };
  });
}

function buildSRLevels(rows: Array<{ high: number; low: number; close: number }>, currentPrice: number, support1: number, resistance1: number, low52w: number, high52w: number) {
  if (!rows || rows.length === 0) {
    return {
      resistance3: +(high52w).toFixed(2),
      resistance2: +(currentPrice * 1.12).toFixed(2),
      resistance1: +resistance1.toFixed(2),
      support1: +support1.toFixed(2),
      support2: +(currentPrice * 0.92).toFixed(2),
      support3: +low52w.toFixed(2),
    };
  }
  const highs = rows.map(r => r.high);
  const lows = rows.map(r => r.low);
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const midHigh = (recentHigh + high52w) / 2;
  const midLow = (recentLow + low52w) / 2;
  return {
    resistance3: +high52w.toFixed(2),
    resistance2: +Math.max(midHigh, resistance1 * 1.05).toFixed(2),
    resistance1: +resistance1.toFixed(2),
    support1: +support1.toFixed(2),
    support2: +Math.min(midLow, support1 * 0.95).toFixed(2),
    support3: +low52w.toFixed(2),
  };
}

function buildMALevels(rows: Array<{ close: number }> | null, currentPrice: number, ema20: number, ema50: number, ema200: number, low52w: number, high52w: number) {
  const closes = rows ? rows.map(r => r.close) : [];
  const ma7 = closes.length >= 7 ? closes.slice(-7).reduce((a, b) => a + b, 0) / 7 : ema20 * 0.995;
  const ma21 = closes.length >= 21 ? closes.slice(-21).reduce((a, b) => a + b, 0) / 21 : ema20 * 0.99;
  const yearAvg = closes.length >= 50 ? closes.reduce((a, b) => a + b, 0) / closes.length : (low52w + high52w) / 2;
  return {
    ma7: +ma7.toFixed(2), ma21: +ma21.toFixed(2),
    ma50: +ema50.toFixed(2), ma200: +ema200.toFixed(2),
    yearAvg: +yearAvg.toFixed(2),
    goldenCross: ema20 > ema50, deathCross: ema20 < ema50,
  };
}

function buildCspMatrix(spot: number, iv: number, support1: number, support2: number) {
  const weeks = [
    { label: "Hafta 1 (7G)", dte: 7 },
    { label: "Hafta 2 (14G)", dte: 14 },
    { label: "Hafta 3 (21G)", dte: 21 },
    { label: "Aylık (30G)", dte: 30 },
  ];
  return weeks.map(w => {
    const strike = +(support1 * 0.98).toFixed(2);
    const bid = +estimatePutPremium(spot, strike, iv, w.dte).toFixed(2);
    const yieldPct = +((bid / strike) * 100).toFixed(2);
    const annualYield = +((bid / strike) * (365 / w.dte) * 100).toFixed(1);
    const otmPct = +((spot - strike) / spot * 100).toFixed(1);
    const efMaliyet = +(strike - bid).toFixed(2);
    return { label: w.label, dte: w.dte, strike, bid, yieldPct, annualYield, otmPct, efMaliyet };
  });
}

function buildCcMatrix(spot: number, iv: number, resistance1: number) {
  const weeks = [
    { label: "Hafta 1 (7G)", dte: 7 },
    { label: "Hafta 2 (14G)", dte: 14 },
    { label: "Aylık (30G)", dte: 30 },
  ];
  return weeks.map(w => {
    const strike = +(resistance1 * 1.01).toFixed(2);
    const ivDec = iv / 100;
    const t = w.dte / 252;
    const otmPct = Math.max(0, (strike - spot) / spot);
    const atm = spot * ivDec * Math.sqrt(t) * 0.4;
    const bid = +Math.max(0.01, atm * Math.exp(-otmPct * 12)).toFixed(2);
    const yieldPct = +((bid / spot) * 100).toFixed(2);
    const annualYield = +((bid / spot) * (365 / w.dte) * 100).toFixed(1);
    const otmPctShow = +((strike - spot) / spot * 100).toFixed(1);
    const maxReturn = +(strike - spot + bid).toFixed(2);
    return { label: w.label, dte: w.dte, strike, bid, yieldPct, annualYield, otmPct: otmPctShow, maxReturn };
  });
}

function buildForecast15(forecast: any[], currentPrice: number) {
  const signals = [
    "EMA 20 test", "RSI izle", "Hacim onayı", "Destek testi", "Momentum izle",
    "VWAP yakını", "EMA 20 kırılım?", "RSI nötr bölge", "Konsolidasyon",
    "Direnç yakını", "EMA 50 test", "Kırılım bekleme", "RSI aşırı alım?",
    "Haftalık vade", "15G kapanış",
  ];
  const actions = [
    "Bekle", "CSP değerlendir", "CSP aç", "Bekle", "CSP izle",
    "CSP/CC değerlendir", "CSP aç", "Bekle", "CC değerlendir",
    "CC aç", "Bekle", "CSP yenile", "CC izle",
    "Pozisyon gözden geçir", "Sonraki dönem planla",
  ];
  return Array.from({ length: 15 }, (_, i) => {
    const d = forecast[i] || {};
    const day = i + 1;
    const bear = safeNum(d.bear ?? d.low, currentPrice * (1 - 0.012 * day));
    const base = safeNum(d.base ?? d.median, currentPrice * (1 + 0.004 * day));
    const bull = safeNum(d.bull ?? d.high, currentPrice * (1 + 0.018 * day));
    return { day, bear: +bear.toFixed(2), base: +base.toFixed(2), bull: +bull.toFixed(2), teknikSinyal: signals[i], eylemOnerisi: actions[i] };
  });
}

// ── JSON helpers ──────────────────────────────────────────────────────────────
function tryParseJSON(raw: string): Record<string, any> | null {
  if (!raw?.trim()) return null;
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  s = s.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, m => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r"))); } catch { return null; }
  }
}

function buildFallback(p: any, lang: "tr" | "en" = "tr") {
  const aboveEma20 = p.currentPrice > p.ema20;
  const aboveEma50 = p.currentPrice > p.ema50;
  if (lang === "en") {
    const trendStr = aboveEma20 && aboveEma50 ? "in an uptrend" : !aboveEma20 && !aboveEma50 ? "under downward pressure" : "showing mixed signals";
    return {
      hisseTipi: `A technically-focused stock in the ${p.sector} sector. BOGA score ${p.masterScore}/100, ${trendStr}.`,
      yukselisKarakteri: `Momentum gains drive strong closes above EMA levels. Positive momentum builds when volume confirms the rally.`,
      dususKarakteri: `Consolidation can occur on support breaks. Staying below EMA 50 signals medium-term pressure.`,
      hacimTepkisi: `Above-average volume days increase volatility and directional movement. Falling volume points to consolidation.`,
      haberEtkisi: `Sector news and macro developments affect short-term price action. Earnings periods drive volatility higher.`,
      trendDurumu: `Price is currently ${aboveEma20 ? "above" : "below"} EMA 20 and ${aboveEma50 ? "above" : "below"} EMA 50. Overall picture: ${trendStr}.`,
      kritikSeviyeler: `Key support is at $${p.support1.toFixed(2)}. A break above $${p.resistance1.toFixed(2)} resistance opens new targets.`,
      momentumYorumu: `RSI at ${p.rsi.toFixed(1)} is in ${p.rsi > 70 ? "overbought" : p.rsi < 30 ? "oversold" : "neutral"} territory. EMA alignment confirms the current direction.`,
      volatilite: `IV at ${p.iv}% reflects a ${p.iv > 50 ? "high" : p.iv > 30 ? "moderate" : "low"} volatility environment.`,
      bearTetikleyici: "Negative news or sector pressure breaking support",
      baseTetikleyici: "Continuation of current momentum and technical structure",
      bullTetikleyici: "Strong catalyst, positive earnings, or short squeeze",
      bearOlasilik: 25, baseOlasilik: 55, bullOlasilik: 20,
      oneri: `Considering the technical structure, ${p.masterScore >= 60 ? "the setup favors a long bias." : "waiting for a clearer signal is advisable."}`,
      kritikRisk: "Earnings dates and macro events like FOMC should be closely monitored, as they can drive sharp volatility.",
      genelPuan: (p.masterScore / 10).toFixed(1),
    };
  }
  const trendStr = aboveEma20 && aboveEma50 ? "yükseliş trendinde" : !aboveEma20 && !aboveEma50 ? "düşüş baskısı altında" : "karışık sinyaller gösteriyor";
  return {
    hisseTipi: `${p.sector} sektöründe faaliyet gösteren teknik analiz odaklı hisse. BOGA skoru ${p.masterScore}/100 ile ${trendStr}.`,
    yukselisKarakteri: `Momentum artışı ile EMA üzerinde güçlü kapanışlar hedeflenir. Hacim artışı yükselişi desteklediğinde pozitif ivme kazanır.`,
    dususKarakteri: `Destek kırılımlarında konsolidasyon yaşanabilir. EMA 50 altında kalmak orta vadeli baskı sinyali verir.`,
    hacimTepkisi: `Ortalamanın üzerinde hacimli günlerde volatilite ve yönlü hareket artar. Hacim düşüşü konsolidasyona işaret eder.`,
    haberEtkisi: `Sektörel haberler ve makro gelişmeler kısa vadeli fiyat hareketini etkiler. Bilanço dönemleri IV yükselişine neden olur.`,
    trendDurumu: `Fiyat şu an EMA 20 ${aboveEma20 ? "üzerinde" : "altında"} ve EMA 50 ${aboveEma50 ? "üzerinde" : "altında"} seyrediyor. Genel görünüm ${trendStr}.`,
    kritikSeviyeler: `Kritik destek $${p.support1.toFixed(2)} seviyesinde. $${p.resistance1.toFixed(2)} direnci kırılırsa yeni hedefler devreye girer.`,
    momentumYorumu: `RSI ${p.rsi.toFixed(1)} ile ${p.rsi > 70 ? "aşırı alım" : p.rsi < 30 ? "aşırı satım" : "nötr"} bölgesinde. EMA hizalaması mevcut yönü teyit ediyor.`,
    volatilite: `IV %${p.iv} seviyesinde ${p.iv > 50 ? "yüksek" : p.iv > 30 ? "orta" : "düşük"} volatilite ortamı mevcut.`,
    bearTetikleyici: "Negatif haber veya sektör baskısı ile destek kırılımı",
    baseTetikleyici: "Mevcut momentum ve teknik yapı devamı",
    bullTetikleyici: "Güçlü katalizör, olumlu bilanço veya short squeeze",
    bearOlasilik: 25, baseOlasilik: 55, bullOlasilik: 20,
    oneri: `Teknik yapı dikkate alınarak ${p.masterScore >= 60 ? "pozitif önyargı uygundur." : "net bir sinyal beklenmelidir."}`,
    kritikRisk: "Bilanço tarihi ve FOMC gibi makro gelişmeler yakından takip edilmeli, ani volatiliteye neden olabilir.",
    genelPuan: (p.masterScore / 10).toFixed(1),
  };
}

const SYSTEM_MSG: Record<"tr" | "en", string> = {
  tr: `Sen bir finansal analiz asistanısın. YALNIZCA geçerli JSON nesnesi döndür. Hiçbir açıklama, giriş metni veya markdown ekleme. İlk karakter { ve son karakter } olmalıdır.`,
  en: `You are a financial analysis assistant. Return ONLY a valid JSON object. No explanation, preamble, or markdown. The first character must be { and the last character must be }.`,
};

function buildUserPrompt(p: any, lang: "tr" | "en" = "tr") {
  const header = `Stock: ${p.ticker} ${p.companyName} ${p.sector} Price:${p.currentPrice.toFixed(2)} Score:${p.masterScore} RSI:${p.rsi.toFixed(1)} IV:${p.iv} EMA20:${p.ema20.toFixed(2)} EMA50:${p.ema50.toFixed(2)} EMA200:${p.ema200.toFixed(2)} Support:${p.support1.toFixed(2)} Resistance:${p.resistance1.toFixed(2)} ATR:${p.atr.toFixed(2)} Bear15D:${p.bearTarget.toFixed(2)} Base15D:${p.baseTarget.toFixed(2)} Bull15D:${p.bullTarget.toFixed(2)}`;
  const schema = `{"hisseTipi":"...","yukselisKarakteri":"...","dususKarakteri":"...","hacimTepkisi":"...","haberEtkisi":"...","trendDurumu":"...","kritikSeviyeler":"...","momentumYorumu":"...","volatilite":"...","bearTetikleyici":"...","baseTetikleyici":"...","bullTetikleyici":"...","bearOlasilik":25,"baseOlasilik":55,"bullOlasilik":20,"oneri":"...","kritikRisk":"...","genelPuan":${(p.masterScore / 10).toFixed(1)}}`;
  const instruction = lang === "en"
    ? `Fill in these JSON fields — each value 1-2 sentences of plain English text (no quotes, no special characters):`
    : `Su JSON alanlarini doldur - her deger 1-2 cumle Turkce duz metin (tirnak yok, ozel karakter yok):`;
  return `${header}\n\n${instruction}\n${schema}`;
}

async function callGemini(userPrompt: string, lang: "tr" | "en" = "tr"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_MSG[lang] }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { ticker, stockData, lang: langRaw } = await req.json();
    if (!ticker || !stockData) return NextResponse.json({ error: "Missing ticker or stockData" }, { status: 400 });
    const lang: "tr" | "en" = langRaw === "en" ? "en" : "tr";

    // ── Validate stockData has real content before caching ───────────────────
    const hasRealStockData = !!(stockData?.price?.current && stockData.price.current !== 100 &&
      (stockData.company || stockData.technical?.rsi_14));

    // ── Cache check: persistent file first, then in-memory ───────────────────
    const persistKey = getPersistentCacheKey(ticker.toUpperCase(), lang);
    if (hasRealStockData) {
      const fileCached = await readPersistentCache(persistKey);
      // Only serve file cache if it has real company data (not a stale empty-stockData write)
      if (fileCached && fileCached.companyName && fileCached.companyName !== ticker.toUpperCase() && fileCached.rawData?.currentPrice !== 100) {
        cache.set(persistKey, { ts: Date.now(), data: fileCached });
        return NextResponse.json(fileCached, {
          headers: { "X-Cache": "FILE-HIT", "Cache-Control": "private, max-age=3600" },
        });
      }
    }
    const cacheKey = `${ticker.toUpperCase()}_${stockData?.price?.current ?? "0"}_${lang}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL && cached.data?.companyName !== ticker.toUpperCase()) {
      return NextResponse.json(cached.data, {
        headers: { "X-Cache": "HIT", "Cache-Control": "private, max-age=3600" },
      });
    }

    const s = stockData || {};
    const pr = s.price || {};
    const tech = s.technical || {};
    const sc = s.scores || {};
    const sd = s.scores_detail || s.strategy || {};
    const mo = s.market_overview || {};

    const currentPrice = safeNum(pr.current, 100);
    const masterScore = safeNum(sc.master_score, 50);
    const rsi = safeNum(tech.rsi_14, 50);
    const iv = safeNum(tech.iv ?? tech.impliedVolatility, 40);
    const atr = safeNum(tech.atr, currentPrice * 0.025);
    const ema20 = safeNum(tech.ema_20, currentPrice * 0.98);
    const ema50 = safeNum(tech.ema_50, currentPrice * 0.97);
    const ema200 = safeNum(tech.ema_200, currentPrice * 0.93);
    const support1 = safeNum(sd.stop_loss ?? tech.support_level, currentPrice * 0.95);
    const resistance1 = safeNum(sd.target_price ?? tech.resistance_level, currentPrice * 1.08);
    const low52w = safeNum(tech["52w_low"], currentPrice * 0.7);
    const high52w = safeNum(tech["52w_high"], currentPrice * 1.3);
    const avgVol30d = safeNum(pr.avg_volume_30d, 0);
    const volume = safeNum(pr.volume, 0);
    const rvol = safeNum(tech.rvol, 1.0);
    const macd = tech.macd ?? 0;
    const ivRank = Math.min(100, Math.max(0, ((iv - 15) / 65) * 100));
    const hv30 = safeNum(tech.hv30 ?? tech.historical_volatility, iv * 0.85);
    const optimalCSPStrike = +(support1 * 0.98).toFixed(2);
    const optimalCCStrike = +(resistance1 * 1.01).toFixed(2);

    // ── Fetch historical OHLC + compute live indicators ─────────────────────
    const histResult = await fetchHistory(ticker.toUpperCase());
    const historyRows = histResult?.rows || null;

    // Market cap: check all possible paths in stockData, then Yahoo Finance fallback
    const fund = s.fundamental || {};
    let marketCap = safeNum(
      fund.market_cap ?? fund.marketCap ??
      s.marketCap ?? s.market_cap ?? s.price?.market_cap ?? s.price?.marketCap,
      safeNum(histResult?.marketCap, 0)
    );
    const marketCapStr = marketCap > 1e9 ? "$" + (marketCap / 1e9).toFixed(1) + "B" : marketCap > 1e6 ? "$" + (marketCap / 1e6).toFixed(0) + "M" : "N/A";

    // ── Override stale stockData values with live OHLC calculations ──────────
    // Yahoo Finance 60-day OHLC gives us accurate, real-time technicals.
    // stockData.technicals may be hours/days old — always prefer live data.
    let live: ReturnType<typeof calcLiveIndicators> | null = null;
    if (historyRows && historyRows.length >= 20) {
      live = calcLiveIndicators(historyRows);
    }

    // Use live values when available; fall back to stockData only if OHLC unavailable
    const rsiLive  = live ? live.rsi14  : safeNum(tech.rsi_14, 50);
    const ema20Live = live ? live.ema20  : safeNum(tech.ema_20, currentPrice * 0.98);
    const ema50Live = live ? live.ema50  : safeNum(tech.ema_50, currentPrice * 0.97);
    const atrLive  = live ? live.atr14  : safeNum(tech.atr, currentPrice * 0.025);
    const hv30Live = live ? live.hv30   : safeNum(tech.hv30 ?? tech.historical_volatility, iv * 0.85);
    const macdLive = live ? live.macd   : (tech.macd ?? 0);
    const rvolLive = live ? live.rvol   : safeNum(tech.rvol, 1.0);
    const avgVol30dLive = live ? live.avgVol30d : safeNum(pr.avg_volume_30d, 0);

    // Re-assign overridden values (used in prompt and rawData below)
    const rsiF     = rsiLive;
    const ema20F   = ema20Live;
    const ema50F   = ema50Live;
    const atrF     = atrLive;
    const hv30F    = hv30Live;
    const macdF    = macdLive;
    const rvolF    = rvolLive;
    const avgVol30dF = avgVol30dLive;
    const atrPct   = currentPrice > 0 ? (atrF / currentPrice * 100) : 0;

    // Build derived tables
    const history15 = historyRows ? buildHistoryTable(historyRows, atrF) : [];

    // S/R levels: pivot-based from OHLC (accurate), fallback to old formula
    // Pivot-based S/R requires at least 20 bars (WIN*2+1=15 + headroom); 1y fetch gives ~252 bars
    const srLevels = (historyRows && historyRows.length >= 20)
      ? buildSRFromPivots(historyRows, currentPrice, low52w, high52w)
      : buildSRLevels(historyRows || [], currentPrice, support1, resistance1, low52w, high52w);

    const maLevels = buildMALevels(historyRows, currentPrice, ema20F, ema50F, ema200, low52w, high52w);
    // Use live S/R levels for CSP/CC strike selection
    const liveS1 = srLevels.support1;
    const liveR1 = srLevels.resistance1;
    const optimalCSPStrikeLive = +(liveS1 * 0.98).toFixed(2);
    const optimalCCStrikeLive  = +(liveR1 * 1.01).toFixed(2);

    const cspMatrix = buildCspMatrix(currentPrice, iv, liveS1, srLevels.support2);
    const ccMatrix  = buildCcMatrix(currentPrice, iv, liveR1);

    // ── EMA Profile & Flow indicators ────────────────────────────────────────
    const rawMarketCap = safeNum(
      fund.market_cap ?? fund.marketCap ?? s.marketCap ?? s.market_cap ?? s.price?.market_cap,
      safeNum(histResult?.marketCap, 0)
    );
    const emaProfile = classifyEMAProfile(currentPrice, ema20F, ema50F, ema200, rawMarketCap, maLevels.goldenCross);
    const emaSlope20  = historyRows ? calcEMASlope(historyRows.map(r => r.close), 20)  : "yatay";
    const emaSlope50  = historyRows ? calcEMASlope(historyRows.map(r => r.close), 50)  : "yatay";
    const emaSlope200 = historyRows ? calcEMASlope(historyRows.map(r => r.close), 200) : "yatay";

    let flowSummary: ReturnType<typeof calcFlowSummary> | null = null;
    if (historyRows && historyRows.length >= 20) {
      const obvArr = calcOBV(historyRows);
      const adArr  = calcAD(historyRows);
      const mfi    = calcMFI(historyRows);
      flowSummary  = calcFlowSummary(obvArr, adArr, mfi, currentPrice, historyRows);
    }

    // ── Insider, Analist, 13F, Earnings — Yahoo Finance quoteSummary ──────────
    const summary = await fetchYFSummary(ticker.toUpperCase());

    // — Haber çekimi ————————————————
    let newsItems: any[] = [];
    try {
      const newsHdr: Record<string, string> = { "User-Agent": YF_UA, "Accept": "application/json" };
      const auth = await getYFAuth();
      if (auth?.cookie) newsHdr["Cookie"] = auth.cookie;
      const newsRes = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker.toUpperCase()}&newsCount=10&enableFuzzyQuery=false&enableCb=false`,
        { headers: newsHdr, signal: AbortSignal.timeout(6000) }
      );
      if (newsRes.ok) {
        const newsJson = await newsRes.json();
        newsItems = newsJson?.news ?? [];
      }
    } catch (e: any) {
      console.warn("[deep-analysis] news fetch:", e?.message);
    }

    // — İnsider İşlemleri ————————————————
    // Yahoo Finance transactionType değerleri sadece "Sale"/"Purchase" değil; Option Exercise,
    // Gift, Award, Tax Withholding, Conversion gibi piyasa alım/satımı SAYILMAYAN türler de
    // gelir. Önceki sürüm bunların hepsini "BUY" olarak etiketliyordu — yanlış sinyal üretiyordu.
    const classifyInsiderType = (raw: string): "BUY" | "SELL" | "OTHER" => {
      const s = (raw || "").toLowerCase();
      if (s.includes("sale") || s.includes("sell") || s.includes("disposition")) return "SELL";
      if (s.includes("purchase") || s.includes("buy")) return "BUY";
      return "OTHER"; // option exercise, gift, award, tax withholding, conversion, vb.
    };

    const insiderTransactionsRaw: any[] = (summary?.insiderTransactions?.transactions ?? [])
      .slice(0, 10)
      .map((tx: any) => {
        const shares = safeNum(tx.shares?.raw, 0);
        const value  = safeNum(tx.value?.raw, 0);
        const price  = shares > 0 && value > 0 ? +(value / shares).toFixed(2) : null;
        const type   = classifyInsiderType(tx.transactionType);
        return {
          officer:     tx.filerName       || (lang === "en" ? "Unknown" : "Bilinmiyor"),
          title:       tx.filerRelation   || (lang === "en" ? "Executive" : "Yönetici"),
          type,
          date:        tx.startDate?.fmt  || "",
          shares:      tx.shares?.longFmt || (shares > 0 ? shares.toLocaleString() : "—"),
          sharesRaw:   shares,
          price,
          value:       value > 0 ? value : null,
          transactionDesc: tx.transactionText || tx.transactionType || "",
        };
      });

    const insiderTransactions = insiderTransactionsRaw;
    const insiderSummary = {
      buyCount:  insiderTransactionsRaw.filter(t => t.type === "BUY").length,
      sellCount: insiderTransactionsRaw.filter(t => t.type === "SELL").length,
      otherCount: insiderTransactionsRaw.filter(t => t.type === "OTHER").length,
      netValue:  insiderTransactionsRaw.reduce((sum, t) => {
        if (t.type === "BUY") return sum + (t.value || 0);
        if (t.type === "SELL") return sum - (t.value || 0);
        return sum;
      }, 0),
    };

    // — Analist Konsensüsü ————————————————
    const trend     = summary?.recommendationTrend?.trend?.[0] ?? null;
    const finData   = summary?.financialData ?? null;
    const upgrades  = (summary?.upgradeDowngradeHistory?.history ?? []).filter((u: any) => {
      return (Date.now() - (u.epochGradeDate ?? 0) * 1000) < 30 * 24 * 60 * 60 * 1000;
    });
    const analystData: any = {
      count:    trend ? (trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell) : 0,
      buy:      trend ? (trend.strongBuy + trend.buy) : 0,
      hold:     trend ? trend.hold : 0,
      sell:     trend ? (trend.sell + trend.strongSell) : 0,
      avgTarget: safeNum(finData?.targetMeanPrice?.raw, currentPrice),
      minTarget: safeNum(finData?.targetLowPrice?.raw,  currentPrice * 0.75),
      maxTarget: safeNum(finData?.targetHighPrice?.raw, currentPrice * 1.3),
      recentUpgrades: upgrades.slice(0, 3).map((u: any) => ({
        firm: u.firm || "",
        from: u.fromGrade || "",
        to:   u.toGrade   || "",
        date: new Date((u.epochGradeDate ?? 0) * 1000).toLocaleDateString(lang === "en" ? "en-US" : "tr-TR"),
        action: u.action || "",
      })),
    };

    // — 13F Kurumsal Sahiplik ————————————————
    const institutionalOwners: any[] = (summary?.institutionOwnership?.ownershipList ?? [])
      .slice(0, 5)
      .map((o: any) => ({
        name:   o.organization ?? (lang === "en" ? "Unknown" : "Bilinmiyor"),
        shares: safeNum(o.position?.raw, 0),
        change: +(safeNum(o.pctChange?.raw, 0) * 100).toFixed(2),
        reportDate: o.reportDate?.fmt ?? "",
      }));

    // — Sonraki Kazanç Tarihi ————————————————
    const calDates: any[] = summary?.calendarEvents?.earnings?.earningsDate ?? [];
    const nextEarningsDate: string | null = calDates.length > 0
      ? (calDates[0]?.fmt ?? null)
      : null;
    const nextEarningsDaysAway: number | null = nextEarningsDate
      ? Math.round((new Date(nextEarningsDate).getTime() - Date.now()) / 86400000)
      : null;

    // — Mum Paterni (historyRows'dan hesaplanır) ————————————————
    function detectCandlePatternLocal(cls: number[], ops: number[], hgs: number[], lws: number[]): string {
      const n = cls.length;
      if (n < 3) return "—";
      const o1 = ops[n - 2], c1 = cls[n - 2], h1 = hgs[n - 2], l1 = lws[n - 2];
      const o2 = ops[n - 1], c2 = cls[n - 1], h2 = hgs[n - 1], l2 = lws[n - 1];
      const body2 = Math.abs(c2 - o2), range2 = h2 - l2;
      if (range2 === 0) return "—";
      const lowerWick = Math.min(o2, c2) - l2;
      const upperWick = h2 - Math.max(o2, c2);
      if (body2 / range2 < 0.1) return "Doji";
      if (lowerWick > body2 * 2 && upperWick < body2 * 0.5 && c2 > o2) return "Hammer";
      if (upperWick > body2 * 2 && lowerWick < body2 * 0.5 && c2 < o2) return "Shooting Star";
      if (c1 < o1 && c2 > o2 && o2 <= c1 && c2 >= o1) return "Bullish Engulfing";
      if (c1 > o1 && c2 < o2 && o2 >= c1 && c2 <= o1) return "Bearish Engulfing";
      if (n >= 3) {
        const o0 = ops[n - 3], c0 = cls[n - 3], body1 = Math.abs(c1 - o1), range1 = h1 - l1;
        if (c0 < o0 && body1 < range1 * 0.3 && c2 > o2 && c2 > (o0 + c0) / 2) return "Morning Star";
        if (c0 > o0 && body1 < range1 * 0.3 && c2 < o2 && c2 < (o0 + c0) / 2) return "Evening Star";
      }
      if (c2 > o2 && body2 / range2 > 0.7) return "Strong Bullish";
      if (c2 < o2 && body2 / range2 > 0.7) return "Strong Bearish";
      return "—";
    }
    const candlePattern = historyRows && historyRows.length >= 3
      ? detectCandlePatternLocal(
          historyRows.map(r => r.close), historyRows.map(r => r.open),
          historyRows.map(r => r.high), historyRows.map(r => r.low)
        )
      : "—";

    // — Kazanç Geçmişi ————————————————
    const earningsHistory: any[] = (summary?.earningsHistory?.history ?? [])
      .slice(-4).reverse()
      .map((e: any) => {
        const epsActual   = safeNum(e.epsActual?.raw, 0);
        const epsEstimate = safeNum(e.epsEstimate?.raw, 0);
        const surp        = safeNum(e.surprisePercent?.raw, 0) * 100;
        return {
          quarter:     e.period     ?? "",
          date:        e.quarter?.fmt ?? "",
          eps:         epsActual,
          estimate:    epsEstimate,
          epsSurprise: +surp.toFixed(1),
          epsBeating:  epsActual >= epsEstimate,
          priceMove:   0,   // post-earnings hareketi için ayrı hesap gerekir
          persistence: 0,
        };
      });

    // — Haberler ————————————————
    const sentimentMap: Record<string, string> = {};
    const recentNews: any[] = newsItems.slice(0, 8).map((n: any) => {
      const title = n.title ?? "";
      const lower = title.toLowerCase();
      let sentiment = "Nötr";
      if (/beat|surge|soar|rally|gain|record|strong|growth|profit|partner|win|buy|upgrade/i.test(lower)) sentiment = "Pozitif";
      else if (/miss|drop|fall|decline|loss|cut|downgrade|layoff|risk|warn|weak|short/i.test(lower)) sentiment = "Negatif";
      return {
        title,
        date:    n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleDateString(lang === "en" ? "en-US" : "tr-TR") : "",
        source:  n.publisher    ?? "",
        summary: "",
        sentiment,
        url:     n.link ?? "",
      };
    });

    const rawForecast = Array.isArray(s.forecast) ? s.forecast : Array.isArray(s.forecast?.days) ? s.forecast.days : [];
    const forecast15 = buildForecast15(rawForecast, currentPrice);
    const bearTarget = forecast15[14].bear;
    const baseTarget = forecast15[14].base;
    const bullTarget = forecast15[14].bull;

    // Implied move from IV
    const implied30dMove = currentPrice * (iv / 100) * Math.sqrt(30 / 252);
    const range1sd = { low: +(currentPrice - implied30dMove).toFixed(2), high: +(currentPrice + implied30dMove).toFixed(2) };
    const range2sd = { low: +(currentPrice - implied30dMove * 2).toFixed(2), high: +(currentPrice + implied30dMove * 2).toFixed(2) };

    // promptParams uses live technical values for accurate AI analysis
    const promptParams = {
      ticker: ticker.toUpperCase(), companyName: s.company || ticker,
      sector: s.sector || "N/A", industry: s.industry || "N/A",
      currentPrice, masterScore,
      rsi: rsiF, iv, atr: atrF, ema20: ema20F, ema50: ema50F, ema200,
      support1: liveS1, resistance1: liveR1,
      marketCapStr, ivRank,
      bearTarget, baseTarget, bullTarget,
    };

    // AI call (BOGA AI always)
    let rawText = "";
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6", max_tokens: 2048, system: SYSTEM_MSG[lang],
          messages: [{ role: "user", content: buildUserPrompt(promptParams, lang) }],
        });
        rawText = (msg.content[0] as any).text || "";
      } catch (e: any) { console.error("[deep-analysis] Anthropic:", e?.message); }
    }
    if (!rawText && process.env.GEMINI_API_KEY) {
      try { rawText = await callGemini(buildUserPrompt(promptParams, lang), lang); }
      catch (e: any) { console.error("[deep-analysis] Gemini:", e?.message); }
    }

    let ai: Record<string, any> = tryParseJSON(rawText) || buildFallback({ ...promptParams, support1, resistance1, ivRank }, lang);

    // ── VWAP20, POC, rs20d from historyRows ──────────────────────────────────
    let vwap20: number | null = null;
    let poc: number | null = null;
    const rs20d = historyRows && historyRows.length >= 20
      ? +(((currentPrice - historyRows[historyRows.length - 20].close) / historyRows[historyRows.length - 20].close) * 100).toFixed(1)
      : null;

    if (historyRows && historyRows.length >= 20) {
      const rows20 = historyRows.slice(-20);
      const totalVol = rows20.reduce((s: number, r: any) => s + r.volume, 0);
      if (totalVol > 0) {
        vwap20 = +(rows20.reduce((s: number, r: any) => s + (r.high + r.low + r.close) / 3 * r.volume, 0) / totalVol).toFixed(2);
      }
      const mn = Math.min(...rows20.map((r: any) => r.low));
      const mx = Math.max(...rows20.map((r: any) => r.high));
      const bSize = (mx - mn) / 10;
      if (bSize > 0) {
        const volBuckets = new Array(10).fill(0);
        rows20.forEach((r: any) => {
          const tp = (r.high + r.low + r.close) / 3;
          const idx = Math.min(Math.floor((tp - mn) / bSize), 9);
          volBuckets[idx] += r.volume;
        });
        const maxIdx = volBuckets.indexOf(Math.max(...volBuckets));
        poc = +(mn + (maxIdx + 0.5) * bSize).toFixed(2);
      }
    }

    // ── Peer comparison + news translation (parallel) ────────────────────────
    const peerTickerList = (SECTOR_PEERS[promptParams.sector] ?? SECTOR_PEERS["Technology"])
      .filter((t: string) => t !== ticker.toUpperCase()).slice(0, 5);

    const [peerData, translatedTitles, peer20dMap] = await Promise.all([
      fetchPeerData(ticker.toUpperCase(), promptParams.sector),
      lang === "tr" && recentNews.length > 0
        ? translateNewsTitles(recentNews.map((n: any) => n.title))
        : Promise.resolve([] as string[]),
      fetchPeer20dChanges(peerTickerList),
    ]);

    // Merge rs20d into peerData
    const peerDataWithRS = peerData.map((p: any) => ({ ...p, rs20d: peer20dMap[p.ticker] ?? p.rs20d ?? 0 }));

    // Apply translated titles to news items
    const localizedNews = recentNews.map((item: any, i: number) => ({
      ...item,
      title: translatedTitles[i] || item.title,
    }));

    const str = (v: any, fb: string) => typeof v === "string" && v.trim() ? v.trim() : fb;
    const num = (v: any, fb: number) => typeof v === "number" ? v : parseFloat(String(v)) || fb;

    const ceklistSkorlar = {
      trendYapisi: masterScore >= 65 ? 1 : masterScore >= 50 ? 0 : -1,
      ivUygun: iv > 30 ? 1 : iv > 20 ? 0 : -1,
      destekGucu: masterScore >= 60 ? 1 : 0,
      momentumGuclu: rsiF >= 40 && rsiF <= 70 ? 1 : -1,
      ema20Above: currentPrice > ema20F ? 1 : -1,
      ema50Above: currentPrice > ema50F ? 1 : 0,
      bogaScore: masterScore >= 60 ? 1 : masterScore >= 45 ? 0 : -1,
      atrUygun: atrPct < 5 ? 1 : atrPct < 8 ? 0 : -1,
    };

    const responseData = {
      ticker: ticker.toUpperCase(),
      companyName: promptParams.companyName,
      currentPrice, sector: promptParams.sector, industry: promptParams.industry,
      generatedAt: new Date().toISOString(),
      analysis: {
        dna: {
          hisseTipi: str(ai.hisseTipi, lang === "en" ? `Technical analysis stock in the ${promptParams.sector} sector.` : `${promptParams.sector} sektörü teknik analiz hissesi.`),
          yukselisKarakteri: str(ai.yukselisKarakteri, lang === "en" ? "Momentum gains build upward thrust." : "Momentum artışı ile yükseliş ivme kazanır."),
          dususKarakteri: str(ai.dususKarakteri, lang === "en" ? "Consolidation can occur on support breaks." : "Destek kırılımlarında konsolidasyon yaşanabilir."),
          hacimTepkisi: str(ai.hacimTepkisi, lang === "en" ? "High volume increases volatility and movement." : "Yüksek hacimde volatilite ve hareket artar."),
          haberEtkisi: str(ai.haberEtkisi, lang === "en" ? "Sector and macro news affect short-term price action." : "Sektörel ve makro haberler kısa vadede etkilidir."),
        },
        teknikYorum: {
          trendDurumu: str(ai.trendDurumu, lang === "en" ? "Trend analysis is being evaluated from the data." : "Trend analizi verilerden değerlendiriliyor."),
          kritikSeviyeler: str(ai.kritikSeviyeler, lang === "en" ? "Support and resistance levels are being actively monitored." : "Destek ve direnç seviyeleri aktif şekilde izleniyor."),
          momentumYorumu: str(ai.momentumYorumu, lang === "en" ? "RSI and EMA momentum are in a neutral zone." : "RSI ve EMA momentum nötr bölgede seyrediyor."),
          volatilite: str(ai.volatilite, lang === "en" ? "Current volatility is at an average level." : "Mevcut volatilite ortalama seviyesinde."),
        },
        forecast15,
        scenarioOzeti: {
          bear: { hedef: bearTarget, olasilik: num(ai.bearOlasilik, 25), tetikleyici: str(ai.bearTetikleyici, lang === "en" ? "Negative news / sector pressure" : "Negatif haber / sektör baskısı") },
          base: { hedef: baseTarget, olasilik: num(ai.baseOlasilik, 55), tetikleyici: str(ai.baseTetikleyici, lang === "en" ? "Continuation of current momentum" : "Mevcut momentum devamı") },
          bull: { hedef: bullTarget, olasilik: num(ai.bullOlasilik, 20), tetikleyici: str(ai.bullTetikleyici, lang === "en" ? "Strong catalyst / short squeeze" : "Güçlü katalizör / short squeeze") },
        },
        ceklistSkorlar,
        sonucKarar: {
          genelPuan: str(String(ai.genelPuan ?? (masterScore / 10).toFixed(1)), (masterScore / 10).toFixed(1)),
          oneri: str(ai.oneri, lang === "en" ? "Position can be evaluated considering the technical structure." : "Teknik yapı dikkate alınarak pozisyon değerlendirilebilir."),
          kritikRisk: str(ai.kritikRisk, lang === "en" ? "Earnings dates and macro developments should be closely monitored." : "Bilanço tarihi ve makro gelişmeler yakından takip edilmeli."),
        },
      },
      rawData: {
        masterScore, rsi: rsiF, iv, hv30: hv30F, atr: atrF, atrPct: +atrPct.toFixed(2),
        ema20: ema20F, ema50: ema50F, ema200, support1: liveS1, resistance1: liveR1, low52w, high52w,
        avgVol30d: avgVol30dF, volume, rvol: rvolF, macd: macdF, ivRank: +ivRank.toFixed(2), ivHvRatio: +(iv / Math.max(hv30F, 1)).toFixed(2),
        marketCapStr, forecast15, history15, srLevels, maLevels, cspMatrix, ccMatrix,
        historyOHLC: historyRows || [], currentPrice,
        implied30dMove: +implied30dMove.toFixed(2), range1sd, range2sd,
        sp500Change: mo.sp500Change ?? null, nasdaqChange: mo.nasdaqChange ?? null, vixPrice: mo.vixPrice ?? null,
        emaProfile, emaSlope20, emaSlope50, emaSlope200, flowSummary,
        insiderTransactions, insiderSummary, recentNews: localizedNews, analystData, institutionalOwners, earningsHistory,
        peerData: peerDataWithRS, candlePattern, nextEarningsDate, nextEarningsDaysAway,
        vwap20, poc, rs20d,
        cacheVersion: getPersistentCacheKey(ticker.toUpperCase(), lang),
      },
    };

    // ── Store in cache: in-memory + persistent file (only when data is real) ──
    cache.set(cacheKey, { ts: Date.now(), data: responseData });
    if (hasRealStockData && responseData.companyName !== ticker.toUpperCase()) {
      writePersistentCache(persistKey, responseData).catch(() => {});
    }

    return NextResponse.json(responseData, {
      headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err: any) {
    console.error("[deep-analysis] unhandled:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// GET /api/deep-analysis?ticker=PLTR — Fetch stock data and run analysis
export async function GET(req: NextRequest) {
  try {
    const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
    if (!ticker) return NextResponse.json({ error: "Missing ticker parameter" }, { status: 400 });

    // Fetch stock data from /api/data/stocks/{ticker}.json
    const dataRes = await fetch(`http://${req.headers.get("host")}/api/data/stocks/${ticker}.json`, { signal: AbortSignal.timeout(10000) });
    if (!dataRes.ok) {
      console.warn(`[deep-analysis GET] Stock data not found for ${ticker}`);
      return NextResponse.json({ error: `Stock data not found for ${ticker}` }, { status: 404 });
    }

    const stockData = await dataRes.json();

    // Convert GET to POST by calling the handler directly
    const postReq = new NextRequest(new URL(`${req.nextUrl.origin}/api/deep-analysis`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, stockData }),
    });

    return POST(postReq);
  } catch (err: any) {
    console.error("[deep-analysis GET] error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
