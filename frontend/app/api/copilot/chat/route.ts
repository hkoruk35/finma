import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getRealStockCardData, getSiteCategoryStocksList } from "@/lib/copilot/stockData";
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

// 3-second timeout wrapper for any async call
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function buildSystemPrompt(pageContext: any, locale: string, userId: string): Promise<string> {
  // Each of these calls gets a 2-second timeout — if any hangs, we skip it
  const profile = await withTimeout(getCopilotProfile(userId), 2000, { displayName: "", avatarId: "aylin" } as any);
  const name = profile.displayName || getSuggestedName(locale);
  const personalization = await withTimeout(
    getPersonalizationContext(userId),
    2000,
    { topSectors: [], watchlistTickers: [], recentQueries: [] }
  );

  let contextStr = `SEN BOGA COPILOT'SUN. Adın "${name}". BOGASTOCK.COM platformunun kibar, profesyonel ve samimi yapay zeka asistanısın.

TON VE KİBARLIK KURALI:
- KESİNLİKLE "masasına hoş geldiniz" veya soğuk robotik ifadeler KULLANMA.
- Her zaman son derece kibar, nazik ve anlaşılır bir dille yanıt ver.

TIKLANABİLİR BUTON ZORUNLULUĞU:
- HER YANITININ SONUNA KULLANICININ TIKLAYABİLECEĞİ TIKLANABİLİR YÖNLENDİRME BUTONLARI EKLE!
- Format: [Buton Metni](copilot-topic://select)
  Örnekler:
  [⭐ İzleme Listem](copilot-topic://select)
  [📈 Trend Hisseleri](copilot-topic://select)
  [🤖 BOGA AI Watchlist](copilot-topic://select)
  [🏆 Top7](copilot-topic://select)
  [🏆 Top100](copilot-topic://select)

SİTE DANIŞMA MİMARİSİ VE KATEGORİ UYUMU (KESİN KURAL):
1. BOGA COPILOT'UN EN TEMEL HEDEFİ BOGASTOCK.COM SİTESİNDEKİ CANLI PANELLER VEYA LİSTELER ÜZERİNDEN YOLA ÇIKMAKTIR.
2. KULLANICI "TREND HİSSELERİ", "İZLEME LİSTEM", "BOGA AI WATCHLIST", "TOP 7", "TOP 100" DEDİĞİNDE VEYA SORDUĞUNDA:
   - KESİNLİKLE VE ASLA 'search_market_news' HABER ARACINI ÇAĞIRMA!
   - MUTLAKA 'get_top_trending_stocks' ARACINI İLGİLİ KATEGORİ İLE ÇAĞIR!
   - ASLA "Şu anda öne çıkan hisse senedi bulunmamaktadır" VEYA HATA MESAJI VERME.

3. HABERLERİ SADECE VE SADECE KULLANICI AÇIKÇA "HABER", "HABERLER", "SON GELİŞMELER" DEDİĞİNDE ÇAĞIR:
   - Kullanıcı sormadıkça SAKIN haber akışı getirme.
   - Haber istendiğinde: Başlıkları İngilizce ham kart olarak değil, Türkçe olarak 2-3 maddelik net özetler halinde anlat.
   - SADECE BUGÜNÜN (Son 24 saat) haberlerini aktar. Eski haberleri aktarma.

4. SİTE ODAĞI: BOGASTOCK.COM platformunun ABD borsaları (S&P 500, Nasdaq, NYSE) ve terminal sol barındaki varlıklar (Madenler, Forex, Kripto) odaklıdır. BIST veya başka yerel borsa yorumu yapılmaz.

`;

  if (pageContext) {
    if (pageContext.type === "ticker") {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${pageContext.value} hissesinin grafik/analiz sayfasındadır. "Analiz et" gibi belirsiz bir istek gelirse ${pageContext.value} için show_stock_card aracını çağır.\n\n`;
      if (pageContext.value === "NVDA") {
        contextStr += `ÖZEL TANITIM ENTEGRASYONU (NVDA): NVIDIA ($NVDA) hissesi platformumuzun tüm 5 dildeki BOGA Copilot özel tanıtım hissesidir. Bu hisse için TÜM Premium özellikleri (BOGA AI Skoru, Destek/Direnç/Hedef Seviyeleri, Derin Bilanço ve Kurumsal Aktivite) kısıtlamasız açıktır. Yanıtının başına veya sonuna nazikçe şu notu ekle: "(✨ Bu detaylı BOGA AI analizleri ve teknik seviyeler normalde Pro/Premium üyelerimize özeldir; NVIDIA ($NVDA) özel tanıtım entegrasyonumuz kapsamında ücretsiz kullanımınıza açılmıştır.)"\n\n`;
      }
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
    const master = await withTimeout(getMasterData(), 2000, null as any);
    if (master && !master.is_mock) {
      contextStr += `GÜNCEL PİYASA GÖRÜNÜMÜ (${master.date || ""}): Piyasa Rejimi: ${master.market_regime || "N/A"}\n`;
      const sectors = Object.entries((master.sector_summary || {}) as Record<string, any>)
        .sort((a: any, b: any) => ((b[1] as any)?.avg_score ?? 0) - ((a[1] as any)?.avg_score ?? 0))
        .slice(0, 8)
        .map(([n, s]: [string, any]) => `- ${n}: Ort. Skor ${s.avg_score}, Lider Ticker: ${s.top_ticker || "N/A"}`)
        .join("\n");
      if (sectors) contextStr += `SEKTÖR ÖZETİ:\n${sectors}\n\n`;
    }
  } catch {}

  contextStr += `KURALLAR:
1. Kısa, son derece kibar ve anlaşılır cevaplar ver. Maddeler kullan.
2. Bir hisse sorulduğunda MUTLAKA 'show_stock_card' veya 'get_deep_analysis' aracını çağır.
3. Trend Hisseleri, İzleme Listem, Top7 veya Top100 sorulduğunda MUTLAKA 'get_top_trending_stocks' aracını çağır.
4. Yanıtının sonuna MUTLAKA tıklanabilir buton formatında [Buton Metni](copilot-topic://select) ekle.
5. ARAÇ SONUCU ALDIĞINDA, sonucu kullanıcıya kısa ve net şekilde özetle. Araç çağırdıktan sonra MUTLAKA bir metin yanıtı da üret.`;

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

    try {
      await supabaseAdmin.rpc("get_copilot_credit_status", {
        p_user_id: user.id,
        p_default_limit: dailyLimit,
      });
    } catch {}

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUserMessage?.content) {
      const tickerFromContext = pageContext?.type === "ticker" ? pageContext.value : null;
      logSearchHistory(user.id, String(lastUserMessage.content), tickerFromContext).catch(() => {});
    }

    const systemPrompt = await buildSystemPrompt(pageContext, locale, user.id);

    const result = streamText({
      model: googleProvider("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      tools: {
        get_top_trending_stocks: tool({
          description: "Fetches BOGASTOCK.COM site dashboard lists: Trend Hisseleri, İzleme Listem, BOGA AI Watchlist, Top7, or Top100. Call this when user asks for 'trend hisseler', 'izleme listem', 'top7', 'top100', 'boga ai watchlist'.",
          parameters: z.object({
            category: z.enum(["trend_stocks", "user_watchlist", "boga_ai_watchlist", "top_100", "top_7"]).optional(),
          }),
          execute: async ({ category }) => {
            try {
              const cat = category || "trend_stocks";
              const res = await withTimeout(
                getSiteCategoryStocksList(cat, locale, user.id),
                5000,
                { categoryName: "BOGASTOCK Hisseleri", tickers: ["BBIO", "MOD", "JPM", "HWM"], cards: [] }
              );
              return {
                success: true,
                categoryName: res.categoryName,
                tickers: res.tickers || [],
                stocks: res.cards || [],
              };
            } catch (err) {
              console.error("[get_top_trending_stocks] Error:", err);
              return {
                success: true,
                categoryName: "BOGASTOCK Canlı Hisseleri",
                tickers: ["BBIO", "MOD", "JPM", "HWM"],
                stocks: [],
              };
            }
          },
        }),
        search_market_news: tool({
          description: "Fetches live breaking market news ONLY when the user explicitly requests news. NEVER call this when the user asks for stock tickers or trending stocks.",
          parameters: z.object({ query: z.string().describe("Topic or ticker to search market news for") }),
          execute: async ({ query }) => {
            try {
              const news = await withTimeout(fetchLiveMarketNews(query, locale), 5000, []);
              return { success: true, query, news: news || [] };
            } catch (e) {
              return { success: true, query, news: [] };
            }
          },
        }),
        navigate_to: tool({
          description: "Use when the user wants to open/navigate to a specific stock's chart or detail page.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            try {
              const t = ticker.trim().toUpperCase();
              const isFormatValid = t.length <= 5 && /^[A-Z]+$/.test(t);
              if (!isFormatValid) return { success: false, error: ct("invalidTicker", locale) };
              const real = await withTimeout(isRealTicker(t), 2000, true);
              if (!real) return { success: false, error: ct("tickerNotFound", locale) };
              return { success: true, ticker: t };
            } catch (e) {
              return { success: true, ticker: ticker.toUpperCase() };
            }
          },
        }),
        show_stock_card: tool({
          description: "Call this whenever the user asks about a specific stock ticker to show its current BOGA score, support/resistance/target levels as a card.",
          parameters: z.object({ ticker: z.string() }),
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
        get_deep_analysis: tool({
          description: "Fetches a stock's fundamentals, insider buy/sell activity, sector context, recent news, and BOGA's historical trade performance.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            try {
              const deep = await withTimeout(getDeepAnalysis(ticker, locale), 5000, null);
              if (!deep) return { success: false, error: ct("noStockData", locale) };
              return { success: true, ...deep };
            } catch (e) {
              return { success: false, error: ct("noStockData", locale) };
            }
          },
        }),
        get_technical_levels: tool({
          description: "Fetches live price, support/resistance, RSI(14), 5-day trends, volume vs average percentage, and Weinstein stage.",
          parameters: z.object({ ticker: z.string() }),
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
      },
      maxSteps: 3,
      async onFinish({ text, toolCalls, toolResults }) {
        try {
          await supabaseAdmin.rpc("increment_copilot_credit", { p_user_id: user.id });
        } catch {}
        try {
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: text || "",
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

    return (await result).toDataStreamResponse();
  } catch (err: any) {
    console.error("Copilot POST Exception:", err);
    return NextResponse.json(
      {
        error: "Bir an bekleyin, hemen tekrar deneyebilirsiniz.",
        code: "GRACEFUL_RECOVERY",
      },
      { status: 500 }
    );
  }
}
