import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(v: any, fallback = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
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
    return {
      day,
      bear: +bear.toFixed(2),
      base: +base.toFixed(2),
      bull: +bull.toFixed(2),
      teknikSinyal: signals[i],
      eylemOnerisi: actions[i],
    };
  });
}

// Try to extract JSON from LLM response (handles markdown fences, trailing commas, preamble text)
function tryParseJSON(raw: string): Record<string, any> | null {
  if (!raw || !raw.trim()) return null;

  // Strip markdown fences
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Find first { and last }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  s = s.slice(start, end + 1);

  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");

  // Strip control characters (keep \n \r \t as escaped)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  try {
    return JSON.parse(s);
  } catch {
    // Try a more aggressive cleanup: replace unescaped newlines inside strings
    try {
      const cleaned = s.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) =>
        match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
      );
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

// Build full fallback analysis from raw data (no AI needed)
function buildFallback(p: {
  ticker: string; sector: string; masterScore: number; rsi: number; iv: number;
  ema20: number; ema50: number; currentPrice: number; support1: number;
  resistance1: number; ivRank: number; optimalCSPStrike: number; optimalCCStrike: number;
  bearTarget: number; baseTarget: number; bullTarget: number;
}) {
  const aboveEma20 = p.currentPrice > p.ema20;
  const aboveEma50 = p.currentPrice > p.ema50;
  const trendStr = aboveEma20 && aboveEma50 ? "yükseliş trendinde" : !aboveEma20 && !aboveEma50 ? "düşüş baskısı altında" : "karışık sinyaller";
  const rsiStr = p.rsi > 70 ? "aşırı alım bölgesinde" : p.rsi < 30 ? "aşırı satım bölgesinde" : "nötr bölgede";
  const ivStr = p.iv > 50 ? "yüksek" : p.iv > 30 ? "orta" : "düşük";
  const cspStr = p.masterScore >= 60 ? "GÜÇLÜ" : p.masterScore >= 45 ? "ORTA" : "ZAYIF";
  const ccStr = p.masterScore >= 55 ? "GÜÇLÜ" : p.masterScore >= 42 ? "ORTA" : "ZAYIF";

  return {
    hisseTipi: `${p.sector} sektöründe faaliyet gösteren, teknik analiz tabanlı swing trade hissesi. BOGA skoru ${p.masterScore}/100 ile ${trendStr}.`,
    yukselisKarakteri: `Momentum artışı ile EMA üzerinde güçlü kapanışlar hedeflenir. Hacim artışı yükselişi desteklediğinde pozitif ivme kazanır.`,
    dususKarakteri: `Destek kırılımlarında konsolidasyon yaşanabilir. EMA 50 altında kalmak orta vadeli baskı sinyali verir.`,
    hacimTepkisi: `Ortalamanın üzerinde hacimli günlerde volatilite artar. Hacim düşüşü konsolidasyona işaret eder.`,
    haberEtkisi: `Sektörel haberler ve makro gelişmeler kısa vadeli fiyat hareketini etkiler. Bilanço dönemleri IV yükselişine neden olur.`,
    trendDurumu: `Fiyat şu an EMA 20 ${aboveEma20 ? "üzerinde" : "altında"} ve EMA 50 ${aboveEma50 ? "üzerinde" : "altında"} seyrediyor. Genel görünüm ${trendStr}.`,
    kritikSeviyeler: `Kritik destek $${p.support1.toFixed(2)} seviyesinde bulunuyor. $${p.resistance1.toFixed(2)} direnci kırılırsa yeni hedefler devreye girer.`,
    momentumYorumu: `RSI ${p.rsi.toFixed(1)} ile ${rsiStr}. EMA hizalaması mevcut momentum yönünü destekliyor.`,
    volatilite: `IV %${p.iv} seviyesinde ${ivStr} volatilite ortamı mevcut. ATR bazlı günlük hareket prim stratejileri için uygun zemin sunuyor.`,
    ivDurumu: `IV Rank ${p.ivRank.toFixed(0)}/100 seviyesinde. ${p.ivRank > 50 ? "Prim satmak için avantajlı ortam mevcut." : p.ivRank > 25 ? "Seçici prim stratejisi uygulanabilir." : "IV düşük, prim değerleri sınırlı."}`,
    cspStrateji: `$${p.optimalCSPStrike.toFixed(2)} strike ile 14-21 DTE CSP açılabilir. Delta 0.20-0.30 arası tercih edilmeli.`,
    ccStrateji: `$${p.optimalCCStrike.toFixed(2)} strike ile 14-21 DTE CC değerlendirilebilir. Atanma durumunda wheel stratejisine geçilir.`,
    haftalikPrimTahmin: `%0.5–1.5 (IV seviyesine göre)`,
    yillikGetiriTahmin: `%20–45 (wheel stratejisi ile)`,
    bearTetikleyici: `Negatif haber veya sektör baskısı`,
    baseTetikleyici: `Mevcut momentum ve teknik yapı devamı`,
    bullTetikleyici: `Güçlü katalizör veya short squeeze`,
    bearOlasilik: 25,
    baseOlasilik: 55,
    bullOlasilik: 20,
    oneri: `Teknik yapı ve IV seviyesi değerlendirilerek ${cspStr === "GÜÇLÜ" ? "CSP stratejisi uygulanabilir." : "pozisyon açmadan önce sinyal beklenmesi önerilir."}`,
    kritikRisk: `Bilanço tarihi ve makro gelişmeler (FOMC, CPI) yakından takip edilmeli. IV crush riski bilanço öncesi pozisyonları etkiler.`,
    genelPuan: (p.masterScore / 10).toFixed(1),
    cspUygunlugu: cspStr,
    ccUygunlugu: ccStr,
  };
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_MSG = `Sen bir finansal analiz asistanısın. Kullanıcı sana hisse senedi verileri verir ve sen YALNIZCA geçerli bir JSON nesnesi döndürürsün. Hiçbir açıklama, giriş metni veya markdown ekleme. Yanıtın ilk karakteri { ve son karakteri } olmalıdır.`;

function buildUserPrompt(p: {
  ticker: string; companyName: string; sector: string; industry: string;
  currentPrice: number; masterScore: number; rsi: number; iv: number;
  atr: number; ema20: number; ema50: number; ema200: number;
  support1: number; resistance1: number; marketCapStr: string;
  ivRank: number; optimalCSPStrike: number; optimalCCStrike: number;
  bearTarget: number; baseTarget: number; bullTarget: number;
}) {
  const cspU = p.masterScore >= 65 ? "GUCLU" : p.masterScore >= 50 ? "ORTA" : "ZAYIF";
  const ccU = p.masterScore >= 60 ? "GUCLU" : p.masterScore >= 45 ? "ORTA" : "ZAYIF";

  return `Hisse verisi:
TICKER: ${p.ticker} | SIRKET: ${p.companyName} | SEKTOR: ${p.sector}
FIYAT: ${p.currentPrice.toFixed(2)} | SKOR: ${p.masterScore} | RSI: ${p.rsi.toFixed(1)} | IV: ${p.iv}
EMA20: ${p.ema20.toFixed(2)} | EMA50: ${p.ema50.toFixed(2)} | EMA200: ${p.ema200.toFixed(2)}
DESTEK: ${p.support1.toFixed(2)} | DIRENC: ${p.resistance1.toFixed(2)} | ATR: ${p.atr.toFixed(2)}
CSP_STRIKE: ${p.optimalCSPStrike.toFixed(2)} | CC_STRIKE: ${p.optimalCCStrike.toFixed(2)}
BEAR_15G: ${p.bearTarget.toFixed(2)} | BASE_15G: ${p.baseTarget.toFixed(2)} | BULL_15G: ${p.bullTarget.toFixed(2)}

Su alanlari doldur, her deger maksimum 2 cumle Turkce duz metin (tirnak, ozel karakter, satir atlama YOK):
{"hisseTipi":"...","yukselisKarakteri":"...","dususKarakteri":"...","hacimTepkisi":"...","haberEtkisi":"...","trendDurumu":"...","kritikSeviyeler":"...","momentumYorumu":"...","volatilite":"...","ivDurumu":"...","cspStrateji":"...","ccStrateji":"...","haftalikPrimTahmin":"...","yillikGetiriTahmin":"...","bearTetikleyici":"...","baseTetikleyici":"...","bullTetikleyici":"...","bearOlasilik":25,"baseOlasilik":55,"bullOlasilik":20,"oneri":"...","kritikRisk":"...","genelPuan":${(p.masterScore / 10).toFixed(1)},"cspUygunlugu":"${cspU}","ccUygunlugu":"${ccU}"}`;
}

// ── Gemini fallback ────────────────────────────────────────────────────────────

async function callGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const systemInstruction = `Sen bir finansal analiz asistanisın. YALNIZCA gecerli JSON nesnesi dondur. Hicbir aciklama veya markdown ekleme. Ilk karakter { son karakter } olmali.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 100)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { ticker, stockData } = await req.json();
    if (!ticker || !stockData) {
      return NextResponse.json({ error: "Missing ticker or stockData" }, { status: 400 });
    }

    const s = stockData || {};
    const pr = s.price || {};
    const tech = s.technical || {};
    const sc = s.scores || {};
    const sd = s.scores_detail || s.strategy || {};

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
    const marketCap = safeNum(s.marketCap ?? s.market_cap, 0);
    const marketCapStr = marketCap > 1e9
      ? "$" + (marketCap / 1e9).toFixed(1) + "B"
      : marketCap > 1e6 ? "$" + (marketCap / 1e6).toFixed(0) + "M" : "N/A";

    const ivRank = Math.min(100, Math.max(0, ((iv - 15) / 65) * 100));
    const optimalCSPStrike = +(support1 * 0.98).toFixed(2);
    const optimalCCStrike = +(resistance1 * 1.01).toFixed(2);

    // Build forecast15 server-side — never depends on AI
    const rawForecast = Array.isArray(s.forecast) ? s.forecast
      : Array.isArray(s.forecast?.days) ? s.forecast.days : [];
    const forecast15 = buildForecast15(rawForecast, currentPrice);

    const bearTarget = forecast15[14].bear;
    const baseTarget = forecast15[14].base;
    const bullTarget = forecast15[14].bull;

    const promptParams = {
      ticker: ticker.toUpperCase(),
      companyName: s.company || ticker,
      sector: s.sector || "N/A",
      industry: s.industry || "N/A",
      currentPrice, masterScore, rsi, iv, atr, ema20, ema50, ema200,
      support1, resistance1, marketCapStr, ivRank,
      optimalCSPStrike, optimalCCStrike, bearTarget, baseTarget, bullTarget,
    };

    const userPrompt = buildUserPrompt(promptParams);

    // ── Try Anthropic ─────────────────────────────────────────────────────────
    let rawText = "";
    let aiSource = "fallback";

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_MSG,
          messages: [{ role: "user", content: userPrompt }],
        });
        rawText = (msg.content[0] as any).text || "";
        if (rawText) aiSource = "claude";
      } catch (e: any) {
        console.error("[deep-analysis] Anthropic failed:", e?.message);
      }
    }

    // ── Try Gemini if Anthropic failed or missing ─────────────────────────────
    if (!rawText && process.env.GEMINI_API_KEY) {
      try {
        rawText = await callGemini(userPrompt);
        if (rawText) aiSource = "gemini";
      } catch (e: any) {
        console.error("[deep-analysis] Gemini failed:", e?.message);
      }
    }

    // ── Parse JSON — if fails, use deterministic fallback ────────────────────
    let ai: Record<string, any> | null = null;
    if (rawText) {
      ai = tryParseJSON(rawText);
      if (!ai) {
        console.warn("[deep-analysis] JSON parse failed, using fallback. Raw:", rawText.slice(0, 200));
      }
    }

    // Always produce a response — worst case use fallback data
    if (!ai) {
      ai = buildFallback({
        ticker: ticker.toUpperCase(),
        sector: promptParams.sector,
        masterScore, rsi, iv, ema20, ema50, currentPrice,
        support1, resistance1, ivRank,
        optimalCSPStrike, optimalCCStrike,
        bearTarget, baseTarget, bullTarget,
      });
      aiSource = "fallback";
    }

    // Safe value extractors
    const str = (v: any, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
    const num = (v: any, fb: number) => (typeof v === "number" ? v : parseFloat(String(v)) || fb);

    // Checklist scores (server-side, deterministic)
    const ceklistSkorlar = {
      trendYapisi: masterScore >= 65 ? 1 : masterScore >= 50 ? 0 : -1,
      ivUygun: iv > 30 ? 1 : iv > 20 ? 0 : -1,
      destekGucu: masterScore >= 60 ? 1 : 0,
      momentumGuclu: rsi >= 40 && rsi <= 70 ? 1 : -1,
    };

    // Normalize cspUygunlugu / ccUygunlugu (AI might return GUCLU instead of GÜÇLÜ)
    const normalizeLevel = (v: any, fb: string) => {
      const s2 = String(v || "").toUpperCase();
      if (s2.includes("G") && (s2.includes("LU") || s2.includes("LÜ") || s2.includes("STRONG"))) return "GÜÇLÜ";
      if (s2.includes("ORTA") || s2.includes("MED") || s2.includes("MOD")) return "ORTA";
      if (s2.includes("ZAY") || s2.includes("WEAK")) return "ZAYIF";
      return fb;
    };

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      companyName: promptParams.companyName,
      currentPrice,
      sector: promptParams.sector,
      industry: promptParams.industry,
      generatedAt: new Date().toISOString(),
      aiSource,
      analysis: {
        dna: {
          hisseTipi:        str(ai.hisseTipi,        `${promptParams.sector} sektörü teknik analiz hissesi.`),
          yukselisKarakteri:str(ai.yukselisKarakteri, "Momentum artışı ile yükseliş ivme kazanır."),
          dususKarakteri:   str(ai.dususKarakteri,    "Destek kırılımlarında konsolidasyon yaşanabilir."),
          hacimTepkisi:     str(ai.hacimTepkisi,      "Yüksek hacimde volatilite ve hareket artar."),
          haberEtkisi:      str(ai.haberEtkisi,       "Sektörel ve makro haberler kısa vadede etkilidir."),
        },
        teknikYorum: {
          trendDurumu:    str(ai.trendDurumu,    "Trend analizi verilerden değerlendirilmektedir."),
          kritikSeviyeler:str(ai.kritikSeviyeler,"Destek ve direnç seviyeleri aktif şekilde izleniyor."),
          momentumYorumu: str(ai.momentumYorumu, "RSI ve EMA momentum nötr bölgede seyrediyor."),
          volatilite:     str(ai.volatilite,     "Mevcut volatilite ortalamanın üzerinde."),
        },
        forecast15,
        opsiyonAnaliz: {
          ivDurumu:           str(ai.ivDurumu,           "IV seviyesi değerlendiriliyor."),
          ivRank:             +ivRank.toFixed(0),
          cspStrateji:        str(ai.cspStrateji,        `$${optimalCSPStrike} strike, 14-21 DTE CSP değerlendirilebilir.`),
          ccStrateji:         str(ai.ccStrateji,         `$${optimalCCStrike} strike, 14-21 DTE CC değerlendirilebilir.`),
          optimalCSPStrike,
          optimalCCStrike,
          haftalikPrimTahmin: str(ai.haftalikPrimTahmin, "%0.5–1.5"),
          yillikGetiriTahmin: str(ai.yillikGetiriTahmin, "%20–45"),
        },
        scenarioOzeti: {
          bear: { hedef: bearTarget, olasilik: num(ai.bearOlasilik, 25), tetikleyici: str(ai.bearTetikleyici, "Negatif haber / sektör baskısı") },
          base: { hedef: baseTarget, olasilik: num(ai.baseOlasilik, 55), tetikleyici: str(ai.baseTetikleyici, "Mevcut momentum devamı") },
          bull: { hedef: bullTarget, olasilik: num(ai.bullOlasilik, 20), tetikleyici: str(ai.bullTetikleyici, "Güçlü katalizör veya short squeeze") },
        },
        ceklistSkorlar,
        sonucKarar: {
          genelPuan:    str(String(ai.genelPuan ?? (masterScore / 10).toFixed(1)), (masterScore / 10).toFixed(1)),
          cspUygunlugu: normalizeLevel(ai.cspUygunlugu, masterScore >= 65 ? "GÜÇLÜ" : masterScore >= 50 ? "ORTA" : "ZAYIF"),
          ccUygunlugu:  normalizeLevel(ai.ccUygunlugu, masterScore >= 60 ? "GÜÇLÜ" : masterScore >= 45 ? "ORTA" : "ZAYIF"),
          oneri:        str(ai.oneri,       "Teknik yapı ve IV seviyesi dikkate alınarak pozisyon değerlendirilebilir."),
          kritikRisk:   str(ai.kritikRisk,  "Bilanço tarihi ve makro gelişmeler yakından takip edilmeli."),
        },
      },
      rawData: { masterScore, rsi, iv, atr, ema20, ema50, ema200, support1, resistance1, forecast15 },
    });
  } catch (err: any) {
    console.error("[deep-analysis] unhandled:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
