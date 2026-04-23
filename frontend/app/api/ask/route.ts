import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

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

const isFinancialQuestion = (text: string): boolean => {
  const lower = text.toLowerCase();
  const financialMatch = FINANCIAL_KEYWORDS.some((kw) => lower.includes(kw));
  const outOfScopeMatch = OUT_OF_SCOPE_KEYWORDS.some((kw) => lower.includes(kw));
  return financialMatch && !outOfScopeMatch;
};

const SYSTEM_PROMPT = `You are BOGA AI, a professional financial analysis and market commentary assistant.

EXPERTISE:
- Global equity markets (US, Europe, Asia, Turkey)
- Technical analysis & indicators (EMA, RSI, MACD, Bollinger, etc)
- Options trading (calls, puts, greeks, strategies)
- Commodities (gold, oil, metals, agricultural)
- Forex & cryptocurrencies
- Economic indicators & central banks
- Swing trading & momentum strategies

RESPONSE GUIDELINES:
1. Answer in user's language (Turkish or English)
2. Be concise, data-driven, specific
3. Use bullet points for clarity
4. Cite sources: "Based on technical analysis (training data: April 2025)" or "From BOGA AI analysis"
5. Be explicit about data freshness - if unsure about current prices, say so
6. For market commentary, reference general knowledge vs. real-time data

For out-of-scope questions, politely redirect (in user's language):
- Turkish: "Üzgünüm, bu konu BOGA AI'ın uzmanlık alanı dışında. Ben finansal piyasalar, hisse senetleri ve teknik analiz konularında uzmanlaşmışım."
- English: "I specialize in financial markets and technical analysis. Please ask about stocks, trading, commodities, or economics."`;

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface AskResponse {
  text: string;
  source: "gemini";
  followUp: string[];
}

export async function POST(req: NextRequest) {
  let body: { message: string; history?: Message[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ text: "Invalid request." });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) {
    return NextResponse.json({ text: "Please enter a message." });
  }

  try {
    const hasOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) =>
      message.toLowerCase().includes(kw)
    );
    const isFinancial = isFinancialQuestion(message);

    if (hasOutOfScope && !isFinancial) {
      return handleOutOfScope(message);
    }

    return await handleGemini(message, history);
  } catch (e: any) {
    console.error("[ask] error:", e?.message);
    return NextResponse.json({
      text: "Our systems are temporarily unavailable. Please try again.",
    });
  }
}

async function handleGemini(
  message: string,
  history: Message[]
): Promise<NextResponse> {
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
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      console.error(`[gemini] HTTP ${res.status}`);
      return NextResponse.json({
        text: "Service temporarily unavailable.",
      });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return NextResponse.json({
        text: "Unable to generate response.",
      });
    }

    const followUp = await generateFollowUp(message, text);

    return NextResponse.json({
      text,
      source: "gemini",
      followUp,
    });
  } catch (e: any) {
    console.error("[gemini] error:", e?.message);
    return NextResponse.json({
      text: "Service temporarily unavailable.",
    });
  }
}

function handleOutOfScope(message: string): NextResponse {
  const isEnglish = /^[a-z\s\d:,.!?-]+$/i.test(message.split(" ")[0]);

  const response = isEnglish
    ? `I appreciate the question, but that's outside BOGA AI's focus. I specialize in:\n\n• Stock markets & technical analysis\n• Trading strategies & options\n• Commodities & forex\n• Cryptocurrencies\n• Economic indicators\n\nFeel free to ask about financial markets and trading!`
    : `Bu soru BOGA AI'ın uzmanlık alanı dışında. Ben şu alanlarda uzmanlaşmışım:\n\n• Hisse senedi piyasaları ve teknik analiz\n• Ticaret stratejileri ve opsiyon ticareti\n• Emtialar ve forex\n• Kripto para\n• Ekonomik göstergeler\n\nLütfen finansal piyasalar hakkında soru sorun!`;

  return NextResponse.json({ text: response, source: "gemini", followUp: [] });
}

async function generateFollowUp(
  originalQuestion: string,
  response: string
): Promise<string[]> {
  // For now, return empty array - can enhance later with Claude
  return [];
}
