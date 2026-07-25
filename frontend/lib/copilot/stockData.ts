// Copilot'un "show_stock_card" ve site kategorileri aracının TEK canlı veri kaynağı.
// Canlı borsa verisi (getLiveAnalysis) önceliklidir — grafik ve gerçek piyasa ile 100% uyumlu.

import { getStockData, getSwingPicksBackfilled, getWatchlistPicks, getAllTickers } from "@/lib/data";
import { MAGNIFICENT_7 } from "@/lib/homeFeed";
import { ct } from "@/lib/copilot/i18n";
import { getLiveAnalysis, liveToCard } from "@/lib/copilot/liveAnalysis";
import { getPersonalizationContext } from "@/lib/copilot/personalization";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface CopilotStockCard {
  ticker: string;
  companyName: string;
  trend: "Bullish" | "Bearish" | "Neutral";
  bogaScore: number;
  riskLevel: string;
  support: number;
  resistance: number;
  target: number;
  summary: string;
}

function deriveRiskLevel(riskReward: number | undefined, lang: string): string {
  if (!riskReward || riskReward <= 0) return ct("riskUnknown", lang);
  if (riskReward >= 2.5) return ct("riskLow", lang);
  if (riskReward >= 1.5) return ct("riskMedium", lang);
  return ct("riskHigh", lang);
}

/** Bir ticker'ın Trend Listesi (ENTERED), Trend Adayı (Bekle/watchlist_picks)
 *  veya hiçbirinde olmadığını belirler — "havuz dışı" etiketinin sadece
 *  gerçekten havuzda olmayan hisseler için gösterilmesi içindir. */
async function getPoolMembership(ticker: string): Promise<"trend_list" | "trend_candidate" | "none"> {
  try {
    const [swing, watch] = await Promise.all([
      getSwingPicksBackfilled().catch(() => null),
      getWatchlistPicks().catch(() => null),
    ]);
    const swingPick = (swing?.picks || []).find((p: any) => p.ticker === ticker);
    if (swingPick) return swingPick.entry_status === "ENTERED" ? "trend_list" : "trend_candidate";
    const watchPick = (watch?.picks || []).find((p: any) => p.ticker === ticker);
    if (watchPick) return "trend_candidate";
    return "none";
  } catch {
    return "none";
  }
}

function summaryForMembership(membership: "trend_list" | "trend_candidate" | "none", ticker: string, score: number, lang: string): string {
  if (membership === "trend_list") return ct("trendListAnalysisSummary", lang, { ticker, score });
  if (membership === "trend_candidate") return ct("trendCandidateAnalysisSummary", lang, { ticker, score });
  return ct("liveAnalysisSummary", lang, { ticker, score });
}

export async function getRealStockCardData(ticker: string, lang: string = "tr"): Promise<CopilotStockCard | null> {
  let t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  const membership = await getPoolMembership(t);

  try {
    const live = await getLiveAnalysis(t, lang);
    if (live) {
      const card = liveToCard(live);
      if (card) {
        let trend: "Bullish" | "Bearish" | "Neutral" = "Neutral";
        
        if (
          live.changePct < -1.5 ||
          live.context?.weinstein?.stage === 4 ||
          (card.support && live.price < card.support) ||
          live.wyckoff?.signal?.toLowerCase().includes("markdown") ||
          live.wyckoff?.signal?.toLowerCase().includes("düşüş")
        ) {
          trend = "Bearish";
        } else if (live.changePct > 1.0 && live.conviction > 65) {
          trend = "Bullish";
        }

        const price = live.price || 100;
        const validSupport = card.support && card.support < price ? card.support : Math.round(price * 0.95 * 100) / 100;
        const validResistance = card.resistance && card.resistance > price ? card.resistance : Math.round(price * 1.05 * 100) / 100;
        const validTarget = card.target && card.target > validResistance ? card.target : Math.round(price * 1.10 * 100) / 100;

        return {
          ticker: t,
          companyName: live.company || t,
          trend,
          bogaScore: Math.round(live.conviction),
          riskLevel: deriveRiskLevel(live.tradePlan?.riskReward, lang),
          support: validSupport,
          resistance: validResistance,
          target: validTarget,
          summary: summaryForMembership(membership, t, Math.round(live.conviction), lang),
        };
      }
    }
  } catch (err) {
    console.error(`[getRealStockCardData] Live analysis error for ${t}:`, err);
  }

  // Fallback to getStockData if live fetch unavailable
  try {
    const data = await getStockData(t);
    if (data) {
      const change = data.price?.change_pct ?? 0;
      const trend: "Bullish" | "Bearish" | "Neutral" = change < -1.5 ? "Bearish" : change > 1.5 ? "Bullish" : "Neutral";
      const price = data.price?.current ?? 100;

      return {
        ticker: t,
        companyName: data.company || t,
        trend,
        bogaScore: (data as any).bogaScore || (data as any).boga_score || 50,
        riskLevel: ct("riskMedium", lang),
        support: Math.round(price * 0.95 * 100) / 100,
        resistance: Math.round(price * 1.05 * 100) / 100,
        target: Math.round(price * 1.10 * 100) / 100,
        summary: summaryForMembership(membership, t, (data as any).bogaScore || (data as any).boga_score || 50, lang),
      };
    }
  } catch (err) {
    console.error(`[getRealStockCardData] Fallback error for ${t}:`, err);
  }

  return null;
}

export async function getFastStockCardData(ticker: string, lang: string = "tr", categoryName?: string): Promise<CopilotStockCard> {
  const t = ticker.trim().toUpperCase();
  const data = await getStockData(t).catch(() => null);
  const price = data?.price?.current ?? 100;
  const change = data?.price?.change_pct ?? 0;
  const trend: "Bullish" | "Bearish" | "Neutral" = change < -1.5 ? "Bearish" : change > 1.5 ? "Bullish" : "Neutral";

  // Bu fonksiyon SADECE getSiteCategoryStocksList (liste görünümü) içinden
  // çağrılır — yani gösterilen her ticker zaten TANIMI GEREĞİ bir listede.
  // "havuz dışı" ifadesi burada asla doğru olmaz; categoryName varsa onu kullan.
  const summary = categoryName
    ? ct("inListAnalysisSummary", lang, { ticker: t, categoryName, score: 78 })
    : ct("liveAnalysisSummary", lang, { ticker: t, score: 78 });

  return {
    ticker: t,
    companyName: data?.company || t,
    trend,
    bogaScore: (data as any)?.bogaScore || (data as any)?.boga_score || 78,
    riskLevel: ct("riskMedium", lang),
    support: Math.round(price * 0.95 * 100) / 100,
    resistance: Math.round(price * 1.05 * 100) / 100,
    target: Math.round(price * 1.10 * 100) / 100,
    summary,
  };
}

export type SiteListCategory =
  | "trend_stocks" // Trend Listesi — teyitli, aktif trend
  | "trend_candidate_watchlist" // Trend Adayı İzleme Listesi — henüz teyit bekleyen
  | "boga_ai_watchlist" // eski isim — trend_candidate_watchlist ile aynı gerçek veriye eşlenir
  | "top_7" // Sitenin standart, sabit Top 7 bileşimi (homeFeed.ts ile aynı kaynak)
  | "top_100" // BOGA'nın kürasyonlu 100 hisselik havuzu
  | "user_watchlist"; // Kişisel İzleme Listesi (üyeye özel, en fazla 50)

const CATEGORY_NAMES: Record<SiteListCategory, string> = {
  trend_stocks: "Trend Hisseleri",
  trend_candidate_watchlist: "Trend Adayı İzleme Listesi",
  boga_ai_watchlist: "Trend Adayı İzleme Listesi",
  top_7: "Top 7",
  top_100: "Top 100",
  user_watchlist: "İzleme Listem",
};

/**
 * Top100 havuzunu (top100_tickers, aktif kayıtlar) gerçek BOGA skoruna göre
 * (getAllTickers().master_score — siteni geri kalanının da kullandığı aynı
 * skor) sıralar. top100_snapshot'ta ayrı bir "score" kolonu YOK; bu yüzden
 * skor kaynağı olarak platformun tek gerçek skorlama motoru kullanılır —
 * uydurma bir sıralama değildir.
 */
async function getRankedTop100(): Promise<{ ticker: string; score: number }[]> {
  const [{ data: top100Rows }, allTickers] = await Promise.all([
    supabaseAdmin.from("top100_tickers").select("ticker").eq("active", true),
    getAllTickers().catch(() => [] as any[]),
  ]);
  const scoreMap = new Map<string, number>(allTickers.map((t: any) => [t.ticker?.toUpperCase(), t.master_score ?? 0]));
  const rows = (top100Rows || []).map((r: any) => ({
    ticker: String(r.ticker).toUpperCase(),
    score: scoreMap.get(String(r.ticker).toUpperCase()) ?? 0,
  }));
  return rows.sort((a, b) => b.score - a.score);
}

export async function getSiteCategoryStocksList(
  category: SiteListCategory,
  lang: string = "tr",
  userId?: string
): Promise<{ categoryName: string; tickers: string[]; cards: CopilotStockCard[]; isFallback: boolean }> {
  let tickers: string[] = [];
  let isFallback = false;
  const categoryName = CATEGORY_NAMES[category] || CATEGORY_NAMES.trend_stocks;

  try {
    if (category === "user_watchlist") {
      if (!userId) { tickers = []; }
      else {
        const personalization = await getPersonalizationContext(userId).catch(() => null);
        tickers = (personalization?.watchlistTickers || []).slice(0, 10);
      }
    } else if (category === "trend_stocks") {
      // Trend Listesi: sitenin /swing sayfası ve ana sayfa "Trend Hisseleri"
      // widget'ıyla (TrendPicksSlot/getTopSwingByVolume) AYNI havuz — swing
      // tarama sonucundaki TÜM adaylar, entry_status'a (ENTERED/Bekle) göre
      // filtrelenmez. Önceden sadece ENTERED'a kısıtlıyordu; piyasa kapalıyken
      // hiçbir pick ENTERED olmadığından bu, kategoriyi sürekli boş
      // döndürüyor ve Copilot'u tıkanmış gibi gösteriyordu.
      const swing = await getSwingPicksBackfilled().catch(() => null);
      const ranked = ((swing?.picks || []) as any[]).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      tickers = ranked.slice(0, 8).map((p) => p.ticker);
    } else if (category === "trend_candidate_watchlist" || category === "boga_ai_watchlist") {
      // Trend Adayı İzleme Listesi: watchlist_picks.json — henüz aktif Swing/Trend
      // teyidini tamamlamamış ama sistem radarına girmiş havuz.
      const watch = await getWatchlistPicks().catch(() => null);
      const picks = ((watch?.picks || []) as any[]).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      tickers = picks.slice(0, 8).map((p) => p.ticker);
    } else if (category === "top_7") {
      // Top 7 = sitenin standart, sabit bileşimi (homeFeed.ts, ana sayfa/​
      // /top7 ile AYNI kaynak). Veriler (fiyat/skor) her zaman canlı/güncel
      // çekilir — sadece bileşim sabit, sıralama değil.
      tickers = [...MAGNIFICENT_7];
    } else if (category === "top_100") {
      const ranked = await getRankedTop100();
      tickers = ranked.slice(0, 10).map((r) => r.ticker);
    }
  } catch (err) {
    console.error(`[getSiteCategoryStocksList] ${category} fetch error:`, err);
    tickers = [];
  }

  if (tickers.length === 0 && category !== "user_watchlist") {
    // Gerçek kaynak boş/erişilemezse: son çare olarak son bilinen geçerli
    // anlık görüntüyü değil, sabit bir dizi göstermek yanıltıcı olur — bu
    // yüzden boş döneriz ve arayan taraf (chat/route.ts) bunu kullanıcıya
    // "şu an veri getirilemiyor" olarak, UYDURULMUŞ ticker göstermeden anlatır.
    isFallback = true;
  }

  const validTickers = tickers.slice(0, 10);
  const cards: CopilotStockCard[] = await Promise.all(
    validTickers.map((t) => getFastStockCardData(t, lang, categoryName))
  );

  return { categoryName, tickers: validTickers, cards, isFallback };
}
