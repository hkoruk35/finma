import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(v: any, fallback = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}

function buildForecast15(forecast: any[], currentPrice: number) {
  const signals = ["EMA test", "RSI izle", "Hacim onayı", "Destek testi", "Momentum", "VWAP yakını", "EMA 20 kırılım?", "RSI nötr", "Konsolidasyon", "Direnç yakını", "EMA 50 test", "Kırılım bekleme", "RSI aşırı alım?", "Vade yakını", "30G kapanış"];
  const actions = ["Bekle", "CSP değerlendir", "CSP aç", "Bekle", "CSP izle", "CSP/CC", "CSP aç", "Bekle", "CC değerlendir", "CC aç", "Bekle", "CSP yenile", "CC izle", "Pozisyon gözden geçir", "Sonraki dönem planla"];
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
      teknikSinyal: signals[i] || "İzle",
      eylemOnerisi: actions[i] || "Bekle",
    };
  });
}

// Clean and extract JSON from LLM response (handles markdown code fences, trailing commas, etc.)
function extractJSON(raw: string): string {
  // Remove markdown fences
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find first { and last }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  s = s.slice(start, end + 1);
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  // Escape unescaped control chars inside strings (basic fix)
  s = s.replace(/[\x00-\x1F\x7F]/g, (c) => {
    const map: Record<string, string> = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };
    return map[c] || "";
  });
  return s;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(params: {
  ticker: string; companyName: string; sector: string; industry: string;
  currentPrice: number; masterScore: number; rsi: number; iv: number;
  atr: number; ema20: number; ema50: number; ema200: number;
  support1: number; resistance1: number; marketCapStr: string;
  ivRank: number; optimalCSPStrike: number; optimalCCStrike: number;
  bearTarget: number; baseTarget: number; bullTarget: number;
}) {
  const p = params;
  // We ask Claude ONLY for text fields — no numbers, no arrays
  // This avoids JSON corruption from Turkish text with special chars
  return `Sen BOGA AI, uzman bir opsiyon stratejisti ve teknik analistsin.
Aşağıdaki hisse için kısa ve net Türkçe analizler üret.

HISSE: ${p.ticker} — ${p.companyName}
Sektör: ${p.sector} | Endüstri: ${p.industry}
Fiyat: $${p.currentPrice.toFixed(2)} | BOGA Skor: ${p.masterScore}/100
RSI: ${p.rsi.toFixed(1)} | ATR: $${p.atr.toFixed(2)} | IV: %${p.iv}
EMA20: $${p.ema20.toFixed(2)} | EMA50: $${p.ema50.toFixed(2)} | EMA200: $${p.ema200.toFixed(2)}
Destek: $${p.support1.toFixed(2)} | Direnç: $${p.resistance1.toFixed(2)}
Piyasa Değeri: ${p.marketCapStr}
CSP Strike: $${p.optimalCSPStrike.toFixed(2)} | CC Strike: $${p.optimalCCStrike.toFixed(2)}
Bear Hedef (15G): $${p.bearTarget.toFixed(2)} | Base: $${p.baseTarget.toFixed(2)} | Bull: $${p.bullTarget.toFixed(2)}

SADECE aşağıdaki JSON yapısını döndür (başka metin ekleme):
{
  "hisseTipi": "...",
  "yukselisKarakteri": "...",
  "dususKarakteri": "...",
  "hacimTepkisi": "...",
  "haberEtkisi": "...",
  "trendDurumu": "...",
  "kritikSeviyeler": "...",
  "momentumYorumu": "...",
  "volatilite": "...",
  "ivDurumu": "...",
  "cspStrateji": "...",
  "ccStrateji": "...",
  "haftalikPrimTahmin": "...",
  "yillikGetiriTahmin": "...",
  "bearTetikleyici": "...",
  "baseTetikleyici": "...",
  "bullTetikleyici": "...",
  "bearOlasilik": 25,
  "baseOlasilik": 55,
  "bullOlasilik": 20,
  "oneri": "...",
  "kritikRisk": "...",
  "genelPuan": ${(p.masterScore / 10).toFixed(1)},
  "cspUygunlugu": "${p.masterScore >= 65 ? "GÜÇLÜ" : p.masterScore >= 50 ? "ORTA" : "ZAYIF"}",
  "ccUygunlugu": "${p.masterScore >= 60 ? "GÜÇLÜ" : p.masterScore >= 45 ? "ORTA" : "ZAYIF"}"
}

Kurallar:
- Her alan max 2 cümle, net ve profesyonel
- Tırnak icinde tırnak kullanma (tek tirnak da kullanma)
- Ozel karakter, yeni satir, sekme yok — duz metin yaz
- Rakamsal alanlarda (bearOlasilik, baseOlasilik, bullOlasilik, genelPuan) sadece sayi yaz`;
}

// ── Gemini fallback ────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
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

    // Build forecast15 server-side from Monte Carlo data
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

    const prompt = buildPrompt(promptParams);

    // ── Try Anthropic, then Gemini ────────────────────────────────────────────
    let rawText = "";
    let aiSource = "claude";

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        });
        rawText = (msg.content[0] as any).text || "";
      } catch (e: any) {
        console.error("[deep-analysis] Anthropic failed:", e?.message);
        rawText = "";
      }
    }

    if (!rawText && process.env.GEMINI_API_KEY) {
      try {
        rawText = await callGemini(prompt);
        aiSource = "gemini";
      } catch (e: any) {
        console.error("[deep-analysis] Gemini failed:", e?.message);
        rawText = "";
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: "Tüm AI servisleri kullanılamıyor. Lütfen tekrar deneyin." }, { status: 503 });
    }

    // ── Parse JSON robustly ───────────────────────────────────────────────────
    let ai: Record<string, any> = {};
    try {
      ai = JSON.parse(extractJSON(rawText));
    } catch (e: any) {
      console.error("[deep-analysis] JSON parse failed:", e?.message, "| raw:", rawText.slice(0, 300));
      return NextResponse.json({ error: "AI yanıtı işlenemedi: " + e?.message }, { status: 500 });
    }

    // Safely pick values with fallbacks
    const str = (v: any, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
    const num = (v: any, fb: number) => (typeof v === "number" ? v : parseFloat(v) || fb);

    // Checklist scores (server-side, deterministic)
    const ceklistSkorlar = {
      trendYapisi: masterScore >= 65 ? 1 : masterScore >= 50 ? 0 : -1,
      ivUygun: iv > 30 ? 1 : iv > 20 ? 0 : -1,
      destekGucu: masterScore >= 60 ? 1 : 0,
      momentumGuclu: rsi >= 40 && rsi <= 70 ? 1 : -1,
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
          hisseTipi: str(ai.hisseTipi, "Teknik analiz tabanlı swing trade hissesi."),
          yukselisKarakteri: str(ai.yukselisKarakteri, "Momentum ile yükseliş."),
          dususKarakteri: str(ai.dususKarakteri, "Destek kırılırsa konsolidasyon."),
          hacimTepkisi: str(ai.hacimTepkisi, "Yüksek hacimde volatilite artar."),
          haberEtkisi: str(ai.haberEtkisi, "Haberlere duyarlı."),
        },
        teknikYorum: {
          trendDurumu: str(ai.trendDurumu, "Mevcut trend analizi bekleniyor."),
          kritikSeviyeler: str(ai.kritikSeviyeler, "Destek ve direnç seviyeleri aktif."),
          momentumYorumu: str(ai.momentumYorumu, "Momentum nötr bölgede."),
          volatilite: str(ai.volatilite, "Ortalama volatilite seviyesi."),
        },
        forecast15,
        opsiyonAnaliz: {
          ivDurumu: str(ai.ivDurumu, "IV seviyesi değerlendiriliyor."),
          ivRank: +ivRank.toFixed(0),
          cspStrateji: str(ai.cspStrateji, "CSP stratejisi destek seviyesinde uygulanabilir."),
          ccStrateji: str(ai.ccStrateji, "CC stratejisi direnç seviyesinde değerlendirilebilir."),
          optimalCSPStrike,
          optimalCCStrike,
          haftalikPrimTahmin: str(ai.haftalikPrimTahmin, "%0.5–1.5"),
          yillikGetiriTahmin: str(ai.yillikGetiriTahmin, "%20–40"),
        },
        scenarioOzeti: {
          bear: { hedef: bearTarget, olasilik: num(ai.bearOlasilik, 25), tetikleyici: str(ai.bearTetikleyici, "Negatif haber / sektör baskısı") },
          base: { hedef: baseTarget, olasilik: num(ai.baseOlasilik, 55), tetikleyici: str(ai.baseTetikleyici, "Mevcut momentum devamı") },
          bull: { hedef: bullTarget, olasilik: num(ai.bullOlasilik, 20), tetikleyici: str(ai.bullTetikleyici, "Güçlü katalizör") },
        },
        ceklistSkorlar,
        sonucKarar: {
          genelPuan: str(String(ai.genelPuan ?? (masterScore / 10).toFixed(1)), (masterScore / 10).toFixed(1)),
          cspUygunlugu: str(ai.cspUygunlugu, masterScore >= 65 ? "GÜÇLÜ" : masterScore >= 50 ? "ORTA" : "ZAYIF"),
          ccUygunlugu: str(ai.ccUygunlugu, masterScore >= 60 ? "GÜÇLÜ" : masterScore >= 45 ? "ORTA" : "ZAYIF"),
          oneri: str(ai.oneri, "Teknik yapı ve IV seviyesi dikkate alınarak pozisyon değerlendirilebilir."),
          kritikRisk: str(ai.kritikRisk, "Bilanço tarihi ve makro gelişmeler yakından takip edilmeli."),
        },
      },
      rawData: { masterScore, rsi, iv, atr, ema20, ema50, ema200, support1, resistance1, forecast15 },
    });
  } catch (err: any) {
    console.error("[deep-analysis] unhandled:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
