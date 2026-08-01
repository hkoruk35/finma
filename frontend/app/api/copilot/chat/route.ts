import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMemberAccess } from "@/lib/apiAuth";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getRealStockCardData, getSiteCategoryStocksList, getThemeStocksList, SiteListCategory } from "@/lib/copilot/stockData";
import { getDeepAnalysis } from "@/lib/copilot/deepAnalysis";
import { getPersonalizationContext, logSearchHistory, getCopilotProfile } from "@/lib/copilot/personalization";
import { getSuggestedName } from "@/lib/copilot/persona";
import { getMasterData } from "@/lib/data";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { getTradePlanSummary } from "@/lib/copilot/liveAnalysis";
import { isRealTicker } from "@/lib/copilot/tickerValidation";
import { ct } from "@/lib/copilot/i18n";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";
import { CopilotPageContext, AssetType } from "@/lib/copilot/pageContextSchema";
import { findFaqMatches } from "@/lib/copilot/faqData";
import { getCrossAssetQuote } from "@/lib/copilot/crossAssetData";
import { getUserTasks, createCopilotTask, TaskType } from "@/lib/copilot/tasksEngine";
import { HOT_THEMES_2026, getHotTheme, localizedThemeTitle } from "@/lib/hotThemes2026";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  "";

const googleProvider = createGoogleGenerativeAI({ apiKey });
const anthropicProvider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

function resolveLocale(raw: any): string {
  return ["tr", "en", "es", "fr", "pt"].includes(raw) ? raw : "en";
}

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

  // HOT_THEMES_2026'dan istek anında üretilir — yeni bir tema eklendiğinde
  // (veya bir slug değiştiğinde) bu blok elle güncellenmeye gerek kalmadan
  // otomatik senkron kalır, ve doğru locale'i kullanır (eskiden hep /tr/
  // yazıp modelden string-replace istemek bir locale hatasıydı).
  const themePagesBlock = HOT_THEMES_2026
    .map((t) => `- /global/${locale}/themes/${t.slug} (${localizedThemeTitle(t.title, locale) || t.title})`)
    .join("\n");

  // Araçlardan dönen veri (kategori adları, haberler, hata mesajları) zaten
  // locale'e göre çevrilmiş geliyor — ama modelin KENDİ üreteceği serbest
  // metin için ayrı, açık bir dil talimatı yoksa (özellikle kısa/belirsiz
  // girişlerde, örn. tek başına bir ticker sembolü) model Türkçeye kayabilir.
  // Bu talimat her zaman en başta, en güçlü vurguyla verilir.
  const LANG_DIRECTIVE: Record<string, string> = {
    tr: "DİL KURALI (EN YÜKSEK ÖNCELİK): Kullanıcının mesajı ne kadar kısa veya belirsiz olursa olsun (örn. sadece bir ticker sembolü veya tek kelime) HER ZAMAN Türkçe yanıt ver.",
    en: "LANGUAGE RULE (HIGHEST PRIORITY): No matter how short or ambiguous the user's message is (e.g. a bare ticker symbol or a single word), ALWAYS respond in English. Never default to Turkish.",
    es: "REGLA DE IDIOMA (MÁXIMA PRIORIDAD): Sin importar cuán corto o ambiguo sea el mensaje del usuario (p. ej. solo un símbolo bursátil o una palabra), responde SIEMPRE en español. Nunca uses turco ni inglés por defecto.",
    fr: "RÈGLE DE LANGUE (PRIORITÉ MAXIMALE) : Quelle que soit la brièveté ou l'ambiguïté du message de l'utilisateur (par ex. un simple symbole boursier ou un seul mot), répondez TOUJOURS en français. Ne basculez jamais vers le turc ou l'anglais par défaut.",
    pt: "REGRA DE IDIOMA (MÁXIMA PRIORIDADE): Não importa quão curta ou ambígua seja a mensagem do usuário (ex.: apenas um símbolo de ação ou uma única palavra), responda SEMPRE em português. Nunca use turco ou inglês por padrão.",
  };

  let contextStr = `${LANG_DIRECTIVE[locale] || LANG_DIRECTIVE.en}

SEN BOGA COPILOT'SUN. Adın "${name}". BOGASTOCK.COM platformunun kibar, profesyonel ve samimi yapay zeka asistanısın. Kullanıcının kendi adını BİLMİYORSUN — asla kendi adınla ("${name}") kullanıcıyı selamlama, adını sadece kendini tanıtırken kullan.

TON VE KİBARLIK KURALI:
- KESİNLİKLE "masasına hoş geldiniz" veya soğuk robotik ifadeler KULLANMA.
- Her zaman son derece kibar, nazik ve anlaşılır bir dille yanıt ver.

TIKLANABİLİR BUTON ZORUNLULUĞU (BİÇİM KESİNLİKLE SABİTTİR):
- HER YANITININ SONUNA KULLANICININ TIKLAYABİLECEĞİ EN FAZLA 3 TIKLANABİLİR YÖNLENDİRME BUTONU EKLE!
- İki buton türü vardır, ASLA başka bir URL/route uydurma, sadece bu iki format kullanılabilir. Parantez içindeki kısım HER ZAMAN AŞAĞIDA YAZDIĞI GİBİ BİREBİR KALIR — asla konuyla ilgili gerçek metin, boşluk veya Türkçe karakter İÇERMEZ:
  1. Takip sorusu butonu: [Buton Metni](copilot-topic://select) — parantez içi HER ZAMAN tam olarak "copilot-topic://select" yazılır (kelimesi kelimesine, değiştirilmez). Tıklanınca köşeli parantezdeki BUTON METNİ yeni bir kullanıcı mesajı gibi gönderilir.
     DOĞRU: [ONDS teknik seviyelerini detaylandır](copilot-topic://select)
     YANLIŞ: [ONDS teknik seviyelerini detaylandır](copilot-topic://ONDS teknik seviyelerini göster) — parantez içine gerçek metin/boşluk KOYMA, link kırılır.
  2. Sayfaya git butonu: [Buton Metni](copilot-list://LIST_KEY) — LIST_KEY sadece şunlardan biri olabilir (boşluksuz, İngilizce, birebir): personal_watchlist, trend_list, trend_candidate_watchlist, top7, top100. Bir TEMA sayfasına gitmek için LIST_KEY yerine "theme_" + tema slug'ı kullanılır (örn. copilot-list://theme_bellek-ureticiler-ai-depolama) — ASLA "theme:" (iki nokta üst üste) KULLANMA, link kırılır.
- Aynı butonu art arda tekrar sunma, bağlama göre değiştir.

BİÇİMLENDİRME (KISA VE TEMİZ TUT):
- Ardışık boş satır bırakma (en fazla tek bir boş satır ile paragraf ayır). Her cümleyi ayrı "başlık" gibi sunup aralarına boşluk koyma — bitişik, akıcı paragraflar veya kısa madde işaretleri kullan.

BEŞ AYRI LİSTE — ASLA BİRBİRİNE KARIŞTIRMA (KESİN KURAL):
BOGASTOCK'ta birbirinden tamamen ayrı 5 liste vardır. "Top 100" bunlardan sadece biridir, VARSAYILAN/TEK liste değildir:
1. Kişisel İzleme Listesi (personal_watchlist) — kullanıcının kendi seçtiği en fazla 50 hisse.
2. Trend Listesi (trend_stocks) — sitenin /swing sayfasındaki taranmış aday havuzu (skora göre sıralı). Her hissenin kendi giriş durumu (ENTERED = teyit tamamlanmış / Bekle = henüz teyit bekliyor) olabilir; hepsi otomatik olarak "teyitli" değildir — kesinlik dili kullanmadan bu ayrımı belirt.
3. Trend Adayı İzleme Listesi (trend_candidate_watchlist) — henüz aktif trend teyidini TAMAMLAMAMIŞ ama sistem radarına girmiş hisseler. Bu listede KESİNLİK DİLİ kullanma ("yakında kesin trende girecek" DEME); sadece "fiyat yapısı olumlu ama hacim teyidi henüz yeterli değil" gibi ihtiyatlı dil kullan.
4. Top 7 (top_7) — sitenin standart, sabit 7 büyük teknoloji/mega-cap hissesi. Kullanıcı Top 7 veya Genel İzleme Listesi sorduğunda sadece sistemdeki bu listeyi KULLAN ve tamamını sun.
5. Top 100 (top_100) — BOGA'nın kürasyonlu, skora göre sıralı 100 hisselik havuzu. Kullanıcı Top 100'ü sorduğunda SADECE en çok işlem gören (en hacimli / highest volume) ilk 3 hisseyi göster.
KULLANICI "TREND HİSSELERİ", "İZLEME LİSTEM", "TREND ADAYLARI", "TOP 7", "TOP 100" DEDİĞİNDE:
- SIFIR HALÜSİNASYON: Asla kafana göre hisse veya veri üretme. Yalnızca sistemden ve araçlardan dönen verileri kullan.
- KESİNLİKLE VE ASLA 'search_market_news' HABER ARACINI ÇAĞIRMA!
- MUTLAKA 'get_top_trending_stocks' ARACINI DOĞRU category parametresiyle ÇAĞIR!
- Araç "isFallback: true" dönerse, ASLA ticker uydurma — kullanıcıya "şu anda bu listeye erişimde geçici bir aksaklık var, birazdan tekrar dener misiniz?" gibi nazik, teknik terim içermeyen bir cümle söyle.
- BİR LİSTE SONUCU GÖSTERDİĞİNDE (isFallback:false), sonuç butonlarından EN AZ BİRİ MUTLAKA o listenin gerçek sayfasını açan [Liste Sayfasını Aç](copilot-list://LIST_KEY) butonu OLMALI — kullanıcıya sadece tek tek hisse linkleri sunup asıl liste sayfasını açma seçeneğini atlama. Kullanıcı zaten bir liste sayfasındaysa (KULLANICI BAĞLAMI'na bak) bunu tekrar önerme.

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

FİNANSAL DİL KISITLAMASI (KESİN KURAL, YANITIN HANGİ DİLDE OLURSA OLSUN GEÇERLİDİR):
- ASLA şu anlama gelen kelimeleri kullanma (yanıtın dilinde karşılığı ne olursa olsun): "garanti/guarantee/garantía/garantie/garantia", "risksiz/risk-free/sin riesgo/sans risque/sem risco", "kesin kâr/guaranteed profit/ganancia segura/profit garanti/lucro garantido", "bu hisse kesinlikle yükselecek/düşecek (this stock will definitely rise/fall, esta acción subirá/bajará con toda seguridad, cette action va certainement monter/baisser, esta ação vai subir/cair com certeza)".
- Bunun yerine: "görünüm ... güçlenebilir", "senaryo ... altında zayıflayabilir", "teyit hâlâ gerekli", "bu seviye izlenmeye değer", "algoritma şu anda ... olarak belirliyor" gibi ihtiyatlı ifadelerin yanıtın dilindeki karşılığını kullan.
- BOGASTOCK bir yatırım danışmanlığı kuruluşu DEĞİLDİR. Nihai işlem kararı, pozisyon büyüklüğü ve risk yönetimi KULLANICIYA aittir — bunu gerektiğinde nazikçe hatırlat.

İŞLEM KURGUSU / TRADE PLAN KURALI (KESİN, TEK KAYNAK — SİTE İLE BİREBİR TUTARLILIK):
- Kullanıcı bir hissenin işlem kurgusunu, giriş/giriş aralığını, giriş tetiğini (trigger), stop-loss'unu, hedef (TP1/TP2/TP3) seviyelerini veya risk/ödül oranını sorduğunda MUTLAKA 'get_trade_plan' aracını çağır. Bu araç, o hissenin kendi Grafik/Detay sayfasındaki "İŞLEM KURGUSU GEREKÇESİ" bloğuyla BİREBİR AYNI motordan (tek kaynak) gelir.
- BU ARAÇ DIŞINDA ASLA giriş/stop/hedef sayısı üretme veya "X direncinin üzerinde kalıcılık" gibi kendi kurguladığın bir tetik seviyesi uydurma — 'get_technical_levels'ın nearestSupport/nearestResistance alanları GENEL pivot seviyeleridir, işlem kurgusu için KULLANILMAZ ve gerçek giriş/stop/hedef ile ÇELİŞEBİLİR.
- Aracın döndürdüğü entryLow–entryHigh HER ZAMAN bir ARALIK olarak sunulur (tek nokta değil); avgEntry sadece aralığın orta noktasıdır, tek başına "giriş fiyatı" gibi sunma. stopPrice/stopRationale ve targets[] (TP1-3) ile birlikte, varsa entryCondition ve rationale (EMA/VWAP/hacim/RSI) metinlerini KENDİ CÜMLENLE ÖZETLEYEBİLİRSİN ama rakamları asla değiştirme.
- Araç "valid:false" dönerse (net bir uzun pozisyon kurgusu yok), rakam uydurmadan "şu anda aktif/net bir işlem kurgusu bulunmuyor, teknik yapı izleme seviyesinde" gibi dürüst bir ifade kullan.

VERİ TAZELİĞİ VE TARİH DİLİ (KESİN KURAL):
- ŞU ANKİ YIL 2026'dır. Donald Trump mevcut ABD Başkanıdır. ASLA "eski başkan" (former president) ifadesini kullanma.
- SUNUCU ZAMANI (UTC): ${new Date().toISOString()}. Kullanıcı güncel saat veya takvim sorarsa bu zamanı baz alarak hesapla. Dünya başkentleri saatleri sorulduğunda veya genel saat listesi istendiğinde, HER ZAMAN listeye "İstanbul, Türkiye" saatini de ekle.
- Teknik/fiyat verisi için ASLA "anlık", "gerçek zamanlı" DEME. Bunun yerine "güncel piyasa görünümü", "yaklaşık 15 dakika gecikmeli fiyat verisi", "saatlik teknik güncelleme" gibi ifadeler kullan.
- Haber verisi daha güncel olabilir; fiyat verisiyle aynı zaman damgası altında sunma.

SSS (SIKÇA SORULAN SORULAR) — KESİN KURAL:
- Kullanıcı platformun nasıl çalıştığını, üyeliği, fiyatı, ödemeyi, iptali, ücretsiz denemeyi, veri gecikmesini, riski veya Stop Loss'u sorarsa MUTLAKA 'get_faq_answer' aracını çağır.
- Araç bir eşleşme döndürürse, o resmi cevabı KENDİ CÜMLELERİNLE ÖZETLEMEDEN, anlamını DEĞİŞTİRMEDEN aktar (gerekirse kısalt ama fiyat/ödeme/iptal/risk rakamlarını ve ifadelerini birebir koru). Bu resmi metinleri asla kendi yorumunla uydurma veya değiştirme.
- Araç eşleşme bulamazsa, konuyu bilmediğini dürüstçe belirt ve destek sayfasına yönlendir.

HİSSE ANALİZ AKIŞI (STRATEJİ KONSEYİ MOD) — BİR HİSSE SEÇİLDİĞİNDE:
Kullanıcı bir hisse hakkında analiz istediğinde, ASLA "analiz hazır" demeyin — sorularla ilerlemeyi tercih edin:
A. AÇ BELIRLEME (Stratejileri bilmem için gerekli):
   - Kısa vadeli ticaret (1-7 gün) / Swing ticareti (7-30 gün) / Pozisyon alımı (30-720 gün) / Uzun vadeli yatırım (2y+)
   Seçilirse, zaman dilimindeki TÜM parametreleri (support/resistance/target, OHLC, volume) anımsa.

B. ZAMAN DİLİMİ SEÇME (Grafik Analizi):
   - Günlük (1D) zaman dilimi → Uzun vadeli/orta vadeli trend ve genel teknik yapı
   - 4 Saatlik (4H) zaman dilimi → Kısa vadeli pozisyon ve scalping bağlamı
   Kullanıcı seçince, MUTLAKA 'get_technical_levels' aracını ilgili ticker ve timeframe ile çağır. Ama somut bir GİRİŞ NOKTASI/ARALIĞI, stop veya hedef sorulursa (veya bu akış "işlem kurgusu" sorusuna bağlıysa), bunun için AYRICA 'get_trade_plan' aracını çağır — get_technical_levels'ın seviyeleri bunun yerine geçmez.

C. MUM PADERNİ VE HACİM ANALİZİ:
   - Son 5-20 mumun paternini, hacim profilini, breakout/breakdown sinyallerini analiz et.
   - Büyük kurumsal bloklar var mı? Volume profile kaymış mı?
   - Potansiyel confluence'lar (trend line kesişimi + moving average + support) var mı?

D. DÖNEM SEÇİM (Daha geniş bağlam):
   - "Son 1 haftalık / Son 1 aylık / Son 3 aylık / Yılbaşından itibaren / Son 1 yıl / Son 5 yıl analizi" istiyorum derse
   - Verilen periode göre trend, direnç/destek, breakout historysi özetleyin — asla veri uydurma, sadece araçlardan dön veriyi kullan.

E. FİNANSAL ANALIZ (Sadece hisseler):
   - Bilanço analizi (P/E, PEG, fiyat/kitap, borç/özkaynaklar)
   - Kurumsal aktivite (insider alım/satım)
   - Haberler takvimi ve son gelişmeler (link üret)
   - Tahmin ve analist revizyon notu (varsa)

F. SEKTÖREL VE RAKIP ANALİZİ (Sadece hisseler):
   - Sektörün önde gelen firmaların gidişatı nasıl? (kısa vs. güçlü mü?)
   - Rakiplerinin bilanço tarihleri ve olumsuz haber riski
   - Sektörden yeni IPO veya işbirliği haberleri
   - Bu hisse, sektör ortalamasına göre nasıl sıralanıyor?

BU AKIŞ TAMAMLANMADAN SEÇİM SUNMA (3 buton): ASLA haber aracı çağırma veya başka hisseyi önermeme. Akış sırasında içinde kalınmalı.

TEMA SORULARI AKIŞI:
Kullanıcı tematik sorular sorarsa ("yapay zeka hisseleri neler?", "savunma sanayii ile ilgili ne önerirsin?", "hangi temalar var?"), veya KULLANICI BAĞLAMI bir tema sayfasında olduğunu gösteriyorsa:
1. TEMA İDENTİFİKASYON: Sorudaki anahtar kelimelerden veya KULLANICI BAĞLAMI'ndaki temadan hangi temaya ait olduğunu anla; aşağıdaki TEMA SAYFALARI listesindeki slug'ı kullan.
2. TEMA HİSSELERİ: MUTLAKA 'get_theme_stocks' aracını doğru themeSlug ile çağır — ASLA kendi genel bilginden ticker uydurma, sadece aracın döndürdüğü gerçek tickers/stocks listesini kullan. Araç "isFallback: true" dönerse (tema bulunamadı), kullanıcıya dürüstçe belirt.
3. TEMA LİSTELEME: Temalardaki tüm hisseler zaten sistemde mevcuttur. Aracın döndürdüğü hisselerin TAMAMINI eksiksiz olarak kullanıcıya sun. Her birini BOGA Skoruna veya teknik durumuna göre kısaca özetle.
4. YÖNLENDİR: "[Tüm Tema Stokları](copilot-list://theme_THEME_SLUG)" butonu ile tema sayfasına yönlendir (THEME_SLUG'ı gerçek metinle değiştir, "theme:" değil "theme_" kullan).

TEMA SAYFALARI (bu liste her istek anında güncel HOT_THEMES_2026 verisinden üretilir):
${themePagesBlock}

GÖREV/UYARI ÖNERİSİ AKIŞI (İSTEĞE BAĞLI, ASLA VARSAYMA):
BOGASTOCK'ta kullanıcının bir listeyi veya temayı arka planda izleyip değişiklik olunca haber veren bir görev sistemi vardır (Trend Listesi, Trend Adayı İzleme Listesi, Top7, Top100, Kişisel İzleme Listesi, veya belirli bir tema). Bir liste/tema sonucu gösterdikten SONRA, uygunsa (kullanıcı zaten benzer bir görev kurmadıysa) TEK bir nazik öneri sunabilirsin, örn. "Bu listeye yeni hisse eklenince haber vereyim mi?" — bunu [Evet, haber ver](copilot-topic://select) butonuyla sun. Kullanıcı bir SONRAKİ mesajında onaylarsa (örn. "evet", "haber ver"), MUTLAKA 'create_watch_task' aracını doğru taskType (ve tema ise themeSlug) ile çağır. Kullanıcı onaylamadan ASLA görev oluşturma. Aynı öneriyi art arda tekrar sunma.

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
  } else if (pageContext?.activeTheme) {
    contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda "${pageContext.activeTheme.title}" tema sayfasındadır (themeSlug: "${pageContext.activeTheme.slug}"). Belirsiz bir istek gelirse bu temayı kastettiğini varsay, get_theme_stocks aracını bu themeSlug ile çağır.\n\n`;
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
3. Bir hisse sorulduğunda MUTLAKA 'show_stock_card' veya 'get_deep_analysis' aracını çağır ve HİSSE ANALİZ AKIŞI'nı başlat. Hisse analizi istediğinde (amaç/zaman dilimi/teknik/finansal/sektörel), bu akış TAMAMLANMADAN başka hisseyi önerme veya haber aracı çağırma.
4. Trend Hisseleri, İzleme Listem, Trend Adayı, Top7 veya Top100 sorulduğunda MUTLAKA 'get_top_trending_stocks' aracını çağır.
5. Yanıtının sonuna MUTLAKA tıklanabilir buton formatında [Buton Metni](copilot-topic://select) ekle (en fazla 3).
6. ARAÇ SONUCU ALDIĞINDA, sonucu kullanıcıya kısa ve net şekilde özetle. Araç çağırdıktan sonra MUTLAKA bir metin yanıtı da üret.
7. Fiyat, teknik seviye, bilanço rakamı, haber, insider işlemi, analist notu veya BOGA Score'u ASLA uydurma — sadece araçlardan dönen gerçek veriyi kullan. Araç veri döndürmezse, bunu dürüstçe belirt.
8. İşlem kurgusu/giriş/stop/hedef sorulduğunda MUTLAKA 'get_trade_plan' aracını çağır — bkz. yukarıdaki İŞLEM KURGUSU / TRADE PLAN KURALI. Bu araç dışında başka bir araçtan (ör. get_technical_levels) türetilmiş sayılarla işlem kurgusu ANLATMA.`;

  return contextStr;
}

export async function POST(req: NextRequest) {
  // catch bloğunun da doğru dilde hata dönebilmesi için try dışında,
  // gövdeyi henüz okuyamadan patlarsa bile güvenli bir varsayılanla tutulur.
  let locale = "en";
  try {
    const body = await req.json();
    const { messages: rawMessages, pageContext, locale: rawLocale } = body;
    locale = resolveLocale(rawLocale);
    const messages = sanitizeMessages(rawMessages);

    const supabaseAuth = await createSupabaseServerClient();
    const { data: userData } = await supabaseAuth.auth.getUser();
    const user = userData.user;
    if (!user) return new Response("Unauthorized", { status: 401 });

    // Gerçek plan kontrolü — /api/copilot/usage ile aynı, tek gerçek kaynak: getMemberAccess().
    const access = await getMemberAccess();
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: ct("noAccess", locale), code: "NO_ACCESS" },
        { status: 403 }
      );
    }
    const accessMode: "member" | "expired_member" =
      access.plan && access.plan !== "premium" && access.plan !== "admin" ? "expired_member" : "member";

    // Kredi kontrolü — admin (staff comp) haric, en ucuz sorgu tipinin (Fast
    // Answer = 1 kredi) maliyetini bile karsilayamayan uye sohbete baslayamaz.
    // Asil dusum (1 veya 5 kredi, sorgu tipine gore) onFinish'te, gercek yanit
    // uretildikten sonra consume_credits() ile yapilir — bkz. 0020_usage_credits.sql.
    if (access.plan !== "admin" && access.monthlyCredits + access.topupCredits < 1) {
      return NextResponse.json(
        { error: ct("quotaExhausted", locale, { limit: 0 }), code: "INSUFFICIENT_CREDITS", topup_url: "/api/members/credits/topup-checkout" },
        { status: 402 }
      );
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
        get_theme_stocks: tool({
          description: "Fetches the REAL, curated ticker list for one of BOGASTOCK's thematic investment pages (e.g. AI Defense, Memory Producers, Biotech, Quantum Computing) from HOT_THEMES_2026 — the same data shown on the theme's public page. ALWAYS call this before naming any tickers for a theme; never recall theme tickers from general knowledge.",
          parameters: z.object({
            themeSlug: z.string().describe("The theme's slug from the TEMA SAYFALARI list, e.g. 'bellek-ureticiler-ai-depolama'"),
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
              console.error("[get_theme_stocks] Error:", err);
              return {
                success: false,
                isFallback: true,
                themeName: "",
                themeSlug,
                tickers: [],
                totalCount: 0,
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
              const quote = await withTimeout(getCrossAssetQuote(asset, locale), 6000, null);
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
              // 5000ms yetersizdi: RSS çekme (2500ms) + başlık çevirisi (4000ms) art
              // arda çalışabiliyor, dış timeout erken keserse haberler tamamen
              // kaybolurdu (boş [] dönerdi) — 8000ms ikisine de yetecek pay bırakır.
              const news = await withTimeout(fetchLiveMarketNews(query, locale), 8000, []);
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
          description: "Fetches live price, support/resistance, RSI(14), 5-day trends, volume vs average percentage, and Weinstein stage. Do NOT use this tool's support/resistance numbers to describe a trade setup/entry/stop/target — call 'get_trade_plan' for that instead.",
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
        get_trade_plan: tool({
          description: "Fetches BOGASTOCK's single-source trade plan for a stock — the EXACT same entry zone, stop-loss, TP1-3 targets, and EMA/VWAP/volume/RSI rationale text shown in the 'İŞLEM KURGUSU GEREKÇESİ' section of the stock's own chart/detail page. This is the ONLY allowed source for describing a trade setup, entry trigger, stop-loss, or profit target for a stock — never derive these from get_technical_levels or your own reasoning.",
          parameters: z.object({ ticker: z.string() }),
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
        create_watch_task: tool({
          description: "Creates a background watch task that alerts the user when one of BOGASTOCK's lists or a specific theme changes (new tickers enter/leave). ONLY call this after the user has explicitly confirmed they want the notification (e.g. they said 'evet'/'yes' to a suggestion) — never call it speculatively.",
          parameters: z.object({
            taskType: z.enum([
              "trend_list_change_watch",
              "trend_candidate_promotion_watch",
              "top7_change_watch",
              "top100_change_watch",
              "personal_watchlist_daily_watch",
              "theme_list_change_watch",
            ] as [TaskType, ...TaskType[]]),
            themeSlug: z.string().optional().describe("Required only when taskType is 'theme_list_change_watch' — the theme's slug"),
          }),
          execute: async ({ taskType, themeSlug }) => {
            const noAccessMsg: Record<string, string> = {
              tr: "Üyeliğiniz şu anda aktif değil, yeni bir izleme görevi oluşturulamıyor.",
              en: "Your membership isn't currently active, so a new watch task can't be created.",
              es: "Tu membresía no está activa actualmente, no se puede crear una nueva tarea de seguimiento.",
              fr: "Votre abonnement n'est pas actif actuellement, impossible de créer une nouvelle tâche de suivi.",
              pt: "Sua assinatura não está ativa no momento, não é possível criar uma nova tarefa de acompanhamento.",
            };
            if (accessMode === "expired_member") {
              return { success: false, error: noAccessMsg[locale] || noAccessMsg.en };
            }

            try {
              const subject = taskType === "theme_list_change_watch" ? (themeSlug || "").trim() : undefined;

              if (taskType === "theme_list_change_watch") {
                if (!subject || !getHotTheme(subject)) {
                  const unknownThemeMsg: Record<string, string> = {
                    tr: "Bilinmeyen tema slug'ı — önce doğru slug'ı teyit etmek için get_theme_stocks aracını çağır.",
                    en: "Unknown theme slug — call get_theme_stocks first to confirm the correct slug.",
                    es: "Slug de tema desconocido — llama primero a get_theme_stocks para confirmar el slug correcto.",
                    fr: "Slug de thème inconnu — appelez d'abord get_theme_stocks pour confirmer le bon slug.",
                    pt: "Slug de tema desconhecido — chame get_theme_stocks primeiro para confirmar o slug correto.",
                  };
                  return { success: false, error: unknownThemeMsg[locale] || unknownThemeMsg.en };
                }
              }

              const existingTasks = await withTimeout(getUserTasks(user.id), 3000, []);
              const existing = existingTasks.find((t) => t.task_type === taskType && (t.subject || "") === (subject || ""));
              if (existing) {
                return { success: true, alreadyExists: true, task: existing };
              }

              const task = await createCopilotTask(user.id, taskType, subject, locale);
              return { success: true, alreadyExists: false, task };
            } catch (err) {
              console.error("[create_watch_task] Error:", err);
              return { success: false, error: ct("noStockData", locale) };
            }
          },
        }),
    };

    const userId = user.id;
    const onFinish = async ({ text, toolCalls, toolResults }: any) => {
      try {
        if (access.plan !== "admin") {
          const isDeepResearch = Array.isArray(toolCalls) && toolCalls.some((tc: any) => tc.toolName === "get_deep_analysis");
          await supabaseAdmin.rpc("consume_credits", {
            p_user_id: userId,
            p_amount: isDeepResearch ? 5 : 1,
            p_query_type: isDeepResearch ? "DEEP_RESEARCH" : "FAST_ANSWER",
          });
        }
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
          // HİSSE ANALİZ AKIŞI gibi durumlarda model art arda 2 araç çağırıp
          // (örn. get_deep_analysis + get_technical_levels) 3. adımda bütçe
          // dolduğunda hiç metin üretemeden duruyordu — kullanıcıya toolInvocation
          // kartı olmayan araçlar için tamamen BOŞ bir balon olarak görünüyordu
          // ("basit sorularda takılıyor" hatası). 6 adım, 2-3 araç çağrısı +
          // son metin/butonlar için yeterli pay bırakır.
          maxSteps: 6,
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
        error: ct("genericError", locale),
        code: "GRACEFUL_RECOVERY",
      },
      { status: 500 }
    );
  }
}
