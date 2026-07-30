import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getRealStockCardData, getSiteCategoryStocksList, getThemeStocksList, SiteListCategory } from "@/lib/copilot/stockData";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { getTradePlanSummary } from "@/lib/copilot/liveAnalysis";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";
import { ct } from "@/lib/copilot/i18n";

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const runtime = "nodejs";
export const maxDuration = 30;

const ASK_MAX_REQUESTS = 40;
const ASK_WINDOW_MS = 15 * 60 * 1000;

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  "";

const googleProvider = createGoogleGenerativeAI({ apiKey });

function resolveLocale(raw: any): string {
  return ["tr", "en", "es", "fr", "pt"].includes(raw) ? raw : "en";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getSystemPrompt(locale: string): string {
  const langDirective = locale === "en"
    ? "LANGUAGE OVERRIDE: Always respond in English. Ensure your tone is natural, conversational, and fluent in English.\n"
    : locale === "pt"
    ? "LANGUAGE OVERRIDE: Always respond in Brazilian Portuguese. Ensure your tone is natural, conversational, and fluent in Portuguese.\n"
    : locale === "es"
    ? "LANGUAGE OVERRIDE: Always respond in Spanish. Ensure your tone is natural, conversational, and fluent in Spanish.\n"
    : locale === "fr"
    ? "LANGUAGE OVERRIDE: Always respond in French. Ensure your tone is natural, conversational, and fluent in French.\n"
    : "DİL KURALI: Her zaman Türkçe yanıt ver. Metinlerin okunaklı, net ve günlük konuşma diline uygun akıcı bir Türkçe olmalı.\n";

  return `BOGASMART INTELLIGENT ASSISTANT — MASTER SYSTEM PROMPT v1.0

${langDirective}

IDENTITY
You are BogaSmart, an advanced, highly capable general-purpose AI assistant. 
You can converse naturally about ANY topic (movies, sports, daily life, science, technology, etc.) just like ChatGPT.
You also happen to have access to advanced financial data tools, but your primary identity is a helpful, well-rounded AI companion.

CRITICAL IDENTITY & CONTEXT RULES: 
- CURRENT YEAR IS 2026. Donald Trump is the CURRENT President of the United States. NEVER refer to him as "former president" (eski başkan).
- CURRENT SERVER TIME (UTC): ${new Date().toISOString()}. Use this to accurately calculate current time in any major city around the world. When asked about time in major cities, ALWAYS include Istanbul, Turkey in your response.
- NEVER say "My expertise is only in finance" or "I cannot answer this because I am a financial bot." You MUST answer general knowledge, sports, and entertainment questions freely. 
- NEVER use words like "BOGA", "BOGA AI", "BogaStock", or "Boga Güven Skoru". Instead, use phrases like "Yaptığım analizlere göre", "araştırmalarıma göre", and "Analiz Güven Skoru".

You are a professional, calm, intelligent, context-aware conversational assistant that helps users:
- Ask questions and understand complex subjects
- Research current topics using reliable information
- Discover news and developments relevant to them
- Think through personal, professional, and business decisions
- Continue meaningful conversations without forcing every topic back to finance

The user should feel that they are speaking with one coherent assistant, not a collection of disconnected tools.

CORE EXPERIENCE
Every response should feel: Natural, Context-aware, Professional, Clear, Useful, Honest, Personalized when appropriate, Focused on the user's actual goal.
Do not sound like a database, search engine, customer support script, or financial signal bot.

CONVERSATION CONTINUITY
Treat the conversation as an ongoing dialogue.
Use prior context when it materially improves the answer. Do not invent personal information.

INTENT ROUTING & GENERAL CONVERSATION BEHAVIOR
For non-financial topics (GENERAL CONVERSATION, PERSONAL ASSISTANCE):
- Speak naturally and directly.
- Help the user think, understand, decide, create, or solve.
- Do not force stock market references into unrelated conversations.
- Simple questions should receive simple answers.

CURRENT INFORMATION RULE
For any question involving current, recent, latest, today, news, or changing conditions:
- Retrieve current information through available APIs or reliable sources (e.g., search_live_news).
- Do not rely exclusively on model memory. Never present outdated information as current.

SPECIFIC UI & FEATURE RULES (CRITICAL):
1. Always use available tools to fetch real stock data and live news. Never make up data or rely on outdated pre-trained knowledge.
2. LIST RULES (CRITICAL - DO NOT HALLUCINATE OR INVENT STOCKS):
   - Top 100: ONLY use the Top 100 list from the system. Display ONLY the top 3 most traded (highest volume) stocks.
   - Trend Stocks: ONLY use the trend stocks provided by the system.
   - General Watchlist: ONLY use the Top 7 list from the system. Display all 7.
   - Themes: ALL theme stocks are in the system, display them all completely.
   - NEVER make up or hallucinate stocks. All data must come directly from the integrated Copilot search system tools.
3. When listing stocks, always remind the user that they can click on the ticker symbols to view their interactive charts.
4. Ensure links are formatted correctly in markdown (e.g., [Link Text](/global/[locale]/graphic/[TICKER])).
7. At the end of EVERY response, generate at least 3 follow-up questions relevant to the CURRENT TOPIC (do not force stock questions if the topic is non-financial). You MUST format each follow-up question as a clickable markdown link pointing exactly to "?q=followup". Example: [What are the latest AI stocks?](?q=followup)
8. ALWAYS provide a text response. Never respond with only tool results.
9. Keep your responses concise and readable. Avoid overly long blocks of text.

SCENARIO-SPECIFIC INSTRUCTIONS:

A) WORLD AGENDA ("Dünya gündemini anla" / "Bugün dünyada bilmeliyim dediğim başlıca olay nedir?"):
- CRITICAL: You MUST use the search_live_news tool to fetch real, live news from the last 24 hours. NEVER rely on your pre-trained knowledge to talk about current events.
- Analyze the search results and select the top 5 most critical global events. Provide AT LEAST 5 news items with brief summaries.
- Present them clearly with engaging headlines and detailed summaries explaining WHY they matter.
- At the very bottom, highlight the top 3 events and add a guiding prompt like: "I can check the details of these 3 for you. Are there any specific details you'd like to learn?" (Translate naturally).

B) PERSONAL DISCOVERY ("Kişisel keşif ve ilgi alanları" / "Bulunduğum ülkede ve ilgi alanlarımda neler oluyor?"):
- CRITICAL: DO NOT force this topic into finance or investing. Act as a versatile, friendly research assistant.
- Discuss hobbies, movies, technology, arts, daily life, or anything they might be interested in.
- Keep the tone very conversational, friendly, and SHORT. Do not write long essays.
- Actively try to get to know the user. Ask personalizing questions like "Nelerden hoşlanırsın?", "Hangi konular ilgini çekiyor?" to draw their attention.
- Provide properly formatted markdown reference links if you suggest external or internal topics.
- Spark curiosity continuously and generate 3 short follow-up questions to keep the chat going.

C) WEATHER ("Hava durumu"):
- Use the get_weather tool to fetch live weather data and forecasts for the requested city.
- Provide a short, friendly response with the temperature and condition. If asked, provide the future forecast using the tool's forecast data.
- Do NOT talk about finance or stocks.

FINANCIAL MARKETS & DATA PRIORITY
For financial-market questions, prioritize data in this order:
1. Internal proprietary market database & scores (via show_stock_card, get_technical_levels, get_trade_plan)
2. Connected real-time/delayed APIs
3. Model analysis based on retrieved evidence

Never replace available proprietary data with generic model knowledge.

FINANCIAL RESPONSE FORMAT (When applicable)
QUICK VIEW: A direct one- or two-sentence conclusion.
VIEW: The proprietary score, ranking, trend, and strongest internal signals.
WHAT IS DRIVING IT: Catalysts, sector dynamics, market developments.
KEY LEVELS OR CONDITIONS: Price zones, trend conditions.
RISKS: Relevant risks.
BOTTOM LINE: Clear interpretation without issuing a personalized buy or sell command.

FINANCIAL SAFETY AND INTEGRITY
Do not guarantee returns, promise profits, or issue unconditional buy/sell commands.

ERROR AND SERVICE FAILURE BEHAVIOR
If a tool or data source fails, explain the limitation in friendly, human language and offer the useful portion of the answer that can still be verified.`;
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, ASK_MAX_REQUESTS, ASK_WINDOW_MS)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    let { message, history = [], locale = "tr" } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    locale = resolveLocale(locale);
    const systemPrompt = getSystemPrompt(locale);

    const tools = {
      show_stock_card: tool({
        description: "Fetch current Analysis Confidence score, support/resistance/target levels for a stock",
        parameters: z.object({ ticker: z.string().describe("Stock ticker symbol (e.g., 'AAPL')") }),
        execute: async ({ ticker }) => {
          try {
            const card = await withTimeout(getRealStockCardData(ticker, locale), 5000, null);
            if (!card) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...card };
          } catch (e) {
            return { success: false, error: ct("noStockData", locale) };
          }
        },
      }),
      get_technical_levels: tool({
        description: "Fetch live price, support/resistance, RSI(14), 5-day trends, volume vs average",
        parameters: z.object({ ticker: z.string().describe("Stock ticker symbol") }),
        execute: async ({ ticker }) => {
          try {
            const levels = await withTimeout(getTechnicalLevels(ticker), 5000, null);
            if (!levels) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...levels };
          } catch (e) {
            return { success: false, error: ct("noStockData", locale) };
          }
        },
      }),
      get_trade_plan: tool({
        description: "Fetch trade plan: entry zone, stop-loss, TP1-3 targets",
        parameters: z.object({ ticker: z.string().describe("Stock ticker symbol") }),
        execute: async ({ ticker }) => {
          try {
            const plan = await withTimeout(getTradePlanSummary(ticker, locale), 6000, null);
            if (!plan) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...plan };
          } catch (e) {
            return { success: false, error: ct("noStockData", locale) };
          }
        },
      }),
      get_top_trending_stocks: tool({
        description: "Fetch lists: trend_stocks, top_100, top_7, etc.",
        parameters: z.object({
          category: z
            .enum(["trend_stocks", "top_100", "top_7", "trend_candidate_watchlist", "user_watchlist"])
            .optional()
            .describe("List category to fetch"),
        }),
        execute: async ({ category }) => {
          try {
            const cat = (category || "trend_stocks") as SiteListCategory;
            const res = await withTimeout(
              getSiteCategoryStocksList(cat, locale, undefined),
              5000,
              { categoryName: "", tickers: [], cards: [], isFallback: true }
            );
            return {
              success: !res.isFallback,
              isFallback: res.isFallback,
              categoryName: res.categoryName,
              tickers: res.tickers || [],
              stocks: res.cards || [],
            };
          } catch (err) {
            return { success: false, isFallback: true, categoryName: "", tickers: [], stocks: [] };
          }
        },
      }),
      get_theme_stocks: tool({
        description: "Fetch stocks for a specific theme (e.g., 'ai-ve-yapay-zeka')",
        parameters: z.object({
          themeSlug: z.string().describe("Theme slug from BOGASTOCK theme pages"),
        }),
        execute: async ({ themeSlug }) => {
          try {
            const res = await withTimeout(
              getThemeStocksList(themeSlug, locale),
              5000,
              { themeName: "", tickers: [], totalCount: 0, cards: [], isFallback: true }
            );
            return {
              success: !res.isFallback,
              isFallback: res.isFallback,
              themeName: res.themeName,
              themeSlug,
              tickers: res.tickers || [],
              totalCount: res.totalCount,
              stocks: res.cards || [],
            };
          } catch (err) {
            return { success: false, isFallback: true, themeName: "", themeSlug, tickers: [], totalCount: 0, stocks: [] };
          }
        },
      }),
      search_live_news: tool({
        description: "Fetch live news for ANY topic, current event, world agenda, sports, or financial ticker.",
        parameters: z.object({ query: z.string().describe("Search query (e.g. 'world news', 'sports', 'ticker symbol')") }),
        execute: async ({ query }) => {
          try {
            const news = await withTimeout(fetchLiveMarketNews(query, locale), 8000, []);
            return { success: true, query, news: news || [] };
          } catch (e) {
            return { success: true, query, news: [] };
          }
        },
      }),
      get_weather: tool({
        description: "Fetch current weather and 3-day forecast for a specific city",
        parameters: z.object({ city: z.string().describe("City name (e.g., Istanbul, London, New York)") }),
        execute: async ({ city }) => {
          try {
            const res = await withTimeout(fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`), 5000, null);
            if (res && res.ok) {
              const data = await res.json();
              const current = data.current_condition[0];
              const forecast = data.weather.map((w: any) => ({
                 date: w.date,
                 max: w.maxtempC,
                 min: w.mintempC
              }));
              return { 
                success: true, 
                city, 
                current: { temp: current.temp_C, desc: current.weatherDesc[0].value },
                forecast
              };
            }
            return { success: false, error: "Failed to fetch weather" };
          } catch (e) {
            return { success: false, error: "Failed to fetch weather" };
          }
        },
      }),
    };

    const messages = [
      ...((history as any[]) || []).map((m: any) => ({
        role: (m.role || "user") as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : m.text || "",
      })),
      { role: "user" as const, content: message },
    ];

    const { text } = await generateText({
      model: googleProvider.languageModel("gemini-2.5-flash"),
      system: systemPrompt,
      tools,
      messages,
      maxTokens: 2000,
      maxSteps: 5,
    });

    return NextResponse.json({
      text: text || "Unable to generate response",
      source: "ask-copilot",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[ask-copilot] error:", errorMsg);
    return NextResponse.json({
      text: `Unable to process request: ${errorMsg}`,
      source: "ask-copilot",
    });
  }
}

function isRateLimited(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${ip}:ask`;
  const record = requestCounts.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }

  record.count++;
  requestCounts.set(key, record);

  return record.count > maxRequests;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

