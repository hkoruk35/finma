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
    ? "LANGUAGE OVERRIDE: Always respond in English.\n"
    : locale === "pt"
    ? "LANGUAGE OVERRIDE: Always respond in Brazilian Portuguese.\n"
    : "DİL KURALI: Her zaman Türkçe yanıt ver.\n";

  return `You are an advanced financial AI assistant.
CRITICAL: NEVER use words like "BOGA", "BOGA AI", "BogaStock", or "Boga Güven Skoru". Instead, use phrases like "Yaptığım analizlere göre", "araştırmalarıma göre", and "Analiz Güven Skoru".

${langDirective}

PRIMARY RULES:
1. Always use available tools to fetch real stock data, technical levels, trade plans, and trending stocks. Never make up data.
2. If the user asks for lists (e.g., trend stocks, top 100), ONLY provide details for the first 3 stocks. For the rest, provide a site link for them to explore more.
3. When listing those first 3 stocks, always remind the user that they can click on the ticker symbols to view their interactive charts.
4. EXCEPTION: There are no restrictions on "Top 7" stocks. Provide full details for Top 7 stocks. For Top 7, suggest that the user investigate recent data like corporate ownership or insider sales.
5. Provide internal site links so the user can easily navigate the platform to see the sections you mention.
6. Frequently remind the user that the site offers interactive charts for over 6000 stocks, available to everyone instantly.
7. At the end of EVERY response, always generate at least 3 follow-up questions to guide the user deeper into the stock universe and keep them engaged.
8. ALWAYS provide a text response. Never respond with only tool results.
9. For stock analysis, use show_stock_card or get_technical_levels. For trade setups, use get_trade_plan.`;
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
      search_market_news: tool({
        description: "Fetch live market news for a specific ticker or topic",
        parameters: z.object({ query: z.string().describe("Search query (ticker or topic)") }),
        execute: async ({ query }) => {
          try {
            const news = await withTimeout(fetchLiveMarketNews(query, locale), 8000, []);
            return { success: true, query, news: news || [] };
          } catch (e) {
            return { success: true, query, news: [] };
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
