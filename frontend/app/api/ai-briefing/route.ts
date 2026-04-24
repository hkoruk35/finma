import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Language instructions for Gemini
const LANG_INSTRUCTIONS: Record<string, string> = {
  en: "Write the complete analysis in English.",
  tr: "Analizi tamamen Türkçe olarak yaz.",
  es: "Escribe el análisis completo en español.",
  pt: "Escreva a análise completa em português.",
  fr: "Rédigez l'analyse complète en français.",
  id: "Tulis analisis lengkap dalam Bahasa Indonesia.",
  de: "Schreibe die vollständige Analyse auf Deutsch.",
  it: "Scrivi l'analisi completa in italiano.",
  ru: "Напишите полный анализ на русском языке.",
  ar: "اكتب التحليل الكامل باللغة العربية.",
  ja: "分析を完全に日本語で書いてください。",
  ko: "분석을 완전히 한국어로 작성하세요.",
};

function buildPrompt(pick: any, lang: string): string {
  const langInstruction = LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS.en;

  return `You are BOGA AI, an institutional-grade swing trading intelligence system. 
DO NOT mention Claude, Anthropic, Gemini, or Google in your response.
${langInstruction}

Analyze the following stock based on the data below. Structure your response with these numbered sections:

1. INDUSTRY INSIGHT
2. PERFORMANCE REVIEW  
3. TECHNICAL STRUCTURE
4. BOGA AI VERDICT

Stock Data:
- Ticker: ${pick.ticker}
- Company: ${pick.company}
- Sector: ${pick.sector || "N/A"}
- Current Price: $${pick.current_price}
- BOGA AI Score: ${pick.score}/100 (${pick.market_regime || "Bullish"})
- Buy Zone: $${pick.buy_zone?.low} – $${pick.buy_zone?.high}
- Profit Target: $${pick.profit_zone?.low} – $${pick.profit_zone?.high}
- Stop Loss: $${pick.stop_zone?.low} – $${pick.stop_zone?.high}
- Holding Period: ${pick.holding_period || "60-120 days"}
- Signal Type: ${pick.entry_mode || "EMA200 Breakout"}
${pick.technical ? `
Technical Indicators:
- RSI: ${pick.technical?.rsi_14 ?? pick.rsi ?? "N/A"}
- RVOL: ${pick.technical?.rvol ?? pick.rvol ?? "N/A"}
- ADX: ${pick.technical?.adx ?? pick.adx ?? "N/A"}
- EMA200 Breakout: ${pick.ema200_breakout ? "Yes" : "No"}
- Golden Cross: ${pick.golden_cross ? "Yes" : "No"}
` : ""}
${pick.fundamental ? `
Fundamental Data:
- PE Ratio: ${pick.fundamental?.pe_ratio ?? "N/A"}
- Market Cap: ${pick.fundamental?.market_cap ? "$" + (pick.fundamental.market_cap / 1e9).toFixed(1) + "B" : "N/A"}
- Revenue Growth: ${pick.fundamental?.revenue_growth_ttm ? (pick.fundamental.revenue_growth_ttm * 100).toFixed(1) + "%" : "N/A"}
` : ""}

Write a professional, data-driven analysis of 200-400 words total. Each section should be 2-3 sentences. Be specific about price levels and technical indicators. Do not repeat the raw numbers from the input — interpret them.`;
}

async function generateWithGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.65, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(55000),
      }
    );

    if (!res.ok) {
      console.error(`[gemini] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (e: any) {
    console.error("[gemini] error:", e?.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pick, lang = "en" } = body;

    if (!pick?.ticker) {
      return NextResponse.json({ error: "Missing pick data" }, { status: 400 });
    }

    const prompt = buildPrompt(pick, lang);
    const analysis = await generateWithGemini(prompt);

    if (!analysis) {
      return NextResponse.json({ error: "Failed to generate analysis" }, { status: 503 });
    }

    return NextResponse.json({
      ticker: pick.ticker,
      lang,
      analysis,
      generated_at: new Date().toISOString(),
      model: "gemini-2.5-flash",
    });
  } catch (e: any) {
    console.error("[ai-briefing] error:", e?.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
