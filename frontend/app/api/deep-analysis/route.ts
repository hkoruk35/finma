import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

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
    const marketCap = safeNum(result.meta?.marketCap, 0);
    // Filter nulls and zip
    const rows: Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }> = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null && opens[i] != null) {
        rows.push({
          date: new Date(ts[i] * 1000).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
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

    // Fetch historical OHLC
    const histResult = await fetchHistory(ticker.toUpperCase());
    const historyRows = histResult?.rows || null;
    let marketCap = safeNum(s.marketCap ?? s.market_cap, safeNum(histResult?.marketCap, 0));
    const marketCapStr = marketCap > 1e9 ? "$" + (marketCap / 1e9).toFixed(1) + "B" : marketCap > 1e6 ? "$" + (marketCap / 1e6).toFixed(0) + "M" : "N/A";

    // Build derived tables
    const history15 = historyRows ? buildHistoryTable(historyRows, atr) : [];
    const srLevels = buildSRLevels(historyRows || [], currentPrice, support1, resistance1, low52w, high52w);
    const maLevels = buildMALevels(historyRows, currentPrice, ema20, ema50, ema200, low52w, high52w);
    const cspMatrix = buildCspMatrix(currentPrice, iv, support1, support1 * 0.92);
    const ccMatrix = buildCcMatrix(currentPrice, iv, resistance1);
    const rawForecast = Array.isArray(s.forecast) ? s.forecast : Array.isArray(s.forecast?.days) ? s.forecast.days : [];
    const forecast15 = buildForecast15(rawForecast, currentPrice);
    const bearTarget = forecast15[14].bear;
    const baseTarget = forecast15[14].base;
    const bullTarget = forecast15[14].bull;

    // ATR summary
    const atrPct = currentPrice > 0 ? (atr / currentPrice * 100) : 0;
    const implied30dMove = currentPrice * (iv / 100) * Math.sqrt(30 / 252);
    const range1sd = { low: +(currentPrice - implied30dMove).toFixed(2), high: +(currentPrice + implied30dMove).toFixed(2) };
    const range2sd = { low: +(currentPrice - implied30dMove * 2).toFixed(2), high: +(currentPrice + implied30dMove * 2).toFixed(2) };

    const promptParams = {
      ticker: ticker.toUpperCase(), companyName: s.company || ticker,
      sector: s.sector || "N/A", industry: s.industry || "N/A",
      currentPrice, masterScore, rsi, iv, atr, ema20, ema50, ema200,
      support1, resistance1, marketCapStr, ivRank, optimalCSPStrike, optimalCCStrike,
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
      momentumGuclu: rsi >= 40 && rsi <= 70 ? 1 : -1,
      ema20Above: currentPrice > ema20 ? 1 : -1,
      ema50Above: currentPrice > ema50 ? 1 : 0,
      bogaScore: masterScore >= 60 ? 1 : masterScore >= 45 ? 0 : -1,
      atrUygun: atrPct < 5 ? 1 : atrPct < 8 ? 0 : -1,
    };

    return NextResponse.json({
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
          ivRank: +ivRank.toFixed(2), iv, hv30: +hv30.toFixed(1),
          ivHvRatio: +(iv / Math.max(hv30, 1)).toFixed(2),
          cspStrateji: str(ai.cspStrateji, `$${optimalCSPStrike} strike, 14-21 DTE CSP değerlendirilebilir.`),
          ccStrateji: str(ai.ccStrateji, `$${optimalCCStrike} strike, 14-21 DTE CC değerlendirilebilir.`),
          optimalCSPStrike, optimalCCStrike,
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
        masterScore, rsi, iv, hv30, atr, atrPct: +atrPct.toFixed(2),
        ema20, ema50, ema200, support1, resistance1, low52w, high52w,
        avgVol30d, volume, rvol, macd, ivRank: +ivRank.toFixed(2), ivHvRatio: +(iv / Math.max(hv30, 1)).toFixed(2),
        marketCapStr, forecast15, history15, srLevels, maLevels, cspMatrix, ccMatrix,
        historyOHLC: historyRows || [], currentPrice,
        implied30dMove: +implied30dMove.toFixed(2), range1sd, range2sd,
        sp500Change: mo.sp500Change ?? null, nasdaqChange: mo.nasdaqChange ?? null, vixPrice: mo.vixPrice ?? null,
      },
    });
  } catch (err: any) {
    console.error("[deep-analysis] unhandled:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
