import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMemberAccess } from "@/lib/apiAuth";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getRealStockCardData, getSiteCategoryStocksList, SiteListCategory } from "@/lib/copilot/stockData";
import { getDeepAnalysis } from "@/lib/copilot/deepAnalysis";
import { getPersonalizationContext, logSearchHistory, getCopilotProfile } from "@/lib/copilot/personalization";
import { getSuggestedName } from "@/lib/copilot/persona";
import { getMasterData } from "@/lib/data";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { isRealTicker } from "@/lib/copilot/tickerValidation";
import { ct } from "@/lib/copilot/i18n";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";
import { CopilotPageContext, AssetType } from "@/lib/copilot/pageContextSchema";
import { findFaqMatches } from "@/lib/copilot/faqData";
import { getCrossAssetQuote } from "@/lib/copilot/crossAssetData";

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

const ASSET_CLASS_RULES: Record<AssetType, string> = {
  stock: "Teknik + temel + bilanço + haber + analist/insider + BOGA Score + 5 liste üyeliği kullanılabilir.",
  index: "Sadece trend, piyasa genişliği, volatilite, sektör katkısı, makro bağlam. Bilanço/insider/analist aracı ÇAĞIRMA.",
  index_etf: "Sadece trend, piyasa genişliği, volatilite, sektör katkısı, makro bağlam. Bilanço/insider/analist aracı ÇAĞIRMA.",
  sector_etf: "Sektörün göreceli gücü, S&P 500'e göre performans, alt gruplar, sektör liderleri. Bilanço/insider tekil şirket aracı ÇAĞIRMA.",
  fx_pair: "Sadece trend, faiz beklentisi, dolar etkisi, teknik seviyeler. Bilanço/haber/insider aracı ÇAĞIRMA. ABD piyasa takvimine bağlama — döviz 5 gün 24 saat işlem görür.",
  commodity: "Sadece trend, dolar/tahvil faizi ilişkisi, arz-talep, ilgili sektöre etki, teknik seviyeler. Bilanço/insider aracı ÇAĞIRMA.",
  crypto: "24/7 fiyat davranışı, trend, hacim, volatilite. ABD piyasa takvimine (açılış/kapanış) ASLA bağlama — kripto hafta sonu dahil sürekli işlem görür. Bilanço/insider aracı ÇAĞIRMA.",
  theme: "Tema içindeki güçlü hisseler, Top7/Top100/Trend kesişimleri, ana katalizör ve risk üzerinden anlat.",
  unknown: "Varlık sınıfı belirsiz; kullanıcıya hangi varlık sınıfından bahsettiğini sormadan önce ticker'ı normal hisse gibi ele al.",
};

// 3-second timeout wrapper for any async call
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Geçmiş bir stream kesintisinde (örn. bugünkü model-adı çökmeleri sırasında)
// istemci tarafında "state: call" olarak asılı kalmış, hiç sonuç almamış araç
// çağrıları olabilir. Google'ın SDK'sı böyle bir mesajı prompt'a çevirirken
// AI_MessageConversionError fırlatıp TÜM sohbeti (her model denemesinde aynı
// şekilde) kilitliyor. Bu asılı kalmış çağrıları/mesajları temizleyerek geçmiş
// bir kesintinin sohbeti kalıcı olarak bozmasını önler.
function sanitizeMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m: any) => {
      if (m?.role === "assistant" && Array.isArray(m.toolInvocations)) {
        return { ...m, toolInvocations: m.toolInvocations.filter((ti: any) => ti?.state === "result") };
      }
      return m;
    })
    .filter((m: any) => {
      const hasContent = typeof m?.content === "string" && m.content.trim().length > 0;
      const hasResolvedTools = Array.isArray(m?.toolInvocations) && m.toolInvocations.length > 0;
      if (m?.role === "assistant" && !hasContent && !hasResolvedTools) return false; // yarım kalmış, atılabilir
      return true;
    });
}

async function buildSystemPrompt(
  pageContext: CopilotPageContext | null,
  locale: string,
  userId: string,
  accessMode: "member" | "expired_member",
  isPremium: boolean
): Promise<string> {
  const [profile, personalization, master] = await Promise.all([
    withTimeout(getCopilotProfile(userId), 1500, { displayName: "", avatarId: "aylin" } as any),
    withTimeout(getPersonalizationContext(userId), 1500, { topSectors: [], watchlistTickers: [], recentQueries: [] }),
    withTimeout(getMasterData(), 1500, null as any)
  ]);
  const name = profile.displayName || getSuggestedName(locale);

  let contextStr = `SEN BOGA COPILOT'SUN. Adın "${name}". BOGASTOCK.COM platformunun kibar, profesyonel ve samimi yapay zeka asistanısın. Kullanıcının kendi adını BİLMİYORSUN — asla kendi adınla ("${name}") kullanıcıyı selamlama, adını sadece kendini tanıtırken kullan.

TON VE KİBARLIK KURALI:
- KESİNLİKLE "masasına hoş geldiniz" veya soğuk robotik ifadeler KULLANMA.
- Her zaman son derece kibar, nazik ve anlaşılır bir dille yanıt ver.

TIKLANABİLİR BUTON ZORUNLULUĞU (BİÇİM KESİNLİKLE SABİTTİR):
- HER YANITININ SONUNA KULLANICININ TIKLAYABİLECEĞİ EN FAZLA 3 TIKLANABİLİR YÖNLENDİRME BUTONU EKLE!
- İki buton türü vardır, ASLA başka bir URL/route uydurma, sadece bu iki format kullanılabilir. Parantez içindeki kısım HER ZAMAN AŞAĞIDA YAZDIĞI GİBİ BİREBİR KALIR — asla konuyla ilgili gerçek metin, boşluk veya Türkçe karakter İÇERMEZ:
  1. Takip sorusu butonu: [Buton Metni](copilot-topic://select) — parantez içi HER ZAMAN tam olarak "copilot-topic://select" yazılır (kelimesi kelimesine, değiştirilmez). Tıklanınca köşeli parantezdeki BUTON METNİ yeni bir kullanıcı mesajı gibi gönderilir.
     DOĞRU: [ONDS teknik seviyelerini detaylandır](copilot-topic://select)
     YANLIŞ: [ONDS teknik seviyelerini detaylandır](copilot-topic://ONDS teknik seviyelerini göster) — parantez içine gerçek metin/boşluk KOYMA, link kırılır.
  2. Sayfaya git butonu: [Buton Metni](copilot-list://LIST_KEY) — LIST_KEY sadece şunlardan biri olabilir (boşluksuz, İngilizce, birebir): personal_watchlist, trend_list, trend_candidate_watchlist, top7, top100.
- Aynı butonu art arda tekrar sunma, bağlama göre değiştir.

BİÇİMLENDİRME (KISA VE TEMİZ TUT):
- Ardışık boş satır bırakma (en fazla tek bir boş satır ile paragraf ayır). Her cümleyi ayrı "başlık" gibi sunup aralarına boşluk koyma — bitişik, akıcı paragraflar veya kısa madde işaretleri kullan.

BEŞ AYRI LİSTE — ASLA BİRBİRİNE KARIŞTIRMA (KESİN KURAL):
BOGASTOCK'ta birbirinden tamamen ayrı 5 liste vardır. "Top 100" bunlardan sadece biridir, VARSAYILAN/TEK liste değildir:
1. Kişisel İzleme Listesi (personal_watchlist) — kullanıcının kendi seçtiği en fazla 50 hisse.
2. Trend Listesi (trend_stocks) — sitenin /swing sayfasındaki taranmış aday havuzu (skora göre sıralı). Her hissenin kendi giriş durumu (ENTERED = teyit tamamlanmış / Bekle = henüz teyit bekliyor) olabilir; hepsi otomatik olarak "teyitli" değildir — kesinlik dili kullanmadan bu ayrımı belirt.
3. Trend Adayı İzleme Listesi (trend_candidate_watchlist) — henüz aktif trend teyidini TAMAMLAMAMIŞ ama sistem radarına girmiş hisseler. Bu listede KESİNLİK DİLİ kullanma ("yakında kesin trende girecek" DEME); sadece "fiyat yapısı olumlu ama hacim teyidi henüz yeterli değil" gibi ihtiyatlı dil kullan.
4. Top 7 (top_7) — sitenin standart, sabit 7 büyük teknoloji/mega-cap hissesi (bileşim sabittir; fiyat ve teknik veriler her zaman güncel/canlıdır).
5. Top 100 (top_100) — BOGA'nın kürasyonlu, skora göre sıralı 100 hisselik havuzu. "Kesin en iyi 100 hisse" DEME.
KULLANICI "TREND HİSSELERİ", "İZLEME LİSTEM", "TREND ADAYLARI", "TOP 7", "TOP 100" DEDİĞİNDE:
- KESİNLİKLE VE ASLA 'search_market_news' HABER ARACINI ÇAĞIRMA!
- MUTLAKA 'get_top_trending_stocks' ARACINI DOĞRU category parametresiyle ÇAĞIR!
- Araç "isFallback: true" dönerse, ASLA ticker uydurma — kullanıcıya "şu anda bu listeye erişimde geçici bir aksaklık var, birazdan tekrar dener misiniz?" gibi nazik, teknik terim içermeyen bir cümle söyle.

HABERLER:
- Kullanıcı AÇIKÇA "haber", "haberler", "son gelişmeler" demedikçe SAKIN haber akışı getirme.
- Haber istendiğinde: 2-3 maddelik net özetler halinde anlat, SADECE son 24 saatin haberlerini aktar.
- Bir haberin fiyat hareketiyle aynı zamana denk gelmesi, o haberin fiyatı KESİN olarak etkilediği anlamına gelmez — "yükseliş bu haberin yayımlandığı döneme denk geldi" gibi ihtiyatlı dil kullan, "bu haber yüzünden kesin yükseldi" DEME.

VARLIK SINIFI KURALLARI (her varlık türü kendi analiz şablonundan geçer, birbirine karıştırma):
- Hisse senedi (stock): ${ASSET_CLASS_RULES.stock}
- Endeks/Endeks ETF (index, index_etf — SPY, QQQ, DIA, IWM, VIX): ${ASSET_CLASS_RULES.index_etf}
- Sektör ETF (sector_etf — XLK, XLF, XLE, XLV, XLY, XLP, XLI, XLB, XLRE, XLU, XLC): ${ASSET_CLASS_RULES.sector_etf}
- Döviz (fx_pair — EURUSD, GBPUSD vb.): ${ASSET_CLASS_RULES.fx_pair}
- Emtia (commodity — Altın, Gümüş, Petrol, Doğal Gaz): ${ASSET_CLASS_RULES.commodity}
- Kripto (crypto — Bitcoin, Ethereum): ${ASSET_CLASS_RULES.crypto}
Kripto/Döviz/Emtia hakkında güncel fiyat/değişim sorulduğunda MUTLAKA 'get_cross_asset_quote' aracını çağır (Yahoo Finance canlı verisi). Bu araç hisse senetleri için KULLANILMAZ.

BÖLGE VE BORSA KAPSAMI (KESİNLİKLE İHLAL EDİLEMEZ):
1. Öncelik: BOGASTOCK'un kendi doğrulanmış verisi (BOGA AI skorları, 5 liste, destek/direnç/hedef seviyeleri, swing performans geçmişi).
2. Öncelik: ABD borsaları — S&P 500, Nasdaq, NYSE, ABD hisse senetleri.
3. Öncelik: SADECE terminal sol barında listelenen kıymetli madenler (Altın/Gümüş), Forex (EURUSD vb.) ve Kripto (BTC/ETH vb.).
4. KESİNLİKLE YASAK: Borsa İstanbul (BIST), BIST 30/100 hisseleri veya herhangi bir Avrupa/Asya yerel borsası HAKKINDA YORUM, ANALİZ VEYA HABER ÜRETMEK KESİNLİKLE YASAKTIR. Kullanıcının Türkçe (veya başka bir dilde) yazması BIST'i kastettiği anlamına GELMEZ — dil seçimi sadece yanıtın dilini belirler, piyasa kapsamını DEĞİŞTİRMEZ. Kullanıcı ısrarla BIST/yerel borsa sorarsa, kibarca BOGASTOCK'un ABD piyasalarına odaklandığını açıkla.

FİNANSAL DİL KISITLAMASI (KESİN KURAL):
- ASLA şu kelimeleri kullanma: "garanti", "risksiz", "kesin kâr", "bu hisse kesinlikle yükselecek/düşecek".
- Bunun yerine: "görünüm ... güçlenebilir", "senaryo ... altında zayıflayabilir", "teyit hâlâ gerekli", "bu seviye izlenmeye değer", "algoritma şu anda ... olarak belirliyor" gibi ihtiyatlı ifadeler kullan.
- BOGASTOCK bir yatırım danışmanlığı kuruluşu DEĞİLDİR. Nihai işlem kararı, pozisyon büyüklüğü ve risk yönetimi KULLANICIYA aittir — bunu gerektiğinde nazikçe hatırlat.
- Aktif bir işlem/senaryo planı (destek/direnç/hedef) yoksa PLAN UYDURMA; "şu anda aktif bir işlem kurgusu bulunmuyor, teknik yapı izleme seviyesinde" gibi dürüst bir ifade kullan.

VERİ TAZELİĞİ DİLİ (KESİN KURAL):
- Teknik/fiyat verisi için ASLA "anlık", "gerçek zamanlı" DEME. Bunun yerine "güncel piyasa görünümü", "yaklaşık 15 dakika gecikmeli fiyat verisi", "saatlik teknik güncelleme" gibi ifadeler kullan.
- Haber verisi daha güncel olabilir; fiyat verisiyle aynı zaman damgası altında sunma.

SSS (SIKÇA SORULAN SORULAR) — KESİN KURAL:
- Kullanıcı platformun nasıl çalıştığını, üyeliği, fiyatı, ödemeyi, iptali, ücretsiz denemeyi, veri gecikmesini, riski veya Stop Loss'u sorarsa MUTLAKA 'get_faq_answer' aracını çağır.
- Araç bir eşleşme döndürürse, o resmi cevabı KENDİ CÜMLELERİNLE ÖZETLEMEDEN, anlamını DEĞİŞTİRMEDEN aktar (gerekirse kısalt ama fiyat/ödeme/iptal/risk rakamlarını ve ifadelerini birebir koru). Bu resmi metinleri asla kendi yorumunla uydurma veya değiştirme.
- Araç eşleşme bulamazsa, konuyu bilmediğini dürüstçe belirt ve destek sayfasına yönlendir.

`;

  if (accessMode === "expired_member") {
    contextStr += `ÜYELİK DURUMU: Bu kullanıcının ücretli üyeliği şu anda AKTİF DEĞİL (süresi dolmuş/iptal edilmiş). Kayıtlı kişisel listesi ve geçmiş görevleri korunuyor (salt okunur) ama yeni görev oluşturamaz. Bunu sorarsa kibarca açıkla, ama sohbetin başında kendiliğinden satış/yenileme mesajı ile karşılama.\n\n`;
  } else {
    contextStr += `ÜYELİK DURUMU: Bu kullanıcının aktif bir üyeliği var. Aktif üyeye tekrar tekrar üyelik/fiyat/kampanya mesajı GÖSTERME — görevin üyeliği yeniden satmak değil, üyeliğin değerini kullandırmaktır.\n\n`;
  }

  if (pageContext?.selectedAsset) {
    const { symbol, assetType } = pageContext.selectedAsset;
    contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${symbol} (${assetType}) sayfasındadır. "Analiz et" gibi belirsiz bir istek gelirse tekrar hangi varlığı kastettiğini SORMA, doğrudan ${symbol} için ilgili aracı çağır.\n\n`;
    if (symbol === "NVDA") {
      let nvdaNote = "(✨ Bu detaylı BOGA AI analizleri ve teknik seviyeler normalde Pro/Premium üyelerimize özeldir; NVIDIA ($NVDA) özel tanıtım entegrasyonumuz kapsamında ücretsiz kullanımınıza açılmıştır.)";
      if (locale === "en") nvdaNote = "(✨ These deep analytics and technical levels are normally exclusive to BOGA Pro/Premium members; unlocked for free as part of our NVIDIA ($NVDA) showcase integration.)";
      else if (locale === "es") nvdaNote = "(✨ Estos análisis y niveles técnicos profundos son normalmente exclusivos de BOGA Pro/Premium; desbloqueados gratis para la demostración de NVIDIA ($NVDA).)";
      else if (locale === "fr") nvdaNote = "(✨ Ces analyses et niveaux techniques approfondis sont normalement réservés aux membres BOGA Pro/Premium ; débloqués gratuitement pour la présentation NVIDIA ($NVDA).)";
      else if (locale === "pt") nvdaNote = "(✨ Estas análises e níveis técnicos profundos são normalmente exclusivos do BOGA Pro/Premium; desbloqueados gratuitamente para a demonstração da NVIDIA ($NVDA).)";

      contextStr += `ÖZEL TANITIM ENTEGRASYONU (NVDA): NVIDIA ($NVDA) hissesi platformumuzun tüm 5 dildeki BOGA Copilot özel tanıtım hissesidir. Bu hisse için TÜM Premium özellikleri (BOGA AI Skoru, Destek/Direnç/Hedef Seviyeleri, Derin Bilanço ve Kurumsal Aktivite) kısıtlamasız açıktır. Yanıtının başına veya sonuna nazikçe şu notu ekle: "${nvdaNote}"\n\n`;
    }
  } else if (pageContext?.activeListContext?.listKey) {
    contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda "${pageContext.activeListContext.listKey}" liste sayfasındadır. Belirsiz bir istek gelirse bu listeyi kastettiğini varsay, get_top_trending_stocks aracını bu kategoriyle çağır.\n\n`;
  } else if (pageContext?.currentPage?.pageType) {
    contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda "${pageContext.currentPage.pageType}" sayfa türündedir.\n\n`;
  }

  if (personalization.topSectors.length > 0) {
    contextStr += `KULLANICI İLGİ ALANI: En çok ilgilendiği sektörler: ${personalization.topSectors.join(", ")}.\n`;
  }
  if (personalization.watchlistTickers.length > 0) {
    contextStr += `KULLANICININ İZLEME LİSTESİ: ${personalization.watchlistTickers.join(", ")}\n`;
  }
  contextStr += "\n";

  if (master && !master.is_mock) {
    contextStr += `GÜNCEL PİYASA GÖRÜNÜMÜ (${master.date || ""}): Piyasa Rejimi: ${master.market_regime || "N/A"}\n`;
    const sectors = Object.entries((master.sector_summary || {}) as Record<string, any>)
      .sort((a: any, b: any) => ((b[1] as any)?.avg_score ?? 0) - ((a[1] as any)?.avg_score ?? 0))
      .slice(0, 8)
      .map(([n, s]: [string, any]) => `- ${n}: Ort. Skor ${s.avg_score}, Lider Ticker: ${s.top_ticker || "N/A"}`)
      .join("\n");
    if (sectors) contextStr += `SEKTÖR ÖZETİ:\n${sectors}\n\n`;
  }

  contextStr += `KURALLAR:
1. Yanıt yapısı: (a) soruyu doğrudan cevapla, (b) doğrulanmış gerçekleri sun, (c) BOGA değerlendirmesini AYRICA belirterek ekle, (d) varsa risk/teyit koşulunu açıkla, (e) en fazla 3 sonraki adım butonu sun. Uzun özellik listesiyle başlama.
2. Kısa, son derece kibar ve anlaşılır cevaplar ver. Maddeler kullan.
3. Bir hisse sorulduğunda MUTLAKA 'show_stock_card' veya 'get_deep_analysis' aracını çağır.
4. Trend Hisseleri, İzleme Listem, Trend Adayı, Top7 veya Top100 sorulduğunda MUTLAKA 'get_top_trending_stocks' aracını çağır.
5. Yanıtının sonuna MUTLAKA tıklanabilir buton formatında [Buton Metni](copilot-topic://select) ekle (en fazla 3).
6. ARAÇ SONUCU ALDIĞINDA, sonucu kullanıcıya kısa ve net şekilde özetle. Araç çağırdıktan sonra MUTLAKA bir metin yanıtı da üret.
7. Fiyat, teknik seviye, bilanço rakamı, haber, insider işlemi, analist notu veya BOGA Score'u ASLA uydurma — sadece araçlardan dönen gerçek veriyi kullan. Araç veri döndürmezse, bunu dürüstçe belirt.`;

  return contextStr;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages: rawMessages, pageContext, locale: rawLocale } = body;
    const locale = resolveLocale(rawLocale);
    const messages = sanitizeMessages(rawMessages);

    const supabaseAuth = await createSupabaseServerClient();
    const { data: userData } = await supabaseAuth.auth.getUser();
    const user = userData.user;
    if (!user) return new Response("Unauthorized", { status: 401 });

    // Gerçek plan kontrolü — daha önce burada YOK'tu: dailyLimit her zaman
    // premium'a sabitlenmişti ve RPC sonucu hiç okunmadan Gemini çağrılıyordu,
    // yani ücretsiz/plansız hiçbir üye için kota fiilen uygulanmıyordu.
    // /api/copilot/usage ile aynı, tek gerçek kaynak: getMemberAccess().
    const access = await getMemberAccess();
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: ct("noAccess", locale), code: "NO_ACCESS" },
        { status: 403 }
      );
    }
    const dailyLimit = DEFAULT_CREDIT_LIMIT.premium;
    const accessMode: "member" | "expired_member" =
      access.plan && access.plan !== "premium" && access.plan !== "admin" ? "expired_member" : "member";

    try {
      const { data: statusRows } = await supabaseAdmin.rpc("get_copilot_credit_status", {
        p_user_id: user.id,
        p_default_limit: dailyLimit,
      });
      const status = Array.isArray(statusRows) ? statusRows[0] : statusRows;
      if (status && status.current_usage >= status.daily_limit) {
        return NextResponse.json(
          { error: ct("quotaExhausted", locale, { limit: status.daily_limit }), code: "QUOTA_EXHAUSTED" },
          { status: 429 }
        );
      }
    } catch {
      // Kredi servisi geçici erişilemezse sohbeti engelleme — best effort.
    }

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUserMessage?.content) {
      const tickerFromContext: string | null = pageContext?.selectedAsset?.symbol || null;
      logSearchHistory(user.id, String(lastUserMessage.content), tickerFromContext).catch(() => {});
    }

    const systemPrompt = await buildSystemPrompt(pageContext, locale, user.id, accessMode, access.isPremium);

    const tools = {
        get_top_trending_stocks: tool({
          description: "Fetches BOGASTOCK.COM's 5 distinct site lists: Trend Listesi (trend_stocks), Trend Adayı İzleme Listesi (trend_candidate_watchlist), Kişisel İzleme Listesi (user_watchlist), Top 7 (top_7), or Top 100 (top_100). These are five SEPARATE lists — call with the category that matches exactly what the user asked for.",
          parameters: z.object({
            category: z.enum(["trend_stocks", "trend_candidate_watchlist", "user_watchlist", "top_100", "top_7"]).optional(),
          }),
          execute: async ({ category }) => {
            try {
              const cat = (category || "trend_stocks") as SiteListCategory;
              const res = await withTimeout(
                getSiteCategoryStocksList(cat, locale, user.id),
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
              console.error("[get_top_trending_stocks] Error:", err);
              return {
                success: false,
                isFallback: true,
                categoryName: "",
                tickers: [],
                stocks: [],
              };
            }
          },
        }),
        get_cross_asset_quote: tool({
          description: "Fetches live Yahoo Finance price data for a terminal sidebar cross-asset: crypto (Bitcoin/BTC, Ethereum/ETH), FX pairs (EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD), or commodities (Gold, Silver, Oil/WTI, Natural Gas). Do NOT use this for stocks.",
          parameters: z.object({ asset: z.string().describe("Asset name or symbol, e.g. 'bitcoin', 'EURUSD', 'gold'") }),
          execute: async ({ asset }) => {
            try {
              const quote = await withTimeout(getCrossAssetQuote(asset), 6000, null);
              if (!quote) return { success: false, error: ct("noStockData", locale) };
              return { success: true, ...quote };
            } catch (e) {
              return { success: false, error: ct("noStockData", locale) };
            }
          },
        }),
        get_faq_answer: tool({
          description: "Looks up the official BOGASTOCK FAQ knowledge base. Call this when the user asks how the platform works, about membership/pricing/payment/cancellation, free trial, data delay, risk, Stop Loss, or the scoring/scanning system — anything that is a general platform question rather than a specific stock analysis.",
          parameters: z.object({ query: z.string().describe("The user's question, in their own words") }),
          execute: async ({ query }) => {
            try {
              const matches = findFaqMatches(query, locale, 3);
              return { success: matches.length > 0, matches };
            } catch (e) {
              return { success: false, matches: [] };
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
    };

    const userId = user.id;
    const onFinish = async ({ text, toolCalls, toolResults }: any) => {
      try {
        await supabaseAdmin.rpc("increment_copilot_credit", { p_user_id: userId });
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
          { user_id: userId, chat_state: fullTranscript, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      } catch {}
    };

    // Google, model adlarını zaman zaman deprecate ediyor (bugün ikinci kez:
    // sabah gemini-2.5-flash, şimdi gemini-1.5-flash "not found" hatası verdi —
    // bkz. Vercel production logları). Tek bir isme güvenmek yerine, ilk
    // çalışan modeli bulana kadar sırayla dener; bu sınıf hata bir daha
    // tüm Copilot'u kesintiye uğratmasın diye.
    const GEMINI_MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-001"];
    let streamResult: any = null;
    let lastModelError: unknown = null;
    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        streamResult = await streamText({
          model: googleProvider(modelName),
          system: systemPrompt,
          messages,
          tools,
          maxSteps: 3,
          onFinish,
        });
        break;
      } catch (err) {
        lastModelError = err;
        console.error(`[copilot chat] model "${modelName}" failed:`, err instanceof Error ? err.message : err);
      }
    }
    if (!streamResult) throw lastModelError || new Error("All Gemini model candidates failed");

    return streamResult.toDataStreamResponse();
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
