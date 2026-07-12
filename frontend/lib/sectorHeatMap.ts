import type { StockQuickView } from "@/lib/data";

// Sector Heat Map'in render sirasi ve sektor basi gosterilen ticker sayisi.
// SectorHeatMap.tsx (render) ve lib/homeFeed.ts (hangi ticker'lara canli
// fiyat overlay'i gerektigini belirlemek icin) ayni mantigi kullanir —
// ikisi ayri sekilde uygulanirsa, overlay edilen ticker'lar gosterilenlerle
// eslesmeyebilir.
export const SECTOR_ORDER = [
  "Technology", "Financials", "Healthcare", "Consumer Discretionary",
  "Communication Services", "Industrials", "Energy", "Consumer Staples",
  "Real Estate", "Materials", "Utilities",
];

export const TOP_PER_SECTOR = 12;

export function groupBySector(allTickers: StockQuickView[]): Record<string, StockQuickView[]> {
  const sorted = [...allTickers].sort(
    (a, b) => (b.volume ?? b.avg_volume_30d ?? b.master_score) - (a.volume ?? a.avg_volume_30d ?? a.master_score)
  );
  const groups: Record<string, StockQuickView[]> = {};
  sorted.forEach((t) => {
    const s = t.sector || "Other";
    if (!groups[s]) groups[s] = [];
    groups[s].push(t);
  });
  return groups;
}

// Sektor basina ilk N (hacme gore) ticker'i duz bir listede dondurur — heat
// map'in gercekte gosterecegi ticker kumesi budur, canli fiyat overlay'i
// icin sadece bunlara ihtiyac var (binlerce ticker'in tamami degil).
export function selectHeatMapTickers(allTickers: StockQuickView[]): StockQuickView[] {
  const groups = groupBySector(allTickers);
  const activeSectors = SECTOR_ORDER.filter((s) => groups[s]?.length > 0);
  return activeSectors.flatMap((s) => groups[s].slice(0, TOP_PER_SECTOR));
}
