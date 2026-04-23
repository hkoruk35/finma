import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FINANCIAL_KEYWORDS = [
  "stock", "price", "market", "nasdaq", "nyse", "dow", "s&p", "vix", "spy", "ema",
  "rsi", "macd", "swing", "trade", "option", "call", "put", "gold", "oil", "forex",
  "crypto", "bitcoin", "ethereum", "bond", "yield", "dividend", "earnings", "pe ratio",
  "ipo", "etf", "sector", "momentum", "breakout", "resistance", "support", "bollinger",
  "stochastic", "adx", "atr", "volume", "open interest", "implied volatility", "delta",
  "gamma", "theta", "vega", "hisse", "borsa", "endeks", "altın", "petrol", "dolar",
  "euro", "para", "ekonomi", "enflasyon", "faiz", "merkez bankası", "fed", "ecb",
  "turkey", "türkiye", "bist", "xauusd", "wti", "brent", "nasdaq100", "russell2000",
  "hang seng", "nikkei", "dax", "ftse", "cac", "stoxx", "nikkei", "shanghai", "shenzhen",
  "sensex", "kospi", "asx", "nzx", "omx", "pse", "klse", "set", "sse", "szse",
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

const getDateContext = () => {
  const now = new Date();
  return {
    date: now.toISOString().split("T")[0],
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()],
    time: now.toTimeString().split(" ")[0],
  };
};

const CLAUDE_SYSTEM_PROMPT = `You are BOGA AI, a professional financial analysis assistant.

EXPERTISE AREAS:
- US & Global equity markets (stocks, indices, ETFs)
- Technical analysis (EMA, RSI, MACD, Bollinger Bands, etc.)
- Options trading & strategies
- Commodities (gold, oil, metals)
- Forex & cryptocurrencies
- Economic indicators & central bank policies
- Swing trading & momentum strategies
- Risk/reward analysis

RESPONSE GUIDELINES:
1. Answer in the user's language (Turkish or English)
2. Be concise and data-driven
3. Use bullet points for clarity
4. Always cite your sources at the end of responses:
   - "Source: BOGA AI proprietary analysis" for our daily picks
   - "Source: Technical analysis (training data cutoff: April 2025)" for general analysis
   - Be explicit about data freshness
5. When you don't have current data, say clearly: "As of my last update (April 2025)..."
6. Never hallucinate stock prices or data - if unsure, say so

CURRENT MARKET CONTEXT:
Date: {date} ({day})
Time: {time} UTC

If asked about today's performance, use available BOGA data if within scope.

For commodities and global markets: Provide analysis based on your training knowledge, always noting the data cutoff.`;

const GEMINI_SYSTEM_PROMPT = `You are BOGA AI assistant for general knowledge questions.

For financial/market questions: Politely redirect the user.
For other questions: Provide helpful, accurate information.

When redirecting financial questions, say (in user's language):
- Turkish: "Üzgünüm, bu soru finans/piyasa konusu. BOGA AI, finansal piyasalar, hisse senetleri ve kripto konularında uzmanlaşmıştır. Lütfen finansal sorularınız için AI sorgu sistemi kullanınız."
- English: "I appreciate the question, but this is outside my financial expertise. BOGA AI specializes in stock markets, technical analysis, and crypto. Please use the AI query system for financial questions."`;

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface AskResponse {
  text: string;
  source: "claude" | "gemini";
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

  const dateCtx = getDateContext();
  const isFinancial = isFinancialQuestion(message);

  try {
    if (isFinancial) {
      // Use Claude for financial questions
      return await handleClaude(message, history, dateCtx);
    } else {
      // Check if it's out of scope and redirect if needed
      const hasOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) =>
        message.toLowerCase().includes(kw)
      );
      if (hasOutOfScope) {
        return handleOutOfScope(message);
      }
      // Use Gemini for general knowledge
      return await handleGemini(message, history);
    }
  } catch (e: any) {
    console.error("[ask] error:", e?.message);
    return NextResponse.json({
      text: "Our systems are temporarily unavailable. Please try again.",
    });
  }
}

async function handleClaude(
  message: string,
  history: Message[],
  dateCtx: any
): Promise<NextResponse> {
  const systemPrompt = CLAUDE_SYSTEM_PROMPT.replace(
    "{date}",
    dateCtx.date
  )
    .replace("{day}", dateCtx.day)
    .replace("{time}", dateCtx.time);

  const messages: Array<{role: "user" | "assistant", content: string}> = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    })),
    { role: "user" as const, content: message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Unable to generate response.";

    // Generate follow-up suggestions
    const followUp = await generateFollowUp(message, text);

    return NextResponse.json({
      text,
      source: "claude",
      followUp,
    });
  } catch (e: any) {
    console.error("[claude] error:", e?.status, e?.error?.error?.message || e?.message);
    return NextResponse.json({
      text: "Our financial analysis system is temporarily unavailable. Please try again.",
    });
  }
}

async function handleGemini(
  message: string,
  history: Message[]
): Promise<NextResponse> {
  // Gemini fallback - using REST API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      text: "General knowledge system temporarily unavailable.",
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
          systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      console.error(`[gemini] HTTP ${res.status}`);
      return NextResponse.json({
        text: "General knowledge system temporarily unavailable.",
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
      text: "General knowledge system temporarily unavailable.",
    });
  }
}

function handleOutOfScope(message: string): NextResponse {
  const isEnglish = /^[a-z\s]+$/i.test(message.split(" ")[0]);

  const response = isEnglish
    ? `I appreciate the question, but that's outside BOGA AI's focus. I specialize in:\n\n• Stock markets & technical analysis\n• Options trading & strategies\n• Commodities (gold, oil, metals)\n• Forex & cryptocurrencies\n• Economic indicators\n\nFeel free to ask about financial markets and trading strategies!`
    : `Bu soru BOGA AI'ın uzmanlık alanı dışında. Ben şu alanlarda uzmanlaşmışım:\n\n• Hisse senedi piyasaları ve teknik analiz\n• Opsiyon ticareti ve stratejiler\n• Emtialar (altın, petrol, metaller)\n• Forex ve kripto para\n• Ekonomik göstergeler\n\nLütfen finansal piyasa ve ticaret stratejileri hakkında soru sorun!`;

  return NextResponse.json({ text: response, source: "claude", followUp: [] });
}

async function generateFollowUp(
  originalQuestion: string,
  response: string
): Promise<string[]> {
  try {
    const suggestion = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      system:
        "Generate 3 concise, related follow-up questions based on the original question and response. Return as JSON array: [\"Q1\", \"Q2\", \"Q3\"]. Keep questions under 15 words.",
      messages: [
        {
          role: "user",
          content: `Original Q: ${originalQuestion}\n\nResponse excerpt: ${response.slice(0, 300)}\n\nGenerate 3 follow-up questions in JSON array format.`,
        },
      ],
    });

    const text =
      suggestion.content[0].type === "text" ? suggestion.content[0].text : "[]";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}
