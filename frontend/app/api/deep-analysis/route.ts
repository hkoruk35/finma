import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

// ── 1-hour in-memory cache ─────────────────────────────────────────────────────
const cache = new Map<string, { ts: number; data: any }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour ms

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
  const WIN = 5; // local-extrema look-around window
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
  const cluster = (vals: number[], pct = 0.005) => {
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
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=60d&interval=1d`;
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

function buildFallback(p: any) {
  const aboveEma20 = p.currentPrice > p.ema20;
  const aboveEma50 = p.currentPrice > p.ema50;
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
    volatilite: `IV %${p.iv} seviyesinde ${p.iv > 50 ? "yüksek" : p.iv > 30 ? "orta" : "düşük"} volatilite ortamı mevcut. Prim stratejileri için ${p.iv > 30 ? "uygun" : "sınırlı"} zemin.`,
    ivDurumu: `IV Rank ${p.ivRank.toFixed(0)}/100. ${p.ivRank > 50 ? "Agresif prim satışı için uygun." : p.ivRank > 25 ? "Seçici strateji önerilir." : "IV düşük, prim değerleri sınırlı."}`,
    cspStrateji: `$${p.optimalCSPStrike.toFixed(2)} strike ile 14-21 DTE CSP açılabilir. Delta 0.20-0.30 arası hedeflenmeli.`,
    ccStrateji: `$${p.optimalCCStrike.toFixed(2)} strike ile 14-21 DTE CC değerlendirilebilir. Atanma durumunda wheel stratejisine geçilir.`,
    haftalikPrimTahmin: `%${(p.iv * 0.012).toFixed(1)}–${(p.iv * 0.025).toFixed(1)}`,
    yillikGetiriTahmin: `%${(p.iv * 0.5).toFixed(0)}–${(p.iv * 0.85).toFixed(0)}`,
    bearTetikleyici: "Negatif haber veya sektör baskısı ile destek kırılımı",
    baseTetikleyici: "Mevcut momentum ve teknik yapı devamı",
    bullTetikleyici: "Güçlü katalizör, olumlu bilanço veya short squeeze",
    bearOlasilik: 25, baseOlasilik: 55, bullOlasilik: 20,
    oneri: `Teknik yapı ve IV seviyesi dikkate alınarak ${p.masterScore >= 60 ? "CSP stratejisi uygulanabilir." : "sinyal beklenmelidir."}`,
    kritikRisk: "Bilanço tarihi ve FOMC gibi makro gelişmeler yakından takip edilmeli. IV crush riski bilanço öncesi pozisyonları doğrudan etkiler.",
    genelPuan: (p.masterScore / 10).toFixed(1),
    cspUygunlugu: p.masterScore >= 65 ? "GUCLU" : p.masterScore >= 50 ? "ORTA" : "ZAYIF",
    ccUygunlugu: p.masterScore >= 60 ? "GUCLU" : p.masterScore >= 45 ? "ORTA" : "ZAYIF",
  };
}

const SYSTEM_MSG = `Sen bir finansal analiz asistanısın. YALNIZCA geçerli JSON nesnesi döndür. Hiçbir açıklama, giriş metni veya markdown ekleme. İlk karakter { ve son karakter } olmalıdır.`;

function buildUserPrompt(p: any) {
  const cspU = p.masterScore >= 65 ? "GUCLU" : p.masterScore >= 50 ? "ORTA" : "ZAYIF";
  const ccU = p.masterScore >= 60 ? "GUCLU" : p.masterScore >= 45 ? "ORTA" : "ZAYIF";
  return `Hisse: ${p.ticker} ${p.companyName} ${p.sector} Fiyat:${p.currentPrice.toFixed(2)} Skor:${p.masterScore} RSI:${p.rsi.toFixed(1)} IV:${p.iv} EMA20:${p.ema20.toFixed(2)} EMA50:${p.ema50.toFixed(2)} EMA200:${p.ema200.toFixed(2)} Destek:${p.support1.toFixed(2)} Direnc:${p.resistance1.toFixed(2)} ATR:${p.atr.toFixed(2)} CSP:${p.optimalCSPStrike.toFixed(2)} CC:${p.optimalCCStrike.toFixed(2)} Bear15G:${p.bearTarget.toFixed(2)} Base15G:${p.baseTarget.toFixed(2)} Bull15G:${p.bullTarget.toFixed(2)}

Su JSON alanlari doldur - her deger 1-2 cumle Turkce duz metin (tirnak yok, ozel karakter yok):
{"hisseTipi":"...","yukselisKarakteri":"...","dususKarakteri":"...","hacimTepkisi":"...","haberEtkisi":"...","trendDurumu":"...","kritikSeviyeler":"...","momentumYorumu":"...","volatilite":"...","ivDurumu":"...","cspStrateji":"...","ccStrateji":"...","haftalikPrimTahmin":"...","yillikGetiriTahmin":"...","bearTetikleyici":"...","baseTetikleyici":"...","bullTetikleyici":"...","bearOlasilik":25,"baseOlasilik":55,"bullOlasilik":20,"oneri":"...","kritikRisk":"...","genelPuan":${(p.masterScore / 10).toFixed(1)},"cspUygunlugu":"${cspU}","ccUygunlugu":"${ccU}"}`;
}

async function callGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_MSG }] },
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
    const { ticker, stockData } = await req.json();
    if (!ticker || !stockData) return NextResponse.json({ error: "Missing ticker or stockData" }, { status: 400 });

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = `${ticker.toUpperCase()}_${stockData?.price?.current ?? "0"}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
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
    const srLevels = (historyRows && historyRows.length >= 15)
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
      optimalCSPStrike: optimalCSPStrikeLive, optimalCCStrike: optimalCCStrikeLive,
      bearTarget, baseTarget, bullTarget,
    };

    // AI call (BOGA AI always)
    let rawText = "";
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6", max_tokens: 2048, system: SYSTEM_MSG,
          messages: [{ role: "user", content: buildUserPrompt(promptParams) }],
        });
        rawText = (msg.content[0] as any).text || "";
      } catch (e: any) { console.error("[deep-analysis] Anthropic:", e?.message); }
    }
    if (!rawText && process.env.GEMINI_API_KEY) {
      try { rawText = await callGemini(buildUserPrompt(promptParams)); }
      catch (e: any) { console.error("[deep-analysis] Gemini:", e?.message); }
    }

    let ai: Record<string, any> = tryParseJSON(rawText) || buildFallback({ ...promptParams, support1, resistance1, optimalCSPStrike, optimalCCStrike, ivRank });

    const str = (v: any, fb: string) => typeof v === "string" && v.trim() ? v.trim() : fb;
    const num = (v: any, fb: number) => typeof v === "number" ? v : parseFloat(String(v)) || fb;
    const normalizeLevel = (v: any, fb: string) => {
      const x = String(v || "").toUpperCase();
      if (x.includes("G") && (x.includes("LU") || x.includes("LÜ") || x.includes("STRONG"))) return "GÜÇLÜ";
      if (x.includes("ORTA") || x.includes("MED")) return "ORTA";
      if (x.includes("ZAY") || x.includes("WEAK")) return "ZAYIF";
      return fb;
    };

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
          hisseTipi: str(ai.hisseTipi, `${promptParams.sector} sektörü teknik analiz hissesi.`),
          yukselisKarakteri: str(ai.yukselisKarakteri, "Momentum artışı ile yükseliş ivme kazanır."),
          dususKarakteri: str(ai.dususKarakteri, "Destek kırılımlarında konsolidasyon yaşanabilir."),
          hacimTepkisi: str(ai.hacimTepkisi, "Yüksek hacimde volatilite ve hareket artar."),
          haberEtkisi: str(ai.haberEtkisi, "Sektörel ve makro haberler kısa vadede etkilidir."),
        },
        teknikYorum: {
          trendDurumu: str(ai.trendDurumu, "Trend analizi verilerden değerlendiriliyor."),
          kritikSeviyeler: str(ai.kritikSeviyeler, "Destek ve direnç seviyeleri aktif şekilde izleniyor."),
          momentumYorumu: str(ai.momentumYorumu, "RSI ve EMA momentum nötr bölgede seyrediyor."),
          volatilite: str(ai.volatilite, "Mevcut volatilite ortalama seviyesinde."),
        },
        forecast15,
        opsiyonAnaliz: {
          ivDurumu: str(ai.ivDurumu, "IV seviyesi değerlendiriliyor."),
          ivRank: +ivRank.toFixed(2), iv, hv30: +hv30F.toFixed(1),
          ivHvRatio: +(iv / Math.max(hv30F, 1)).toFixed(2),
          cspStrateji: str(ai.cspStrateji, `$${optimalCSPStrikeLive} strike, 14-21 DTE CSP değerlendirilebilir.`),
          ccStrateji: str(ai.ccStrateji, `$${optimalCCStrikeLive} strike, 14-21 DTE CC değerlendirilebilir.`),
          optimalCSPStrike: optimalCSPStrikeLive, optimalCCStrike: optimalCCStrikeLive,
          haftalikPrimTahmin: str(ai.haftalikPrimTahmin, "%0.5–1.5"),
          yillikGetiriTahmin: str(ai.yillikGetiriTahmin, "%20–45"),
          cspMatrix, ccMatrix,
        },
        scenarioOzeti: {
          bear: { hedef: bearTarget, olasilik: num(ai.bearOlasilik, 25), tetikleyici: str(ai.bearTetikleyici, "Negatif haber / sektör baskısı") },
          base: { hedef: baseTarget, olasilik: num(ai.baseOlasilik, 55), tetikleyici: str(ai.baseTetikleyici, "Mevcut momentum devamı") },
          bull: { hedef: bullTarget, olasilik: num(ai.bullOlasilik, 20), tetikleyici: str(ai.bullTetikleyici, "Güçlü katalizör / short squeeze") },
        },
        ceklistSkorlar,
        sonucKarar: {
          genelPuan: str(String(ai.genelPuan ?? (masterScore / 10).toFixed(1)), (masterScore / 10).toFixed(1)),
          cspUygunlugu: normalizeLevel(ai.cspUygunlugu, masterScore >= 65 ? "GÜÇLÜ" : masterScore >= 50 ? "ORTA" : "ZAYIF"),
          ccUygunlugu: normalizeLevel(ai.ccUygunlugu, masterScore >= 60 ? "GÜÇLÜ" : masterScore >= 45 ? "ORTA" : "ZAYIF"),
          oneri: str(ai.oneri, "Teknik yapı ve IV seviyesi dikkate alınarak pozisyon değerlendirilebilir."),
          kritikRisk: str(ai.kritikRisk, "Bilanço tarihi ve makro gelişmeler yakından takip edilmeli."),
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
      },
    };

    // ── Store in cache ───────────────────────────────────────────────────────
    cache.set(cacheKey, { ts: Date.now(), data: responseData });

    return NextResponse.json(responseData, {
      headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err: any) {
    console.error("[deep-analysis] unhandled:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
