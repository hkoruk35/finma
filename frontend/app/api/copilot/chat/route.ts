import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getRealStockCardData } from "@/lib/copilot/stockData";
import { getDeepAnalysis } from "@/lib/copilot/deepAnalysis";
import { getPersonalizationContext, logSearchHistory, getCopilotProfile } from "@/lib/copilot/personalization";
import { getSuggestedName } from "@/lib/copilot/persona";
import { getMasterData } from "@/lib/data";
import { getPerformanceSummaryForPrompt } from "@/lib/copilot/performanceInsights";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { isRealTicker } from "@/lib/copilot/tickerValidation";
import { ct } from "@/lib/copilot/i18n";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";

export const maxDuration = 30;

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

const LANG_NAME_MAP: Record<string, string> = {
  tr: "Türkçe",
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
};

const DEFAULT_CREDIT_LIMIT = { free: 0, premium: 200 };

async function buildSystemPrompt(pageContext: any, locale: string, userId: string): Promise<string> {
  const langName = LANG_NAME_MAP[locale] || "English";
  const profile = await getCopilotProfile(userId);
  const name = profile.displayName || getSuggestedName(locale);
  const personalization = await getPersonalizationContext(userId);

  let contextStr = `SEN BOGA COPILOT'SUN. Adın "${name}". Kullanıcıya kendini bu isimle tanıt.

DİL KURALI (KESİN & ESNEK): Kullanıcı mesajında "english", "türkçe", "español", "français", "português" yazarak dil değişikliği isterse veya başka bir dilde yazarsa ANINDA ve pürüzsüz biçimde o dile geç.

BOGA COPILOT GRACEFUL RECOVERY RULES (HATA KART SİZLİĞİ VE BOGA KİŞİLİĞİ):
1. KULLANICIYA ASLA TEKNİK HATA/API/SERVER METİNLERİ GÖSTERME (API, provider, server, database, timeout, worker, cron, rate limit, exception, HTTP status KELİMELERİNİ KULLANMAK YASAKTIR).
2. Veri veya arama aşamasında bir gecikme olursa doğal piyasa analiz cümleleri kullan:
   - "Piyasanın nabzını ölçüyorum..."
   - "Vadeli işlemleri ve haber akışını karşılaştırıyorum..."
   - "Piyasa gürültüsünü ayıklıyorum..."
   - "Piyasa mutfağında birkaç rakam birbirine karıştı. Sana eksik bir analiz sunmak yerine tabloyı yeniden düzenliyorum."
3. ASLA "anlık haber akışını doğrudan sağlayamıyorum" veya "canlı haberim yok" DEME. Haber veya piyasa gelişmesi sorulduğunda MUTLAKA 'search_market_news' veya 'get_deep_analysis' aracını çağır.

SMART TASK & PRESENTATION RULES:
1. Kelime Sınırı Standardı:
   - Ani haber bildirimi: 40–90 kelime
   - Normal mini sunum: 80–180 kelime
   - Bilanço özeti: 120–220 kelime
   - Detay talebi: Sınırsız, bölümlü sunum
2. Gerçekleşen veri (Fact) ile BOGA Copilot Değerlendirmesini net bir şekilde ayır.
3. Bir önceki rapordaki bilgileri gereksiz yere tekrarlama; sadece değişen noktaları aktar. Değişim yoksa: "Bir önceki güncellemeden bu yana kayda değer bir değişim yaşanmadı." de.

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
  if (personalization.recentQueries.length > 0) {
    contextStr += `SON ARAMALARI: ${personalization.recentQueries.slice(0, 5).join(" | ")}\n`;
  }
  contextStr += "\n";

  try {
    const master = await getMasterData();
    if (master && !master.is_mock) {
      contextStr += `GÜNCEL PİYASA GÖRÜNÜMÜ (${master.date || ""}): Piyasa Rejimi: ${master.market_regime || "N/A"}\n`;
      const sectors = Object.entries(master.sector_summary || {})
        .sort((a, b) => (b[1]?.avg_score ?? 0) - (a[1]?.avg_score ?? 0))
        .slice(0, 8)
        .map(([n, s]: [string, any]) => `- ${n}: Ort. Skor ${s.avg_score}, Lider: ${s.top_ticker || "N/A"}`)
        .join("\n");
      if (sectors) contextStr += `SEKTÖR ÖZETİ:\n${sectors}\n\n`;
    }
  } catch {}

  contextStr += `KURALLAR:
1. Kısa (concise) cevaplar ver. Uzun paragraflar yazma. Maddeler kullan.
2. Bir hisse sorulduğunda MUTLAKA 'show_stock_card' veya 'get_deep_analysis' aracını çağır.
3. Günün haberleri, piyasa gelişmeleri veya sektör haberleri sorulduğunda MUTLAKA 'search_market_news' aracını çağır.
4. Haberler ve analiz sonuçlarında tıklanabilir yönlendirme butonları sunmak için yanıtının sonuna [Buton Metni](copilot-topic://select) ekle.`;

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
        search_market_news: tool({
          description: "Fetches live breaking market news, headlines, Reuters/Yahoo Finance/Google News RSS feed items for a topic, ticker, or general market updates (e.g. 'günün önemli gelişmelerini', 'latest stock market news', 'NVDA haberleri'). Call this whenever the user asks for news or market developments.",
          parameters: z.object({ query: z.string().describe("Topic or ticker to search market news for") }),
          execute: async ({ query }) => {
            const news = await fetchLiveMarketNews(query, locale);
            return { success: true, query, news };
          },
        }),
        navigate_to: tool({
          description: "Use when the user wants to open/navigate to a specific stock's chart or detail page.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const t = ticker.trim().toUpperCase();
            const isFormatValid = t.length <= 5 && /^[A-Z]+$/.test(t);
            if (!isFormatValid) return { success: false, error: ct("invalidTicker", locale) };
            const real = await isRealTicker(t);
            if (!real) return { success: false, error: ct("tickerNotFound", locale) };
            return { success: true, ticker: t };
          },
        }),
        show_stock_card: tool({
          description: "Call this whenever the user asks about a specific stock ticker to show its current BOGA score, support/resistance/target levels as a card.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const card = await getRealStockCardData(ticker, locale);
            if (!card) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...card };
          },
        }),
        get_deep_analysis: tool({
          description: "Fetches a stock's fundamentals, insider buy/sell activity, sector context, recent news, and BOGA's historical trade performance.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const deep = await getDeepAnalysis(ticker, locale);
            if (!deep) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...deep };
          },
        }),
        get_technical_levels: tool({
          description: "Fetches live price, support/resistance, RSI(14), 5-day trends, volume vs average percentage, and Weinstein stage.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const levels = await getTechnicalLevels(ticker);
            if (!levels) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...levels };
          },
        }),
      },
      maxSteps: 4,
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
    // BOGA Graceful Recovery Error Response — NEVER show raw JSON error to user!
    return NextResponse.json(
      {
        error: "Piyasa mutfağında kısa bir düzenleme yapıyorum. Lütfen sorunuzu bir kez daha iletin.",
        code: "GRACEFUL_RECOVERY",
      },
      { status: 500 }
    );
  }
}
