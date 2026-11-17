/**
 * Günlük Plan girdileri — yalnız gerçek kaynaklar. Hiçbir yerde varsayılan değer konmaz: kaynak düşerse null döner
 * ve motor ilgili alanı "veri yok" işaretler. server-only DEĞİL (betiklerden de çalışır); Supabase'e dokunmaz.
 *
 *   • Yahoo v8 chart: 5m extended (60 gün + taze 5 gün birleştirilir), 1d (2 yıl), oynaklık endeksi (^VIX/^VXN/^RVX)
 *   • Ekonomik takvim: ForexFactory haftalık JSON (nfs.faireconomy.media, auth yok) — USD, yüksek etkili
 *   • Bilanço: Yahoo quoteSummary calendarEvents (crumb) — mega cap listesi; saat yalnız kaynak verirse yazılır
 */

import { nyParts, type Bar } from "./core";
import { IV_INDEX, MEGA_CAPS, DAYPLAN_CFG } from "./dayPlanConfig";
import type { DayEvent } from "./dayPlan";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

const memo = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  if (v != null && !(Array.isArray(v) && v.length === 0)) memo.set(key, { at: Date.now(), v });
  else if (hit) return hit.v as T;
  return v;
}

/**
 * Hacimsiz (extended) mumda gövdeden %0,4'ten uzun fitil = bozuk print (ör. 16 Kas 16:00 fitili 754,17; 16:50 fitili 693,73).
 * Mum ONARILMAZ, tamamen atılır — o 5 dakika boş kalır.
 */
export const isBadPrint = (b: Bar) =>
  (b.volume || 0) === 0 && b.close > 0 && ((b.high - Math.max(b.open, b.close)) / b.close > 0.004 || (Math.min(b.open, b.close) - b.low) / b.close > 0.004);

export async function yahooBars(symbol: string, interval: "5m" | "1d", range: string, prePost: boolean, adjusted = true): Promise<Bar[]> {
  for (const host of HOSTS) {
    try {
      const res = await fetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=${prePost}`,
        { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(12000) },
      );
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const q = r?.indicators?.quote?.[0];
      if (!r?.timestamp || !q) continue;
      const span = interval === "5m" ? 300 : 0;
      // bozuk print süzgeçleri yalnız işlem gören semboller için (endekslerde ^VIX vb. hacim her zaman 0)
      const filt = span > 0 && !symbol.startsWith("^");
      // günlükte temettü düzeltmeli fiyat (SMA/EMA'lar TradingView ile aynı tabanda): OHLC × adjclose/close
      const adj: (number | null)[] | undefined = interval === "1d" && adjusted ? r.indicators?.adjclose?.[0]?.adjclose : undefined;
      const out: Bar[] = [];
      (r.timestamp as number[]).forEach((t, i) => {
        if (q.close[i] == null || q.open[i] == null || q.high[i] == null || q.low[i] == null) return;
        const k = adj && adj[i] != null && q.close[i] > 0 ? (adj[i] as number) / q.close[i] : 1;
        const b = { time: span ? t - (t % span) : t, open: q.open[i] * k, high: q.high[i] * k, low: q.low[i] * k, close: q.close[i] * k, volume: q.volume?.[i] || 0 };
        if (filt && isBadPrint(b)) return;
        out.push(b);
      });
      // aynı kovaya düşen son (canlı) print birleştirilir
      const m = new Map<number, Bar>();
      for (const b of out) {
        const p = m.get(b.time);
        m.set(b.time, p ? { ...p, high: Math.max(p.high, b.high), low: Math.min(p.low, b.low), close: b.close, volume: p.volume + b.volume } : b);
      }
      const sorted = [...m.values()].sort((a, b) => a.time - b.time);
      // hacimsiz mumda herhangi bir fiyat bir önceki geçerli kapanıştan %1'den fazla sapıyorsa (ör. 16 Kas 16:25 açılış 697,81) at
      const bars: Bar[] = [];
      for (const b of sorted) {
        const ref = bars.length ? bars[bars.length - 1].close : null;
        if (filt && ref && (b.volume || 0) === 0 && [b.open, b.high, b.low, b.close].some((v) => Math.abs(v - ref) / ref > 0.01)) continue;
        bars.push(b);
      }
      if (bars.length) return bars;
    } catch {
      // sıradaki host
    }
  }
  return [];
}

/** 60 günlük 5m (30 dk önbellek) + son 5 gün (60 sn önbellek) — aynı zamanlı mumda taze olan kazanır */
export async function bars5Extended(symbol: string): Promise<Bar[]> {
  const [hist, fresh] = await Promise.all([
    cached(`5m60:${symbol}`, 30 * 60 * 1000, () => yahooBars(symbol, "5m", "60d", true)),
    cached(`5m5:${symbol}`, 60 * 1000, () => yahooBars(symbol, "5m", "5d", true)),
  ]);
  const m = new Map<number, Bar>();
  for (const b of hist) m.set(b.time, b);
  for (const b of fresh) m.set(b.time, b);
  return [...m.values()].sort((a, b) => a.time - b.time);
}

export const dailyBars = (symbol: string) => cached(`1d:${symbol}`, 60 * 60 * 1000, () => yahooBars(symbol, "1d", "2y", false));
/** düzeltmesiz son ~1 ay (resmi kapanış) */
export const dailyRawBars = (symbol: string) => cached(`1dr:${symbol}`, 15 * 60 * 1000, () => yahooBars(symbol, "1d", "1mo", false, false));

/** Oynaklık endeksinin asOf anındaki son kapanmış değeri (5m) — sembolün endeksi yoksa null */
export async function ivAt(symbol: string, asOf: number): Promise<{ value: number; label: string } | null> {
  const ix = IV_INDEX[symbol];
  if (!ix) return null;
  const bs = await cached(`iv5:${ix.sym}`, 60 * 1000, () => yahooBars(ix.sym, "5m", "5d", true));
  const ok = bs.filter((b) => b.time + 300 <= asOf && b.close > 0);
  if (ok.length) return { value: Math.round(ok[ok.length - 1].close * 100) / 100, label: ix.label };
  const d = await cached(`iv1d:${ix.sym}`, 30 * 60 * 1000, () => yahooBars(ix.sym, "1d", "1mo", false));
  const dk = d.filter((b) => b.time < asOf && b.close > 0);
  return dk.length ? { value: Math.round(dk[dk.length - 1].close * 100) / 100, label: `${ix.label} (günlük kapanış)` } : null;
}

// ── ekonomik takvim ─────────────────────────────────────────────

interface FfRow { title?: string; country?: string; date?: string; impact?: string }

/** Bu haftanın USD yüksek etkili olayları. Kaynak düşerse null (veri yok). */
export async function macroEvents(): Promise<DayEvent[] | null> {
  const rows = await cached("ffcal", 60 * 60 * 1000, async () => {
    try {
      const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const j = (await res.json()) as FfRow[];
      return Array.isArray(j) ? j : null;
    } catch { return null; }
  });
  if (!rows) return null;
  const out: DayEvent[] = [];
  for (const r of rows) {
    if (r.country !== "USD" || r.impact !== "High" || !r.date || !r.title) continue;
    const t = Math.floor(Date.parse(r.date) / 1000);
    if (!Number.isFinite(t)) continue;
    const p = nyParts(t);
    const allDay = p.minutes === 0;
    out.push({ date: p.ymd, time: allDay ? null : `${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`, name: r.title, kind: "macro", impact: r.impact });
  }
  // aynı saatteki olaylar tek satır (Retail Sales + Core Retail Sales)
  const merged = new Map<string, DayEvent>();
  for (const e of out) {
    const k = `${e.date}|${e.time}`;
    const p = merged.get(k);
    merged.set(k, p ? { ...p, name: `${p.name} + ${e.name}` } : e);
  }
  return [...merged.values()].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

// ── bilanço (Yahoo calendarEvents) ──────────────────────────────

let auth: { crumb: string; cookie: string; at: number } | null = null;
async function yAuth(): Promise<{ crumb: string; cookie: string } | null> {
  if (auth && Date.now() - auth.at < 50 * 60 * 1000) return auth;
  try {
    const home = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(6000) });
    const raw = home.headers.get("set-cookie") || "";
    const a3 = raw.match(/A3=([^;]+)/)?.[1];
    const a1 = raw.match(/A1=([^;]+)/)?.[1];
    const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");
    const cr = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, Cookie: cookie }, signal: AbortSignal.timeout(6000) });
    const crumb = (await cr.text()).trim();
    if (!cr.ok || !crumb || crumb.length > 20) return null;
    auth = { crumb, cookie, at: Date.now() };
    return auth;
  } catch { return null; }
}

async function earningsOf(sym: string): Promise<DayEvent | null | undefined> {
  const a = await yAuth();
  if (!a) return undefined;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=calendarEvents&crumb=${encodeURIComponent(a.crumb)}`,
      { headers: { "User-Agent": UA, Cookie: a.cookie }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return undefined;
    const j = await res.json();
    const e = j?.quoteSummary?.result?.[0]?.calendarEvents?.earnings;
    const raw = Number(e?.earningsDate?.[0]?.raw);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const p = nyParts(raw);
    // Yahoo saat vermiyorsa damga gece yarısıdır → saat "veri yok"
    const hasTime = p.minutes !== 0 && !e?.isEarningsDateEstimate;
    return { date: p.ymd, time: hasTime ? `${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}` : null, name: `${sym} bilanço`, kind: "earnings" };
  } catch { return undefined; }
}

/** Mega cap bilançoları (6 saat önbellek). Hiçbiri okunamazsa null. */
export async function megaEarnings(): Promise<DayEvent[] | null> {
  return cached("earn", 6 * 60 * 60 * 1000, async () => {
    const res = await Promise.all(MEGA_CAPS.map(earningsOf));
    if (res.every((r) => r === undefined)) return null;
    return res.filter((r): r is DayEvent => !!r);
  });
}

/** Göreli güç sembolleri */
export const relSymbolsFor = (symbol: string) => (DAYPLAN_CFG.relSymbols[symbol] ?? DAYPLAN_CFG.relSymbols["*"]).filter((s) => s !== symbol);
