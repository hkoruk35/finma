import { NextRequest, NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/copilot/aiFallback";
import { formatNumber } from "@/lib/formatNumber";

export const runtime = "nodejs";
export const maxDuration = 60;

// Detailed financial language instructions with domain-specific terminology
const LANG_INSTRUCTIONS: Record<string, { instruction: string; terms: string }> = {
  en: {
    instruction: "Write the complete analysis in English.",
    terms: "Use standard English financial terminology: swing trade, breakout, momentum, support/resistance, moving average, risk/reward ratio, stop loss, profit target.",
  },
  tr: {
    instruction: "Analizi tamamen Türkçe olarak yaz. Türkçe finans terminolojisi kullan.",
    terms: "Türkçe finans terimleri: swing trade (salınım ticareti), kırılım, momentum, destek/direnç seviyeleri, hareketli ortalama, risk/ödül oranı, zarar kes, kar hedefi, teknik analiz, temel analiz.",
  },
  es: {
    instruction: "Escribe el análisis completo en español usando terminología financiera española.",
    terms: "Términos financieros en español: operación de swing, ruptura, momentum, soporte/resistencia, media móvil, ratio riesgo/beneficio, stop loss, objetivo de beneficio, análisis técnico.",
  },
  pt: {
    instruction: "Escreva a análise completa em português usando terminologia financeira correta.",
    terms: "Termos financeiros em português: swing trade, rompimento, momentum, suporte/resistência, média móvel, relação risco/retorno, stop loss, meta de lucro, análise técnica, análise fundamentalista.",
  },
  fr: {
    instruction: "Rédigez l'analyse complète en français en utilisant la terminologie financière française.",
    terms: "Termes financiers en français: swing trade, cassure, momentum, support/résistance, moyenne mobile, ratio risque/rendement, stop loss, objectif de profit, analyse technique, analyse fondamentale.",
  },
  id: {
    instruction: "Tulis analisis lengkap dalam Bahasa Indonesia menggunakan terminologi keuangan yang tepat.",
    terms: "Istilah keuangan dalam Bahasa Indonesia: swing trade, breakout, momentum, support/resistance, moving average, rasio risiko/imbal hasil, stop loss, target profit, analisis teknikal, analisis fundamental.",
  },
  de: {
    instruction: "Schreibe die vollständige Analyse auf Deutsch mit korrekter Finanzterminologie.",
    terms: "Deutsche Finanzbegriffe: Swing-Trading, Ausbruch, Momentum, Unterstützung/Widerstand, gleitender Durchschnitt, Risiko-Ertrags-Verhältnis, Stop-Loss, Gewinnziel, technische Analyse, Fundamentalanalyse.",
  },
  it: {
    instruction: "Scrivi l'analisi completa in italiano usando la corretta terminologia finanziaria.",
    terms: "Termini finanziari in italiano: swing trade, rottura, momentum, supporto/resistenza, media mobile, rapporto rischio/rendimento, stop loss, obiettivo di profitto, analisi tecnica, analisi fondamentale.",
  },
  ru: {
    instruction: "Напишите полный анализ на русском языке, используя правильную финансовую терминологию на русском языке.",
    terms: "Финансовые термины на русском: свинг-трейдинг (среднесрочная торговля), пробой уровня, импульс рынка, уровни поддержки и сопротивления, скользящая средняя (ЕМА200), соотношение риск/доходность, стоп-лосс, целевая прибыль, технический анализ, фундаментальный анализ. ВАЖНО: Используйте только русский язык для ВСЕГО ответа.",
  },
  ar: {
    instruction: "اكتب التحليل الكامل باللغة العربية مع استخدام المصطلحات المالية الصحيحة باللغة العربية.",
    terms: "المصطلحات المالية بالعربية: تداول التأرجح (Swing Trading)، اختراق مستوى المقاومة، الزخم السعري، مستويات الدعم والمقاومة، المتوسط المتحرك الأسي، نسبة المخاطرة إلى العائد، وقف الخسارة، هدف الربح، التحليل الفني، التحليل الأساسي. مهم: استخدم اللغة العربية فقط لكامل الإجابة.",
  },
  ja: {
    instruction: "完全な分析を日本語で書いてください。日本の金融用語を正確に使用してください。",
    terms: "日本語の金融用語: スイングトレード（中期取引）、ブレイクアウト（価格突破）、モメンタム（勢い）、サポート・レジスタンス（支持線・抵抗線）、移動平均線（EMA200）、リスクリワード比率、ストップロス（損切り）、利益確定目標、テクニカル分析、ファンダメンタル分析。重要：回答全体を日本語で記述すること。",
  },
  ko: {
    instruction: "분석 전체를 한국어로 작성하세요. 한국 금융 용어를 정확하게 사용하세요.",
    terms: "한국어 금융 용어: 스윙 트레이딩（중기 거래）、돌파（브레이크아웃）、모멘텀（추세 동력）、지지선·저항선、이동평균선（EMA200）、위험/수익 비율、손절매（스탑로스）、이익 목표가、기술적 분석、기본적 분석. 중요: 모든 응답을 한국어로만 작성하세요.",
  },
};

// Section headers in each language
const SECTION_HEADERS: Record<string, string[]> = {
  en: ["1. INDUSTRY INSIGHT", "2. PERFORMANCE REVIEW", "3. TECHNICAL STRUCTURE", "4. BOGA AI VERDICT"],
  tr: ["1. SEKTÖR ANALİZİ", "2. PERFORMANS DEĞERLENDİRMESİ", "3. TEKNİK YAPI", "4. BOGA AI KARARI"],
  es: ["1. PERSPECTIVA DEL SECTOR", "2. REVISIÓN DE RENDIMIENTO", "3. ESTRUCTURA TÉCNICA", "4. VEREDICTO BOGA AI"],
  pt: ["1. VISÃO DO SETOR", "2. ANÁLISE DE DESEMPENHO", "3. ESTRUTURA TÉCNICA", "4. VEREDICTO BOGA AI"],
  fr: ["1. ANALYSE DU SECTEUR", "2. ÉVALUATION DES PERFORMANCES", "3. STRUCTURE TECHNIQUE", "4. VERDICT BOGA AI"],
  id: ["1. WAWASAN INDUSTRI", "2. TINJAUAN KINERJA", "3. STRUKTUR TEKNIKAL", "4. KEPUTUSAN BOGA AI"],
  de: ["1. BRANCHENANALYSE", "2. LEISTUNGSBEWERTUNG", "3. TECHNISCHE STRUKTUR", "4. BOGA AI URTEIL"],
  it: ["1. ANALISI DEL SETTORE", "2. REVISIONE DELLE PERFORMANCE", "3. STRUTTURA TECNICA", "4. VERDETTO BOGA AI"],
  ru: ["1. АНАЛИЗ ОТРАСЛИ", "2. ОЦЕНКА ПОКАЗАТЕЛЕЙ", "3. ТЕХНИЧЕСКАЯ СТРУКТУРА", "4. ВЕРДИКТ BOGA AI"],
  ar: ["1. رؤية القطاع", "2. مراجعة الأداء", "3. الهيكل الفني", "4. حكم BOGA AI"],
  ja: ["1. 業界インサイト", "2. パフォーマンスレビュー", "3. テクニカル構造", "4. BOGA AI 評決"],
  ko: ["1. 산업 인사이트", "2. 성과 검토", "3. 기술적 구조", "4. BOGA AI 평결"],
};

function buildPrompt(pick: any, lang: string): string {
  const langConfig = LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS.en;
  const headers = SECTION_HEADERS[lang] || SECTION_HEADERS.en;

  const technical = pick.technical || {};
  const fundamental = pick.fundamental || {};

  return `You are BOGA AI, an institutional-grade swing trading intelligence system.
CRITICAL: DO NOT mention Claude, Anthropic, Gemini, Google, or any AI model name in your response.
CRITICAL: ${langConfig.instruction}
${langConfig.terms}

Structure your response with EXACTLY these 4 section headers (translate the content, not these markers):
${headers[0]}
${headers[1]}
${headers[2]}
${headers[3]}

Stock Data Reference:
- Ticker: ${pick.ticker}
- Company: ${pick.company}
- Sector: ${pick.sector || "N/A"}
- Current Price: $${pick.current_price}
- BOGA AI Score: ${pick.score}/100 (Signal: ${pick.market_regime || "Bullish"})
- Entry Zone: $${formatNumber(pick.buy_zone?.low, 2) ?? "N/A"} – $${formatNumber(pick.buy_zone?.high, 2) ?? "N/A"}
- Profit Target: $${formatNumber(pick.profit_zone?.low, 2) ?? "N/A"} – $${formatNumber(pick.profit_zone?.high, 2) ?? "N/A"}
- Stop Loss: $${formatNumber(pick.stop_zone?.low, 2) ?? "N/A"} – $${formatNumber(pick.stop_zone?.high, 2) ?? "N/A"}
- Holding Period: ${pick.holding_period || "60-120 days"}
- Entry Signal: ${pick.entry_mode || "EMA200 Breakout"}
- EMA200 Breakout: ${pick.ema200_breakout ? "Yes" : "No"}
- Golden Cross: ${pick.golden_cross ? "Yes" : "No"}
${Object.keys(technical).length > 0 ? `
Technical Indicators:
- RSI (14): ${technical.rsi_14 ?? pick.rsi ?? "N/A"}
- Relative Volume (RVOL): ${technical.rvol ?? pick.rvol ?? "N/A"}
- ADX: ${technical.adx ?? pick.adx ?? "N/A"}
- IV Rank: ${technical.iv_rank ?? "N/A"}
` : ""}
${Object.keys(fundamental).length > 0 ? `
Fundamental Data:
- PE Ratio: ${fundamental.pe_ratio ?? "N/A"}
- Market Cap: ${fundamental.market_cap ? "$" + formatNumber((fundamental.market_cap / 1e9), 1) + "B" : "N/A"}
- Revenue Growth (TTM): ${fundamental.revenue_growth_ttm ? formatNumber((fundamental.revenue_growth_ttm * 100), 1) + "%" : "N/A"}
- Profit Margin: ${fundamental.profit_margins ? formatNumber((fundamental.profit_margins * 100), 1) + "%" : "N/A"}
` : ""}

Instructions:
- Write 250-400 words total across all 4 sections
- Each section: 2-4 sentences maximum
- Interpret the data — do NOT just repeat the raw numbers  
- Be specific: reference price levels, indicator readings, sector context
- Maintain a professional institutional-grade tone throughout
- ${langConfig.instruction}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pick, lang = "en" } = body;

    if (!pick?.ticker) {
      return NextResponse.json({ error: "Missing pick data" }, { status: 400 });
    }

    const validLangs = Object.keys(LANG_INSTRUCTIONS);
    const safeLang = validLangs.includes(lang) ? lang : "en";

    const prompt = buildPrompt(pick, safeLang);
    // Ekonomik mimari: DeepSeek birincil (ucuz), Gemini ikincil, Claude Haiku
    // üçüncü/son çare — bkz. lib/copilot/aiFallback.ts.
    const result = await generateWithFallback({ userPrompt: prompt, temperature: 0.6, maxTokens: 2048, timeoutMs: 55000 });

    if (!result) {
      return NextResponse.json({ error: "Failed to generate analysis" }, { status: 503 });
    }

    return NextResponse.json({
      ticker: pick.ticker,
      lang: safeLang,
      analysis: result.text.trim(),
      generated_at: new Date().toISOString(),
      model: result.source,
    });
  } catch (e: any) {
    console.error("[ai-briefing] error:", e?.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
