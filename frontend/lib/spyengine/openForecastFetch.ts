/**
 * SPY Engine — Açılış Tahmini veri katmanı (sunucu). Yahoo v8 chart (crumb
 * gerekmez): ES=F, NQ=F, RTY=F, YM=F, ^VIX ve SPY, 5m, 5 gün, pre/post dahil.
 * 60 sn önbellek. Hesap saf modülde (openForecast.ts).
 */

import { nyParts, nyDateTimeToEpoch, isRthBar, bucketAggregate, ema, type Bar } from "./core";
import { openForecast, CHECKPOINTS, type OpenForecast, type FutQuote } from "./openForecast";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
export const SYMBOLS = { ES: "ES=F", NQ: "NQ=F", RTY: "RTY=F", YM: "YM=F", VIX: "^VIX", SPY: "SPY" } as const;
export type Key = keyof typeof SYMBOLS;

let cache: { at: number; value: OpenForecastRead } | null = null;

export async function chart(symbol: string, range = "5d"): Promise<Bar[]> {
  for (const host of HOSTS) {
    try {
      const res = await fetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=${range}&includePrePost=true`,
        { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const q = r?.indicators?.quote?.[0];
      if (!r?.timestamp || !q) continue;
      const out: Bar[] = [];
      (r.timestamp as number[]).forEach((t, i) => {
        if (q.close[i] == null || q.open[i] == null) return;
        out.push({ time: t - (t % 300), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 });
      });
      if (out.length) return out;
    } catch {
      // sıradaki host
    }
  }
  return [];
}

/** t anına kadar KAPANMIŞ son mumun kapanışı */
function closeAt(bars: Bar[], t: number): number | null {
  let v: number | null = null;
  for (const b of bars) {
    if (b.time + 300 <= t) v = b.close;
    else break;
  }
  return v;
}

const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
function nextWeekday(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

export interface TrendChip {
  tf: "1S" | "4S" | "1G";
  dir: "UP" | "DOWN" | "FLAT";
  text: string;
}

export interface OpenForecastRead {
  /** Tahminin hedeflediği seans (NY) */
  session: string;
  prevSession: string;
  prevClose: number;
  now: OpenForecast | null;
  /** Bugünün geçmiş kontrol noktalarındaki tahminler (aynı veriden yeniden hesaplanır) */
  checkpoints: { label: string; name: string; forecast: OpenForecast | null }[];
  /** Açılış gerçekleştiyse: gerçek açılış ve son (09:25) tahminin hatası */
  actual: { open: number; lastForecast: number | null; error: number | null; inBand: boolean | null } | null;
  /** ES çoklu zaman dilimi eğilimi (bağlam — tahmine girmez) */
  trend: TrendChip[];
  /** Son VIX değeri — gün tipi (hareketli / sıkışma) ve senaryo prim tahmini için */
  vixNow: number | null;
  serverTime: number;
}

function trendChips(es: Bar[], nowSec: number): TrendChip[] {
  const closed = es.filter((b) => b.time + 300 <= nowSec);
  // 5 günlük veride ~21 adet 4S mum var → 4S için EMA10 (EMA20'nin 3 mum öncesi henüz yok)
  const chip = (tf: TrendChip["tf"], bars: Bar[], period: number): TrendChip => {
    const e = ema(bars.map((b) => b.close), period);
    const el = e[e.length - 1], ep = e[e.length - 4];
    if (bars.length < period + 3 || el == null || ep == null) return { tf, dir: "FLAT", text: "yetersiz veri" };
    const last = bars[bars.length - 1].close;
    const side = last > el ? 1 : -1, slope = el - ep;
    const dir: TrendChip["dir"] = side > 0 && slope > 0 ? "UP" : side < 0 && slope < 0 ? "DOWN" : "FLAT";
    return { tf, dir, text: `EMA${period} ${side > 0 ? "üstünde" : "altında"}, eğim ${slope >= 0 ? "+" : ""}${slope.toFixed(2)}` };
  };
  const h1 = bucketAggregate(closed, 60);
  const h4 = bucketAggregate(closed, 240);
  // günlük: her takvim gününün son kapanışı (vadeli neredeyse 24 saat işlem görür)
  const days = new Map<string, Bar>();
  for (const b of closed) days.set(nyParts(b.time).ymd, b);
  const d1 = Array.from(days.values());
  const dChip: TrendChip =
    d1.length >= 3
      ? (() => {
          const a = d1[d1.length - 1].close, b0 = d1[0].close;
          const dir: TrendChip["dir"] = Math.abs(a / b0 - 1) < 0.002 ? "FLAT" : a > b0 ? "UP" : "DOWN";
          return { tf: "1G", dir, text: `${d1.length} günde ${a >= b0 ? "+" : ""}${((a / b0 - 1) * 100).toFixed(2)}%` };
        })()
      : { tf: "1G", dir: "FLAT", text: "yetersiz veri" };
  return [chip("1S", h1, 20), chip("4S", h4, 10), dChip];
}

/**
 * Bir seans için açılış tahmin hesaplayıcısı — canlı panel ve günlük kaydı
 * (journal.ts) AYNI fonksiyonu kullanır. null: önceki seans/kapanış bulunamadı.
 */
export function sessionForecaster(S: Record<Key, Bar[]>, session: string, bandScale?: Record<string, number> | null, bias?: Record<string, number> | null) {
  const rthDays = Array.from(new Set(S.SPY.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
  const prevSession = rthDays.filter((d) => d < session).pop();
  if (!prevSession) return null;
  const prevRth = S.SPY.filter((b) => isRthBar(b) && nyParts(b.time).ymd === prevSession);
  const prevClose = prevRth[prevRth.length - 1].close;
  const tRef = nyDateTimeToEpoch(prevSession, 16 * 60);
  const openSec = nyDateTimeToEpoch(session, 9 * 60 + 30);
  const fq = (k: Key, t: number): FutQuote => ({ ref: closeAt(S[k], tRef), now: closeAt(S[k], t) });
  const pre = S.SPY.filter((b) => nyParts(b.time).ymd === session && nyParts(b.time).minutes >= 240 && nyParts(b.time).minutes < 570);
  const at = (t: number) => {
    const mto = Math.round((openSec - t) / 60);
    // günlük kayıttan öğrenilen bant ölçeği: en yakın kontrol noktasınınki
    const nowMin = 9 * 60 + 30 - mto;
    const cp = CHECKPOINTS.reduce((a, c) => (Math.abs(c.minutes - nowMin) < Math.abs(a.minutes - nowMin) ? c : a));
    const f = openForecast({
      at: t, minutesToOpen: mto, prevClose,
      es: fq("ES", t), nq: fq("NQ", t), rty: fq("RTY", t), ym: fq("YM", t), vix: fq("VIX", t), spyPre: closeAt(pre, t),
      bandScale: bandScale?.[cp.label] ?? null,
    });
    // günlükten öğrenilen SİSTEMATİK sapma (yalnız anlamlıysa verilir): merkez ve bant kaydırılır
    const b = bias?.[cp.label];
    if (f && b) {
      const sh = (x: number) => Math.round((x + b) * 100) / 100;
      f.center = sh(f.center); f.lo = sh(f.lo); f.hi = sh(f.hi);
      f.gap = Math.round((f.center - prevClose) * 100) / 100;
      f.notes = [...f.notes, `Günlükten öğrenilen sapma düzeltmesi: ${b >= 0 ? "+" : ""}${b.toFixed(2)} puan (geçmişte gerçek açılış tahminden sistematik olarak ${b >= 0 ? "yukarıda" : "aşağıda"}).`];
    }
    return f;
  };
  return { prevSession, prevClose, openSec, at };
}

export async function fetchOpenForecast(bandScale?: Record<string, number> | null, bias?: Record<string, number> | null): Promise<OpenForecastRead | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const entries = await Promise.all((Object.keys(SYMBOLS) as Key[]).map(async (k) => [k, await chart(SYMBOLS[k])] as const));
  const S = Object.fromEntries(entries) as Record<Key, Bar[]>;
  if (!S.ES.length || !S.SPY.length) return cache?.value ?? null;

  const nowSec = Math.floor(Date.now() / 1000);
  const np = nyParts(nowSec);
  // hedef seans: hafta içi ve 16:00 öncesiyse bugün, değilse bir sonraki iş günü
  let session = np.ymd;
  if ([0, 6].includes(weekday(session)) || np.minutes >= 16 * 60) session = nextWeekday(session);

  const fc = sessionForecaster(S, session, bandScale, bias);
  if (!fc) return cache?.value ?? null;
  const { prevSession, prevClose, openSec, at } = fc;

  const checkpoints = CHECKPOINTS.map((c) => {
    const t = nyDateTimeToEpoch(session, c.minutes);
    return { label: c.label, name: c.name, forecast: t <= nowSec ? at(t) : null };
  });

  const todayRth = S.SPY.filter((b) => isRthBar(b) && nyParts(b.time).ymd === session);
  let actual: OpenForecastRead["actual"] = null;
  if (todayRth.length) {
    const open = todayRth[0].open;
    const last = checkpoints[checkpoints.length - 1].forecast;
    actual = {
      open,
      lastForecast: last?.center ?? null,
      error: last ? Math.round((open - last.center) * 100) / 100 : null,
      inBand: last ? open >= last.lo && open <= last.hi : null,
    };
  }

  const value: OpenForecastRead = {
    session, prevSession, prevClose,
    now: nowSec < openSec ? at(nowSec) : null,
    checkpoints, actual,
    trend: trendChips(S.ES, nowSec),
    vixNow: closeAt(S.VIX, nowSec + 300),
    serverTime: nowSec,
  };
  cache = { at: Date.now(), value };
  return value;
}
