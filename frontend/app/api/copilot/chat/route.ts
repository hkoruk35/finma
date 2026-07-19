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
import { getMasterData } from "@/lib/data";
import { getSwingStrategySnapshot } from "@/lib/copilot/pageContext";
import { getDeepAnalysis } from "@/lib/copilot/deepAnalysis";
import { isRealTicker } from "@/lib/copilot/tickerValidation";
import { getPerformanceSummaryForPrompt, getPerformanceInsights } from "@/lib/copilot/performanceInsights";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";

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
2. BOGA verilerinde doğrudan cevap yoksa (örn. "bu sektördeki diğer şirketler hangileri", genel ekonomi kavramı, tanım, tarihsel bilgi, rakip firmalar) kendi genel/kamuya açık bilgini kullanarak yanıtla. BUNU YAPMAKTAN ASLA KAÇINMA — "elimde bu bilgi yok", "bu yeteneğim yok", "sadece bana verilen araçlarla yardımcı olabilirim", "site'de bu veri yoksa yapamam" gibi cümlelerle REDDETME. Site içi araçlar (get_performance_insights, show_stock_card, get_deep_analysis, get_technical_levels) varsa MUTLAKA onları çağır — aracın sonucu eksikse "site içinde daha fazlası olabilir ama şu anda X var" diye kapat, kuru bir "yapamıyorum" söyleme. Sadece bunun genel bilgi olduğunu, BOGA'nın kendi taraması olmadığını belirt (örn. "Bu BOGA'nın taradığı bir liste değil, genel bilgime göre..."). Sadece gerçekten finans/borsa dışı bir konu (yemek tarifi, spor vb.) sorulursa nazikçe kapsam dışı olduğunu söyle.
3. Sayısal bir değer (skor, fiyat, destek, direnç, hedef, PE, marj, kazanma oranı, geçmiş getiri vb.) SÖYLEYECEKSEN mutlaka show_stock_card veya get_deep_analysis aracının döndürdüğü veriden al — asla tahmin/uydurma sayı verme.

`;

  if (pageContext) {
    if (pageContext.type === "ticker") {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${pageContext.value} hissesinin grafik/analiz sayfasındadır. "Analiz et" gibi belirsiz bir istek gelirse tekrar ticker sorma, doğrudan ${pageContext.value} için show_stock_card aracını çağır.\n\n`;
      try {
        const snapshot = await getSwingStrategySnapshot(pageContext.value, locale);
        if (snapshot) {
          contextStr += `SAYFADA GÖSTERİLEN VERİ (kullanıcının şu an ekranında gördüğü BOGA AI Swing Strateji Durumu paneli):\n${snapshot}\n\nÖNEMLİ NOT: Grafik sayfasında bunun ALTINDA/YANINDA ayrıca "İşlem Kurgusu Gereçesi" gibi bağımsız, anlık hesaplanan bir teknik analiz bölümü de olabilir — bu SANA VERİLMEDİ, onun tam içeriğini bilmiyorsun. "Şu an girmeli miyim" gibi kesin zamanlama soruları gelirse SADECE yukarıdaki swing havuzu durumunu (Giriş Zone / Bekle) referans al, sayfadaki diğer panelle çelişebilecek kesin bir "gir/girme" yargısı verme — bunun yerine swing havuzu durumunu açıkla ve "sayfadaki anlık teknik göstergelere de bakman iyi olur" de.\n\n`;
        }
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

  // Performance insights — geçen hafta/ay en çok kar eden hisseleri ve sektör performansı
  try {
    const perfSummary = await getPerformanceSummaryForPrompt(locale);
    if (perfSummary) {
      contextStr += perfSummary + "\n\n";
    }
  } catch {}

  contextStr += `KURALLAR:
1. Kısa (concise) cevaplar ver. Uzun paragraflar yazma. Maddeler kullan.
2. Sadece finans/borsa konuş, diğer soruları nazikçe reddet.
3. Bir hisse "analiz et" / skor / destek-direnç-hedef sorulduğunda MUTLAKA 'show_stock_card' aracını çağır. Bu araç HER gerçek ABD hissesi için çalışır: hisse BOGA'nın curated swing havuzundaysa oradaki veriyi, değilse (ör. $MOH, $MU) grafik sayfasının canlı motoruyla anlık hesaplanan GERÇEK BOGA analizini döndürür. Kart ekranda zaten görünür — döndürdüğü sayıları AYRICA metin olarak tekrarlama.
4. Bilanço, insider aktivitesi, sektör bağlamı, haberler, geçmiş işlem performansı veya derinlemesine teknik gibi bir soru geldiğinde 'get_deep_analysis' aracını çağır. Bu araç HER gerçek ABD hissesi için çalışır — hisse BOGA'nın curated havuzunda değilse (KEEL gibi) bile 'fundamentalSource: "live"' ile canlı site veri kaynağından bilanço/insider/yönetici verisi döner ('companyProfile' alanında üst düzey yöneticiler ve analist konsensüsü de olabilir). BU YÜZDEN havuz-dışı bir hissede ASLA "bilançosuna erişemiyorum" veya "bu veriye ulaşamıyorum" DEME — aracı çağır, fundamentalSource "live" ise gerçek sayılarla yanıtla; fundamental hem curated hem live'da null dönerse (gerçekten hiçbir kaynakta yoksa) o zaman "bu hisse için bilanço verisi şu an mevcut değil" de. ASLA sayı uydurma. VERİ SUNUMUNDA: Sayıları direkt ver ama yanlarında açıklaması olsun — teknik terim ama açıklamalı. Örn: "PE Oranı: 25 (P/E — hisse başına kazancın 25 katına işlem görmektedir, yüksek değerler pahalı değerlemeler göstergesi)" veya "Net Kâr Marjı: %18.5 (her 100 lira satıştan 18,5 lira kâr)" gibi. Haberler ve analist yorumları dışında, veri/analiz konularında BOGA AI ve site kaynakları haricinde başka kaynak belirtme.
5. Bir araç GERÇEKTEN "veri yok" derse (success:false — sadece tamamen geçersiz/işlem görmeyen sembollerde olur) hisseyi grafik sayfasında açmayı 'navigate_to' ile teklif et; asla sadece "yardımcı olamam" deyip bitirme.
6. "NVIDIA grafiği", "TSLA'yı aç" vb. dendiğinde 'navigate_to' aracını çağır. Araç gerçekten geçersiz/uydurma bir sembol derse kullanıcıya nazikçe bildir, ısrar etme.
7. Metin içinde bir hisseden bahsederken ticker'ı $TICKER formatında yaz (örn. $NVDA), böylece tıklanabilir olur.
8. "Geçen hafta / geçen ay en çok kar eden hisseleri" veya "performans" soruları geldiğinde 'get_performance_insights' aracını çağır — filtrelenmiş analiz, sektör breakdown, win rate döndürür. Aracın verisini kullanarak spesifik, gerçek sayılar içeren bir yanıt ver.
9. EMA20/50/200'e uzaklık, RSI seviyesi ve yönü, hacim durumu (ortalamaya göre), destek/direnç seviyeleri veya "son 1 aylık/1 yıllık grafik durumu" gibi bir soru geldiğinde 'get_technical_levels' aracını çağır. Bu araç grafik sayfasıyla AYNI motordan (gerçek OHLC verisinden) hesaplanmış sayılar döner — asla EMA/RSI/destek-direnç sayısı uydurma.
10. KULLANICI BİR HİSSEYİ GENEL OLARAK İNCELEMEK/ARAŞTIRMAK İSTEDİĞİNİ belirtip (ör. "KEEL'i incelemek istiyorum", "AAPL hakkında bilgi ver", "bu hisseyi araştırmak istiyorum") HANGİ KONUYU istediğini belirtmezse, doğrudan tahmin edip tek bir cevap üretme — bunun yerine kullanıcıya seçebileceği kısa bir konu listesi sun (madde işaretli, her biri 3-6 kelime, ${langName} diline çevirerek). Örnek başlıklar (ihtiyaca göre uyarla, kelimesi kelimesine kopyalama):
   - Son 1 Aylık Grafik Durumu (EMA, RSI, hacim, destek/direnç)
   - Son 1 Yıllık Grafik Analizi (uzun vadeli trend)
   - Bilanço ve Büyüme Analizi (gelir, kâr marjları, borç/özkaynak)
   - Gelir/Hisse Oranları (P/E, hisse başı gelir, kâr büyümesi)
   - İçeriden Öğrenen (Insider) ve Kurumsal Hareketler
   - Yönetim Kadrosu, Analist Görüşü ve Son Haberler
   - Swing mi Uzun Vade mi? BOGA Trend Konumu
   Kullanıcı bir başlık seçtiğinde HEMEN ilgili aracı çağır (grafik/EMA/RSI/hacim konuları → get_technical_levels + show_stock_card; bilanço/gelir oranları/insider/yönetim konuları → get_deep_analysis; swing/uzun vade konusu → show_stock_card + get_deep_analysis'in performanceHistory ve liveTechnical alanları). Kullanıcı zaten spesifik bir konu belirtmişse (ör. doğrudan "bilançosunu yorumla" dediyse) menüyü atla, direkt ilgili aracı çağır.
11. TREND-BİLİNÇLİ YORUM: get_technical_levels'ten dönen priceTrend5d/rsiTrend5d/volumeVsAvgPct alanlarını ve get_deep_analysis'in liveTechnical.warnings/activeSignals alanlarını MUTLAKA yorumuna yansıt. Fiyat "falling" + RSI "falling" + hacim ortalamanın altındaysa ("volumeVsAvgPct" negatif): bunun düşüşün hacim/ivme desteği olmadan, zayıf katılımla sürdüğünü belirt ve dikkatli olunması gerektiğini vurgula. Fiyat "falling" + hacim ortalamanın belirgin üzerindeyse: bunun güçlü satış baskısı/dağıtım olabileceğini belirt. Fiyat "rising" + RSI "rising" ve RSI henüz 70 üzerinde değilse: yükseliş yapısının sağlıklı/momentum destekli olduğunu, boğa senaryosunu destekleyen unsurları vurgulayarak yaz. RSI 70 üzerindeyse aşırı alım bölgesinde olduğunu da ekle. Bu bir kesin "al/sat" tavsiyesi değil, gözlemsel teknik yorumdur — öyle sun.
12. OPSİYON (call, put, CSP, covered call, strike, prim vb.) sorularına ODAKLANMADIĞINI belirt — BOGA'nın asıl uzmanlığı hisse senedi analizi. Opsiyon stratejileri kaldıraç ve karmaşıklık nedeniyle YÜKSEK RİSKLİ bir alandır; derinlemesine opsiyon stratejisi/tavsiyesi ÜRETME, bunun yerine kısaca uyar ve dikkatli olunmasını öner.`;

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
            // Gerçek borsa sembolü mü diye doğrula — halüsinasyon yönlendirme yok.
            // BOGA'nın dar/aktif skorlama havuzuyla (getStockData) SINIRLI DEĞİL:
            // MU gibi gerçek ama şu an taranmayan hisselere de yönlendirebilmeli,
            // grafik sayfası kendi bağımsız canlı motoruyla zaten analiz gösterir.
            const real = await isRealTicker(t);
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
        get_performance_insights: tool({
          description: "BOGA Swing Motoru'nun geçmiş işlem performansını analiz et. Kullanıcı 'geçen hafta', 'geçen ay', 'son 90 gün' vb. zaman aralıkları belirtebilir. Tool en çok kar eden hisseleri, kazanma oranını, sektör performansını döndürür — tüm veriler gerçek swing_performance.json verisinden gelir.",
          parameters: z.object({
            daysBack: z.number().optional().describe("Kaç gün öncesinden itibaren (7=geçen hafta, 30=geçen ay, 90=geçen 3 ay, 0=tümü)"),
          }),
          execute: async ({ daysBack = 0 }) => {
            const insights = await getPerformanceInsights(daysBack, locale);
            if (!insights) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...insights };
          },
        }),
        get_technical_levels: tool({
          description: "Bir hissenin EMA20/50/200'e uzaklığını, RSI seviyesi/yönünü, hacim durumunu (20 günlük ortalamaya göre), destek/direnç seviyelerini ve 1G/5G/1A/1Y fiyat değişimini getirir. Grafik sayfasıyla AYNI motordan (gerçek OHLC) hesaplanır — SADECE ticker parametresi alır, sayıları sen üretmezsin.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const levels = await getTechnicalLevels(ticker);
            if (!levels) return { success: false, error: ct("noStockData", locale) };
            return { success: true, ...levels };
          },
        }),
      },
      maxSteps: 5,
      async onFinish({ text, toolCalls, toolResults }) {
        // Kredi SADECE başarılı üretimden sonra düşülür.
        try {
          await supabaseAdmin.rpc("increment_copilot_credit", { p_user_id: user.id });
        } catch (e) {
          console.error("[copilot] credit increment failed:", e);
        }
        try {
          // responseMessages CoreMessage şeklinde (id/toolInvocations yok) —
          // useChat'in beklediği UI Message şekline elle çeviriyoruz ki
          // /api/copilot/history'den geri yüklenince setMessages ile
          // doğrudan render edilebilsin (kart/tool sonucu dahil).
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
