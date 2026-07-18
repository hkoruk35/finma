import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getMemberAccess } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRealStockCardData } from "@/lib/copilot/stockData";
import { getPersonalizationContext, logSearchHistory, getCopilotProfile } from "@/lib/copilot/personalization";
import { getSuggestedName, LOCALE_NAMES } from "@/lib/copilot/persona";
import { ct } from "@/lib/copilot/i18n";
import { getStockData, getMasterData } from "@/lib/data";
import { getSwingStrategySnapshot } from "@/lib/copilot/pageContext";
import { getDeepAnalysis } from "@/lib/copilot/deepAnalysis";

export const maxDuration = 60;

// @ai-sdk/google'ın varsayılan `google` export'u GOOGLE_GENERATIVE_AI_API_KEY
// arıyor — projede (Vercel dahil) sadece GEMINI_API_KEY tanımlı (diğer tüm
// Gemini çağrıları — /api/ask, /api/ai-briefing — bunu kullanıyor). Aynı
// değişkeni burada da açıkça bağlıyoruz.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_CREDIT_LIMIT: Record<string, number> = {
  premium: 200,
  admin: 200,
  free_trial: 20,
};

function resolveLocale(raw: any): string {
  return ["tr", "en", "es", "fr", "pt"].includes(raw) ? raw : "en";
}

async function buildSystemPrompt(pageContext: any, locale: string, userId: string): Promise<string> {
  const langName = LOCALE_NAMES[locale] || LOCALE_NAMES.en;
  const profile = await getCopilotProfile(userId);
  const name = profile.displayName || getSuggestedName(locale);
  const personalization = await getPersonalizationContext(userId);

  // KURAL SIRASI BİLİNÇLİ: veri önceliği ve dil kuralı en başta, en güçlü
  // vurguyla — model her zaman önce aşağıdaki gerçek site verisine bakmalı,
  // kendi genel bilgisine SADECE bu veriler yetersiz kaldığında düşmeli.
  let contextStr = `SEN BOGA COPILOT'SUN. Adın "${name}". Kullanıcıya kendini bu isimle tanıt, "BOGA Copilot" ekibinin bir parçası olduğunu belirtebilirsin.

DİL KURALI (KESİN): Kullanıcıyla SADECE ${langName} dilinde konuş — mesajın kısa/belirsiz olsa bile, kullanıcı başka bir dilde yazsa bile bu kuraldan asla sapma. Tüm yanıtın (karşılama, analiz, hata mesajları) ${langName} dilinde olacak.

VERİ ÖNCELİĞİ VE KAPSAM (KESİN — en kritik kural, 3 katman):
1. ÖNCE aşağıda sana verilen GERÇEK BOGA VERİLERİNİ (piyasa rejimi, sektör özeti, swing tercihleri, sayfa/ticker bağlamı) kullan. Belirli bir hisse soruluyorsa show_stock_card aracını çağır — bu araç gerçek veriyi çeker. Bilanço/temel veriler (PE, kâr marjı, gelir büyümesi, kurumsal ortaklık oranı), insider (içeriden öğrenenler) alım/satım aktivitesi, sektör bağlamı, haberler veya BOGA'nın bu hissede GEÇMİŞTE yaptığı gerçek işlemlerin performansı (kazanma oranı, geçmiş getiriler) soruluyorsa 'get_deep_analysis' aracını çağır — bu da gerçek veriyi çeker, asla tahmin etme. Kullanıcı "grafikte/sayfada ne görüyorum, bu analiz neye dayanıyor" derse, aşağıdaki "SAYFADA GÖSTERİLEN VERİ" bölümünü DOĞRUDAN referans alarak açıkla — genel/belirsiz bir cevap verme.
2. BOGA verilerinde doğrudan cevap yoksa (örn. "bu sektördeki diğer şirketler hangileri", genel ekonomi kavramı, tanım, tarihsel bilgi, rakip firmalar) kendi genel/kamuya açık bilgini kullanarak yanıtla. BUNU YAPMAKTAN ASLA KAÇINMA — "elimde bu bilgi yok", "bu yeteneğim yok", "sadece bana verilen araçlarla yardımcı olabilirim" gibi cümlelerle REDDETME. Sadece bunun genel bilgi olduğunu, BOGA'nın kendi taraması olmadığını belirt (örn. "Bu BOGA'nın taradığı bir liste değil, genel bilgime göre..."). Sadece gerçekten finans/borsa dışı bir konu (yemek tarifi, spor vb.) sorulursa nazikçe kapsam dışı olduğunu söyle.
3. Sayısal bir değer (skor, fiyat, destek, direnç, hedef, PE, marj, kazanma oranı, geçmiş getiri vb.) SÖYLEYECEKSEN mutlaka show_stock_card veya get_deep_analysis aracının döndürdüğü veriden al — asla tahmin/uydurma sayı verme.

`;

  if (pageContext) {
    if (pageContext.type === "ticker") {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${pageContext.value} hissesinin grafik/analiz sayfasındadır. "Analiz et" gibi belirsiz bir istek gelirse tekrar ticker sorma, doğrudan ${pageContext.value} için show_stock_card aracını çağır.\n\n`;
      try {
        const snapshot = await getSwingStrategySnapshot(pageContext.value, locale);
        if (snapshot) contextStr += `SAYFADA GÖSTERİLEN VERİ (kullanıcının şu an ekranında gördüğü BOGA AI Swing Strateji Durumu paneli):\n${snapshot}\n\n`;
      } catch {}
    } else if (pageContext.page) {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda "${pageContext.page}" sayfasındadır.\n\n`;
    }
  }

  if (personalization.topSectors.length > 0) {
    contextStr += `KULLANICI İLGİ ALANI: İzleme listesine göre en çok ilgilendiği sektörler: ${personalization.topSectors.join(", ")}. Uygun olduğunda önerilerini bu sektörlere göre önceliklendir (ama zorlama).\n`;
  }
  if (personalization.watchlistTickers.length > 0) {
    contextStr += `KULLANICININ İZLEME LİSTESİ: ${personalization.watchlistTickers.join(", ")}\n`;
  }
  if (personalization.recentQueries.length > 0) {
    contextStr += `SON ARAMALARI: ${personalization.recentQueries.slice(0, 5).join(" | ")}\n`;
  }
  contextStr += "\n";

  // Genel piyasa/sektör görünümü — MarketMoodBar'ın da kullandığı aynı gerçek
  // kaynak (getMasterData). Model, "piyasa nasıl", "hangi sektör güçlü" gibi
  // genel sorularda tool çağırmadan önce buradaki gerçek veriyi kullanabilir.
  try {
    const master = await getMasterData();
    if (master && !master.is_mock) {
      contextStr += `GÜNCEL PİYASA GÖRÜNÜMÜ (${master.date || ""}): Piyasa Rejimi: ${master.market_regime || "N/A"}\n`;
      const sectors = Object.entries(master.sector_summary || {})
        .sort((a, b) => (b[1]?.avg_score ?? 0) - (a[1]?.avg_score ?? 0))
        .slice(0, 8)
        .map(([name, s]: [string, any]) => `- ${name}: Ort. Skor ${s.avg_score}, Lider Hisse: ${s.top_ticker || "N/A"} (${s.stock_count} hisse)`)
        .join("\n");
      if (sectors) contextStr += `SEKTÖR ÖZETİ (skora göre sıralı):\n${sectors}\n\n`;
    }
  } catch {}

  try {
    const dirBase = path.resolve(process.cwd(), "public", "data", "swing2026");
    if (fs.existsSync(dirBase)) {
      const files = fs.readdirSync(dirBase).filter((f) => f.startsWith("swing_") && f.endsWith(".json"));
      if (files.length > 0) {
        files.sort((a, b) => b.localeCompare(a));
        const picksData = JSON.parse(fs.readFileSync(path.join(dirBase, files[0]), "utf-8"));
        if (picksData?.picks) {
          const topPicks = picksData.picks
            .slice(0, 10)
            .map((p: any) => `- ${p.ticker} (Skor: ${p.score}/100, Sinyal: ${p.status}, Fiyat: $${p.current_price})`)
            .join("\n");
          contextStr += `GÜNCEL BOGA AI SWING TERCİHLERİ (${picksData.date || ""}):\n${topPicks}\n\n`;
        }
      }
    }
  } catch {}

  contextStr += `KURALLAR:
1. Kısa (concise) cevaplar ver. Uzun paragraflar yazma. Maddeler kullan.
2. Sadece finans/borsa konuş, diğer soruları nazikçe reddet.
3. Bir hissenin hızlı skor/destek/direnç/hedef durumu istendiğinde MUTLAKA 'show_stock_card' aracını kullan, bu araç kartı ekranda zaten gösterir — kartın döndürdüğü sayıları AYRICA metin olarak tekrarlama.
4. Bilanço, insider aktivitesi, sektör bağlamı, haberler veya geçmiş işlem performansı gibi DAHA DERİN bir soru geldiğinde 'get_deep_analysis' aracını çağır, sonra aracın döndürdüğü GERÇEK sayıları kullanarak kısa bir yorum/analiz metni yaz (örn. "PE oranı X, sektör ortalamasının üzerinde/altında..."). Bu sayıları asla tahmin etme — sadece aracın döndürdüğü değerleri kullan. Araç veri döndürmezse (success:false) veri olmadığını söyle.
5. "NVIDIA grafiği", "TSLA'yı aç" vb. dendiğinde 'navigate_to' aracını çağır. Araç geçersiz ticker derse kullanıcıya nazikçe bildir, ısrar etme.
6. Metin içinde bir hisseden bahsederken ticker'ı $TICKER formatında yaz (örn. $NVDA), böylece tıklanabilir olur.`;

  return contextStr;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, pageContext, locale: rawLocale } = body;
  const locale = resolveLocale(rawLocale);

  const access = await getMemberAccess();
  if (!access.authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  // supabase-server'daki auth.getUser() zaten getMemberAccess() içinde çağrıldı;
  // user id'yi ayrıca almak için hafif bir ek çağrı (cookie tabanlı, ucuz).
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabaseAuth = await createSupabaseServerClient();
  const { data: userData } = await supabaseAuth.auth.getUser();
  const user = userData.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const dailyLimit = access.isPremium
    ? DEFAULT_CREDIT_LIMIT.premium
    : access.isFreeTrial
    ? DEFAULT_CREDIT_LIMIT.free_trial
    : 0;

  if (dailyLimit === 0) {
    return NextResponse.json({ error: ct("noAccess", locale), code: "NO_ACCESS" }, { status: 403 });
  }

  const { data: statusRows, error: statusErr } = await supabaseAdmin.rpc("get_copilot_credit_status", {
    p_user_id: user.id,
    p_default_limit: dailyLimit,
  });
  if (statusErr) {
    console.error("[copilot] credit status error:", statusErr.message);
    return new Response("Service Unavailable", { status: 503 });
  }
  const status = Array.isArray(statusRows) ? statusRows[0] : statusRows;
  if (!status || status.current_usage >= status.daily_limit) {
    const limit = status?.daily_limit ?? dailyLimit;
    return NextResponse.json(
      {
        error: ct("quotaExhausted", locale, { limit }),
        code: "QUOTA_EXCEEDED",
        currentUsage: status?.current_usage ?? dailyLimit,
        dailyLimit: limit,
      },
      { status: 429 }
    );
  }

  const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
  if (lastUserMessage?.content) {
    const tickerFromContext = pageContext?.type === "ticker" ? pageContext.value : null;
    logSearchHistory(user.id, String(lastUserMessage.content), tickerFromContext).catch(() => {});
  }

  const systemPrompt = await buildSystemPrompt(pageContext, locale, user.id);

  try {
    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      tools: {
        navigate_to: tool({
          description: "Kullanıcı belirli bir hissenin sayfasına veya grafiğine gitmek istediğinde kullan.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const t = ticker.trim().toUpperCase();
            const isFormatValid = t.length <= 5 && /^[A-Z]+$/.test(t);
            if (!isFormatValid) return { success: false, error: ct("invalidTicker", locale) };
            // Gerçekten var olan bir ticker mi diye gerçek veriden doğrula — halüsinasyon yönlendirme yok.
            const real = await getStockData(t);
            if (!real) return { success: false, error: ct("tickerNotFound", locale) };
            return { success: true, ticker: t };
          },
        }),
        show_stock_card: tool({
          description: "Bir hissenin güncel BOGA skorunu, destek/direnç/hedef seviyelerini kart formatında göstermek için. SADECE ticker parametresi alır — skor/fiyat gibi değerleri sen üretmezsin, gerçek veriden gelir.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const card = await getRealStockCardData(ticker, locale);
            if (!card) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...card };
          },
        }),
        get_deep_analysis: tool({
          description: "Bir hissenin bilanço/temel verilerini (PE, kâr marjı, gelir büyümesi, kurumsal ortaklık), insider alım/satım aktivitesini, sektör bağlamını, son haberlerini ve BOGA'nın bu hissede geçmişte yaptığı gerçek işlemlerin performansını (kazanma oranı, geçmiş getiriler) getirir. SADECE ticker parametresi alır — tüm değerler gerçek veriden gelir, sen üretmezsin.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const analysis = await getDeepAnalysis(ticker, locale);
            if (!analysis) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...analysis };
          },
        }),
      },
      maxSteps: 3,
      async onFinish({ responseMessages }) {
        // Kredi SADECE başarılı üretimden sonra düşülür.
        try {
          await supabaseAdmin.rpc("increment_copilot_credit", { p_user_id: user.id });
        } catch (e) {
          console.error("[copilot] credit increment failed:", e);
        }
        try {
          const fullTranscript = [...messages, ...responseMessages];
          await supabaseAdmin.from("copilot_chats").upsert(
            { user_id: user.id, chat_state: fullTranscript, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
        } catch (e) {
          console.error("[copilot] chat persist failed:", e);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Copilot API Error:", error.message);
    return new Response("Service Unavailable", { status: 503 });
  }
}
