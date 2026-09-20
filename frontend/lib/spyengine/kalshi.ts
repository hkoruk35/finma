/**
 * Kalshi — S&P 500 kapanış seviyesi dağılımı (KXINX serisi, halka açık, auth yok).
 *
 * Her market bir ARALIK KOVASIDIR: "S&P 500 kapanış [floor, cap] arasında mı?"
 * (25 puan genişlik). YES orta fiyatı ≈ P(kapanış ∈ kova). Kovalar birlikte bir
 * olasılık dağılımı verir; buradan ima edilen beklenen kapanış (olasılık-ağırlıklı
 * ortalama) ve bir seviyeyi geçme olasılığı çıkarılır. Veri gelmezse null — uydurma yok.
 *
 * SADECE SUNUCU tarafında çağrılır (route). Tahmin girdisidir, ölçüm değil.
 */

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

export interface KalshiBucket {
  center: number;
  floor: number;
  cap: number;
  prob: number;
}

export interface KalshiLadder {
  eventTicker: string;
  closeTimeUtc: string;
  buckets: KalshiBucket[];
  /** Olasılık-ağırlıklı beklenen kapanış (SPX) */
  impliedCloseSpx: number | null;
  /** En yüksek olasılıklı kova merkezi (mod) */
  modeCloseSpx: number | null;
}

interface KalshiMarket {
  event_ticker?: string;
  close_time?: string;
  floor_strike?: number;
  cap_strike?: number;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

function nyDateOf(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/**
 * Hedef seans tarihi (NY, YYYY-MM-DD) için KXINX kapanış dağılımını çeker.
 */
export async function fetchKalshiSpxLadder(targetDateEt: string): Promise<KalshiLadder | null> {
  try {
    const res = await fetch(
      `${KALSHI_BASE}/markets?status=open&series_ticker=KXINX&limit=400`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(9000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const markets: KalshiMarket[] = Array.isArray(json?.markets) ? json.markets : [];
    if (!markets.length) return null;

    const forDay = markets.filter((m) => m.close_time && nyDateOf(m.close_time) === targetDateEt);
    if (!forDay.length) return null;

    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const buckets: KalshiBucket[] = [];
    for (const m of forDay) {
      const floor = num(m.floor_strike);
      const cap = num(m.cap_strike);
      if (floor == null) continue;
      // Kenar kovalar (üstü açık/altı açık) cap/floor eksik olabilir → ~25 puan varsay.
      const lo = floor;
      const hi = cap ?? floor + 25;
      const bid = num(m.yes_bid_dollars);
      const ask = num(m.yes_ask_dollars);
      const last = num(m.last_price_dollars);
      let prob: number | null = null;
      if (bid != null && ask != null && ask > 0) prob = (bid + ask) / 2;
      else if (last != null && last > 0) prob = last;
      if (prob == null) continue;
      buckets.push({ center: (lo + hi) / 2, floor: lo, cap: hi, prob: Math.max(0, Math.min(1, prob)) });
    }
    if (buckets.length < 3) return null;
    buckets.sort((a, b) => a.center - b.center);

    const totalProb = buckets.reduce((s, b) => s + b.prob, 0);
    const impliedCloseSpx =
      totalProb > 0 ? buckets.reduce((s, b) => s + b.prob * b.center, 0) / totalProb : null;
    const mode = buckets.reduce((best, b) => (b.prob > best.prob ? b : best), buckets[0]);

    return {
      eventTicker: forDay[0].event_ticker ?? "KXINX",
      closeTimeUtc: forDay[0].close_time ?? "",
      buckets,
      impliedCloseSpx: impliedCloseSpx != null ? Math.round(impliedCloseSpx * 100) / 100 : null,
      modeCloseSpx: mode?.center ?? null,
    };
  } catch {
    return null;
  }
}

/** Belirli bir SPX seviyesinin üstünde kapanma olasılığı (kova dağılımından). */
export function probAboveSpx(buckets: KalshiBucket[], level: number): number | null {
  if (!buckets.length) return null;
  const total = buckets.reduce((s, b) => s + b.prob, 0);
  if (total <= 0) return null;
  let above = 0;
  for (const b of buckets) {
    if (b.floor >= level) above += b.prob;
    else if (b.cap > level && b.cap > b.floor) {
      // kısmi kova: seviyenin üstünde kalan oran
      above += b.prob * ((b.cap - level) / (b.cap - b.floor));
    }
  }
  return Math.max(0, Math.min(1, above / total));
}
