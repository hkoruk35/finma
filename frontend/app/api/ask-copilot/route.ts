import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRealStockCardData, getSiteCategoryStocksList, getThemeStocksList, SiteListCategory } from "@/lib/copilot/stockData";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { getTradePlanSummary } from "@/lib/copilot/liveAnalysis";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";
import { getMasterData } from "@/lib/data";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;

const ASK_MAX_REQUESTS = 40;
const ASK_WINDOW_MS = 15 * 60 * 1000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ToolInput {
  [key: string]: any;
}

interface ToolResult {
  success: boolean;
  [key: string]: any;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getDynamicSystemPrompt(lang: "tr" | "en" | "pt" = "tr"): string {
  const masterPaths = [
    path.join(process.cwd(), "..", "data", "latest", "master.json"),
    path.join(process.cwd(), "data", "latest", "master.json"),
    path.join(process.cwd(), "..", "..", "data", "latest", "master.json"),
  ];
  let masterJson: any = null;
  for (const p of masterPaths) {
    try {
      if (fs.existsSync(p)) {
        masterJson = JSON.parse(fs.readFileSync(p, "utf-8"));
        break;
      }
    } catch {}
  }

  let dataSummary = "";
  if (masterJson) {
    const regime = masterJson.market_regime || "Neutral";
    const breakout = masterJson.menus?.breakout?.tickers?.slice(0, 10) || [];
    const momentum = masterJson.menus?.momentum?.tickers?.slice(0, 10) || [];
    const reversal = masterJson.menus?.reversal?.tickers?.slice(0, 10) || [];

    dataSummary = `
BUGÜNÜN PİYASA VERİLERİ (Veri Tarihi: ${masterJson.date || "Güncel"}):
- Piyasa Rejimi: ${regime}
- BOGA Kırılım (Breakout) Tercihleri: ${breakout.join(", ")}
- BOGA Momentum Tercihleri: ${momentum.join(", ")}
- BOGA Dönüş (Reversal) Tercihleri: ${reversal.join(", ")}
`;
  }

  const langDirective = lang === "en"
    ? "\nLANGUAGE OVERRIDE: Always respond in English.\n"
    : lang === "pt"
    ? "\nLANGUAGE OVERRIDE: Always respond in Brazilian Portuguese.\n"
    : "\nDİL KURALI: Her zaman Türkçe yanıt ver.\n";

  return `You are BogaSmart, a financial AI assistant for BOGASTOCK.COM.

${langDirective}

${dataSummary}

PRIMARY RULES:
1. Always use available tools to fetch real stock data, technical levels, trade plans, and trending stocks.
2. Never make up ticker symbols or stock data — only use tool results.
3. For stock analysis, ALWAYS call show_stock_card or get_technical_levels first.
4. For trade setup/entry/stop/target questions, ALWAYS call get_trade_plan.
5. For trending stocks or list questions, call get_top_trending_stocks with appropriate category.
6. Respond professionally and concisely in user's language.
7. Provide actionable insights based on real site data.

CRITICAL: You have access to BOGASTOCK's real data via tools. Use them extensively. Never rely on general knowledge for specific stocks or market data.`;
}

async function executeTool(toolName: string, toolInput: ToolInput, locale: string): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "show_stock_card": {
        const ticker = toolInput.ticker as string;
        const card = await withTimeout(getRealStockCardData(ticker, locale), 5000, null);
        if (!card) return { success: false, error: "Stock data not found" };
        return { success: true, ...card };
      }

      case "get_technical_levels": {
        const ticker = toolInput.ticker as string;
        const levels = await withTimeout(getTechnicalLevels(ticker), 5000, null);
        if (!levels) return { success: false, error: "Technical data not found" };
        return { success: true, ...levels };
      }

      case "get_trade_plan": {
        const ticker = toolInput.ticker as string;
        const plan = await withTimeout(getTradePlanSummary(ticker, locale), 6000, null);
        if (!plan) return { success: false, error: "Trade plan not available" };
        return { success: true, ...plan };
      }

      case "get_top_trending_stocks": {
        const category = (toolInput.category || "trend_stocks") as SiteListCategory;
        const res = await withTimeout(
          getSiteCategoryStocksList(category, locale, undefined),
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
      }

      case "get_theme_stocks": {
        const themeSlug = toolInput.themeSlug as string;
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
      }

      case "search_market_news": {
        const query = toolInput.query as string;
        const news = await withTimeout(fetchLiveMarketNews(query, locale), 8000, []);
        return { success: true, query, news: news || [] };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (e) {
    console.error(`[Tool execution error for ${toolName}]:`, e);
    return { success: false, error: `Tool execution failed: ${toolName}` };
  }
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

    locale = ["tr", "en", "pt"].includes(locale) ? locale : "tr";
    const messages: Message[] = [
      ...((history as any[]) || []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : m.text || "",
      })),
      { role: "user", content: message },
    ];

    const systemPrompt = getDynamicSystemPrompt(locale);

    const tools: Anthropic.Tool[] = [
      {
        name: "show_stock_card",
        description: "Fetch current BOGA score, support/resistance/target levels for a stock",
        input_schema: {
          type: "object" as const,
          properties: {
            ticker: {
              type: "string",
              description: "Stock ticker symbol (e.g., 'AAPL')",
            },
          },
          required: ["ticker"],
        },
      },
      {
        name: "get_technical_levels",
        description:
          "Fetch live price, support/resistance, RSI(14), 5-day trends, volume vs average, and Weinstein stage",
        input_schema: {
          type: "object" as const,
          properties: {
            ticker: {
              type: "string",
              description: "Stock ticker symbol",
            },
          },
          required: ["ticker"],
        },
      },
      {
        name: "get_trade_plan",
        description: "Fetch BOGASTOCK's trade plan: entry zone, stop-loss, TP1-3 targets",
        input_schema: {
          type: "object" as const,
          properties: {
            ticker: {
              type: "string",
              description: "Stock ticker symbol",
            },
          },
          required: ["ticker"],
        },
      },
      {
        name: "get_top_trending_stocks",
        description: "Fetch BOGASTOCK's 5 lists: trend_stocks, top_100, top_7, trend_candidate_watchlist, user_watchlist",
        input_schema: {
          type: "object" as const,
          properties: {
            category: {
              type: "string",
              enum: ["trend_stocks", "top_100", "top_7", "trend_candidate_watchlist", "user_watchlist"],
              description: "List category to fetch",
            },
          },
        },
      },
      {
        name: "get_theme_stocks",
        description: "Fetch stocks for a specific BOGASTOCK theme (e.g., 'ai-ve-yapay-zeka', 'bellek-ureticiler')",
        input_schema: {
          type: "object" as const,
          properties: {
            themeSlug: {
              type: "string",
              description: "Theme slug from BOGASTOCK theme pages",
            },
          },
        },
      },
      {
        name: "search_market_news",
        description: "Fetch live market news for a specific ticker or topic",
        input_schema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "Search query (ticker or topic)",
            },
          },
        },
      },
    ];

    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2000,
      system: systemPrompt,
      tools,
      messages: apiMessages,
    });

    let currentMessages: Anthropic.MessageParam[] = [...apiMessages];
    let finalText = "";

    while (response.stop_reason === "tool_use") {
      const assistantMessage: Anthropic.MessageParam = {
        role: "assistant",
        content: response.content,
      };
      currentMessages.push(assistantMessage);

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const toolResult = await executeTool(block.name, block.input as ToolInput, locale);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(toolResult),
          });
        } else if (block.type === "text") {
          finalText = block.text;
        }
      }

      currentMessages.push({
        role: "user",
        content: toolResults,
      });

      response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });
    }

    for (const block of response.content) {
      if (block.type === "text") {
        finalText = block.text;
      }
    }

    return NextResponse.json({
      text: finalText || "Unable to generate response",
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
