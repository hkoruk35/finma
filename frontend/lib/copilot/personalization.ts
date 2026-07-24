// Kullanıcıya özel bağlam: izleme listesi + arama geçmişi → sektör eğilimi + son aramalar.
// Sadece gerçek, üyeye ait DB verisinden üretilir; hiçbir varsayım/uydurma yok.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { MARKET_THEMES } from "@/lib/themeData";

let _tickerSectorMap: Map<string, string> | null = null;
function getTickerSectorMap(): Map<string, string> {
  if (_tickerSectorMap) return _tickerSectorMap;
  const map = new Map<string, string>();
  for (const theme of MARKET_THEMES) {
    for (const ticker of theme.tickers) {
      if (!map.has(ticker)) map.set(ticker, theme.sector);
    }
  }
  _tickerSectorMap = map;
  return map;
}

export interface PersonalizationContext {
  watchlistTickers: string[];
  topSectors: string[];
  recentQueries: string[];
}

export async function getPersonalizationContext(userId: string): Promise<PersonalizationContext> {
  const [watchlistRes, historyRes] = await Promise.all([
    supabaseAdmin.from("custom_watchlists").select("tickers").eq("user_id", userId).single(),
    supabaseAdmin
      .from("copilot_search_history")
      .select("query, ticker, sector")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const watchlistTickers: string[] = watchlistRes.data?.tickers || [];
  const sectorMap = getTickerSectorMap();
  const sectorCounts = new Map<string, number>();

  // Sektör ağırlıklarını hem izleme listesinden hem de geçmiş aramalardan hesapla
  for (const t of watchlistTickers) {
    const sector = sectorMap.get(t.toUpperCase());
    if (sector) sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 3); // izleme listesi 3x ağırlıklı
  }

  for (const h of historyRes.data || []) {
    if (h.sector) {
      sectorCounts.set(h.sector, (sectorCounts.get(h.sector) || 0) + 1);
    } else if (h.ticker) {
      const s = sectorMap.get(h.ticker.toUpperCase());
      if (s) sectorCounts.set(s, (sectorCounts.get(s) || 0) + 1);
    }
  }

  const topSectors = Array.from(sectorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sector]) => sector);

  const recentQueries: string[] = (historyRes.data || []).map((r: any) => r.query).filter(Boolean);

  return { watchlistTickers, topSectors, recentQueries };
}

export async function logSearchHistory(userId: string, query: string, ticker?: string | null): Promise<void> {
  try {
    const sectorMap = getTickerSectorMap();
    const sector = ticker ? sectorMap.get(ticker.toUpperCase()) || null : null;
    await supabaseAdmin.from("copilot_search_history").insert({
      user_id: userId,
      query: query.slice(0, 300),
      ticker: ticker || null,
      sector,
    });
  } catch {
    // best-effort — arama geçmişi kişiselleştirme içindir, sohbeti bloklamamalı
  }
}

export interface CopilotProfile {
  displayName: string | null;
  avatarId: string;
}

export async function getCopilotProfile(userId: string): Promise<CopilotProfile> {
  const { data } = await supabaseAdmin
    .from("copilot_profiles")
    .select("display_name, avatar_id")
    .eq("user_id", userId)
    .single();
  return { displayName: data?.display_name ?? null, avatarId: data?.avatar_id ?? "aylin" };
}
