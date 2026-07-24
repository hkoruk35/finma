import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getRealStockCardData, getTopTrendingStocksList } from "@/lib/copilot/stockData";
import { getDeepAnalysis } from "@/lib/copilot/deepAnalysis";
import { getPersonalizationContext, logSearchHistory, getCopilotProfile } from "@/lib/copilot/personalization";
import { getSuggestedName } from "@/lib/copilot/persona";
import { getMasterData } from "@/lib/data";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { isRealTicker } from "@/lib/copilot/tickerValidation";
import { ct } from "@/lib/copilot/i18n";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

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

const DEFAULT_CREDIT_LIMIT = { free: 0, premium: 200 };

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2500): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function buildSystemPrompt(pageContext: any, locale: string, userId: string): Promise<string> {
  const profile = await getCopilotProfile(userId);
  const name = profile.displayName || getSuggestedName(locale);
  const personalization = await getPersonalizationContext(userId);

  let contextStr = `SEN BOGA COPILOT'SUN. Adın "${name}". BOGASTOCK.COM platformunun uzman finansal yapay zeka asistanısın.

DİL KURALI: Kullanıcı mesajında dil değişikliği isterse veya başka bir dilde yazarsa ANINDA o dile geç.

KULLANICI İSTEKLERİNE KESİN ODAKLANMA (NET ÇİZGİLER & SIFIR UYDURMA):
1. KULLANICI "GÜNCEL HİSSELER", "TREND HİSSELER", "GÜNÜN ÖNE ÇIKAN HİSSELERİ", "HİSSE ÖNERİSİ" SORDUĞUNDA:
   - KESİNLİKLE 'search_market_news' HABER ARACINI ÇAĞIRMA! Kullanıcı haber istemedi, hisse istedi!
   - MUTLAKA 'get_top_trending_stocks' aracını çağır!
   - ASLA VE ASLA "Şu anda öne çıkan hisse senedi bulunmamaktadır" DEME! BOGASTOCK üzerinde her zaman yüksek skora veya göreceli güce sahip trend hisseler mevcuttur.
   - 'get_top_trending_stocks' aracından dönen BOGASTOCK hisse kartlarını ve liderleri coşkulu, net bir dille sun.

2. HABERLERİ SADECE VE SADECE KULLANICI AÇIKÇA "HABER", "HABERLER", "SON GELİŞMELER" DEDİĞİNDE ÇAĞIR:
   - Kullanıcı sormadıkça SAKIN haber akışı getirme.
   - Haber istendiğinde: Başlıkları İngilizce ham kart olarak değil, Türkçe olarak 2-3 maddelik net özetler halinde anlat.
   - SADECE BUGÜNÜN (Son 24 saat) haberlerini aktar. Eski haberleri aktarma.

3. SİTE ODAĞI: BOGASTOCK.COM platformunun ABD borsaları (S&P 500, Nasdaq, NYSE) ve terminal sol barındaki varlıklar (Madenler, Forex, Kripto) odaklıdır. BIST veya başka yerel borsa yorumu yapılmaz.

`;

  if (pageContext) {
    if (pageContext.type === "ticker") {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${pageContext.value} hissesinin grafik/analiz sayfasındadır. "Analiz et" gibi belirsiz bir istek gelirse ${pageContext.value} için show_stock_card aracını çağır.\n\n`;
    } else if (pageContext.page) {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda "${pageContext.page}" sayfasındadır.\n\n`;
    }
  }

  if (personalization.topSectors.length > 0) {
    contextStr += `KULLANICI İLGİ ALANI: En çok ilgilendiği sektörler: ${personalization.topSectors.join(", ")}.\n`;
  }
  if (personalization.watchlistTickers.length > 0) {
    contextStr += `KULLANICININ İZLEME LİSTESİ: ${personalization.watchlistTickers.join(", ")}\n`;
  }
  contextStr += "\n";

  try {
    const master = await getMasterData();
    if (master && !master.is_mock) {
      contextStr += `GÜNCEL PİYASA GÖRÜNÜMÜ (${master.date || ""}): Piyasa Rejimi: ${master.market_regime || "N/A"}\n`;
      const sectors = Object.entries(master.sector_summary || {})
        .sort((a, b) => (b[1]?.avg_score ?? 0) - (a[1]?.avg_score ?? 0))
        .slice(0, 8)
        .map(([n, s]: [string, any]) => `- ${n}: Ort. Skor ${s.avg_score}, Lider Ticker: ${s.top_ticker || "N/A"}`)
        .join("\n");
      if (sectors) contextStr += `SEKTÖR ÖZETİ:\n${sectors}\n\n`;
    }
  } catch {}

  contextStr += `KURALLAR:
1. Kısa (concise) cevaplar ver. Uzun paragraflar yazma. Maddeler kullan.
2. Bir hisse sorulduğunda MUTLAKA 'show_stock_card' veya 'get_deep_analysis' aracını çağır.
3. Öne çıkan / güncel hisseler sorulduğunda MUTLAKA 'get_top_trending_stocks' aracını çağır.
4. Yanıtının sonuna tıklanabilir [Buton Metni](copilot-topic://select) ekle.`;

  return contextStr;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, pageContext, locale: rawLocale } = body;
    const locale = resolveLocale(rawLocale);

    const supabaseAuth = await createSupabaseServerClient();
    const { data: userData } = await supabaseAuth.auth.getUser();
    const user = userData.user;
    if (!user) return new Response("Unauthorized", { status: 401 });

    const dailyLimit = DEFAULT_CREDIT_LIMIT.premium;

    const { data: statusRows, error: statusErr } = await supabaseAdmin.rpc("get_copilot_credit_status", {
      p_user_id: user.id,
      p_default_limit: dailyLimit,
    });
    if (statusErr) {
      return new Response("Service Unavailable", { status: 503 });
    }
    const status = Array.isArray(statusRows) ? statusRows[0] : statusRows;

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUserMessage?.content) {
      const tickerFromContext = pageContext?.type === "ticker" ? pageContext.value : null;
      logSearchHistory(user.id, String(lastUserMessage.content), tickerFromContext).catch(() => {});
    }

    const systemPrompt = await buildSystemPrompt(pageContext, locale, user.id);

    const result = await streamText({
      model: googleProvider("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      tools: {
        get_top_trending_stocks: tool({
          description: "Fetches BOGASTOCK.COM top trending US stocks and stock cards. Call this when the user asks for 'güncel hisseler', 'trend hisseler', 'günün öne çıkan hisseleri'. DO NOT CALL search_market_news!",
          parameters: z.object({ category: z.string().optional() }),
          execute: async () => {
            const [master, cards] = await Promise.all([
              getMasterData(),
              withTimeout(getTopTrendingStocksList(locale), 2500),
            ]);
            return {
              success: true,
              regime: master?.market_regime || "BULLISH_BIAS",
              stocks: cards || [],
            };
          },
        }),
        search_market_news: tool({
          description: "Fetches live breaking market news ONLY when the user explicitly requests news. NEVER call this when the user asks for stock tickers or trending stocks.",
          parameters: z.object({ query: z.string().describe("Topic or ticker to search market news for") }),
          execute: async ({ query }) => {
            const news = await withTimeout(fetchLiveMarketNews(query, locale), 2000);
            return { success: true, query, news: news || [] };
          },
        }),
        navigate_to: tool({
          description: "Use when the user wants to open/navigate to a specific stock's chart or detail page.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const t = ticker.trim().toUpperCase();
            const isFormatValid = t.length <= 5 && /^[A-Z]+$/.test(t);
            if (!isFormatValid) return { success: false, error: ct("invalidTicker", locale) };
            const real = await withTimeout(isRealTicker(t), 2000);
            if (!real) return { success: false, error: ct("tickerNotFound", locale) };
            return { success: true, ticker: t };
          },
        }),
        show_stock_card: tool({
          description: "Call this whenever the user asks about a specific stock ticker to show its current BOGA score, support/resistance/target levels as a card.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const card = await withTimeout(getRealStockCardData(ticker, locale), 2500);
            if (!card) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...card };
          },
        }),
        get_deep_analysis: tool({
          description: "Fetches a stock's fundamentals, insider buy/sell activity, sector context, recent news, and BOGA's historical trade performance.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const deep = await withTimeout(getDeepAnalysis(ticker, locale), 2500);
            if (!deep) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...deep };
          },
        }),
        get_technical_levels: tool({
          description: "Fetches live price, support/resistance, RSI(14), 5-day trends, volume vs average percentage, and Weinstein stage.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const levels = await withTimeout(getTechnicalLevels(ticker), 2500);
            if (!levels) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...levels };
          },
        }),
      },
      maxSteps: 2,
      async onFinish({ text, toolCalls, toolResults }) {
        try {
          await supabaseAdmin.rpc("increment_copilot_credit", { p_user_id: user.id });
        } catch {}
        try {
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: text,
            toolInvocations: (toolCalls || []).map((tc: any) => ({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
              state: "result" as const,
              result: (toolResults || []).find((tr: any) => tr.toolCallId === tc.toolCallId)?.result,
            })),
          };
          const fullTranscript = [...messages, assistantMessage];
          await supabaseAdmin.from("copilot_chats").upsert(
            { user_id: user.id, chat_state: fullTranscript, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
        } catch {}
      },
    });

    return result.toDataStreamResponse();
  } catch (err: any) {
    console.error("Copilot POST Exception:", err);
    return NextResponse.json(
      {
        error: "Piyasa mutfağında kısa bir düzenleme yapıyorum. Lütfen sorunuzu bir kez daha iletin.",
        code: "GRACEFUL_RECOVERY",
      },
      { status: 500 }
    );
  }
}
