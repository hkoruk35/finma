import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

const isFinancialQuestion = (text: string): boolean => {
  const lower = text.toLowerCase();
  const financialMatch = FINANCIAL_KEYWORDS.some((kw) => lower.includes(kw));
  const outOfScopeMatch = OUT_OF_SCOPE_KEYWORDS.some((kw) => lower.includes(kw));
  return financialMatch && !outOfScopeMatch;
};

const SYSTEM_PROMPT = `You are BOGA AI, financial analyst for global markets.

EXPERTISE: Stocks, options, technical analysis (EMA, RSI, MACD), commodities, forex, crypto, economics.

IMPORTANT - DO NOT MENTION:
- Claude, Claude AI, Anthropic
- Gemini, Google AI
- Any AI model names or source attribution

GUIDELINES:
1. Answer in user's language (Turkish/English)
2. Be concise, data-driven, professional
3. Use bullet points
4. Provide analysis directly without mentioning data sources or training cutoff dates
5. Be specific about technical levels and indicators

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

// Check if message is instant stock analysis (clear ticker + technical terms)
const isInstantStockAnalysis = (text: string): boolean => {
  const lower = text.toLowerCase();
  // Ticker pattern: 2-5 UPPERCASE letters (strict)
  const hasStockTicker = /\b[A-Z]{2,5}\b/.test(text);
  const hasTechnical = [
    "ema", "rsi", "macd", "technical", "analiz", "analisis",
    "chart", "candlestick", "support", "resistance", "trend",
    "destek", "direnç", "trende", "teknik", "gösterge",
  ].some(kw => lower.includes(kw));

  return hasStockTicker && hasTechnical;
};

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

    if (hasOutOfScope) {
      return handleOutOfScope(message);
    }

    // Only use Claude for instant stock analysis (ticker + technical analysis)
    // This saves credits by defaulting to free Gemini tier
    if (isInstantStockAnalysis(message)) {
      const claudeRes = await handleClaude(message, history);
      if (claudeRes) return claudeRes;
    }

    // Default to Gemini for everything else (cheaper/free)
    return await handleGemini(message, history);
  } catch (e: any) {
    console.error("[ask] error:", e?.message);
    return NextResponse.json({
      text: "Our systems are temporarily unavailable. Please try again.",
    });
  }
}

async function handleClaude(
  message: string,
  history: Message[]
): Promise<NextResponse | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const today = new Date().toISOString().split("T")[0];
  const contextNote = `
TODAY'S CONTEXT (${today}):
- This is current date for market analysis
- Respond as if you have knowledge of current market conditions
- Reference real-time technical levels when applicable
`;

  const claudeSystemPrompt = `You are BOGA AI, expert financial analyst.

Expertise: Global stocks, options, technical analysis (EMA, RSI, MACD), commodities, forex, crypto, economic indicators.

IMPORTANT - DO NOT mention:
- Claude, Claude AI, Anthropic
- Gemini, Google AI
- Any AI model names

Guidelines:
1. Answer in user's language (Turkish/English)
2. Be concise, data-driven, professional
3. Use bullet points for clarity
4. Reference technical indicators and analysis directly
5. Provide current market context

${contextNote}`;

  try {
    const messages = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.text,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-opus-4-1-20250805",
      max_tokens: 1024,
      system: claudeSystemPrompt,
      messages: messages,
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Unable to generate response.";

    return NextResponse.json({
      text,
      source: "claude",
      followUp: [],
    });
  } catch (e: any) {
    console.error("[claude] error:", e?.message);
    return null; // Fallback to Gemini
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
