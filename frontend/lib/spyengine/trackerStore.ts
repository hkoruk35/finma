/**
 * Takip Sistemi günlüğü (sunucu) — Supabase `shared_store` anahtarı `spyengine_tracker`.
 *
 * • Tamamlanan her seans (16:05 ET sonrası) için CANLI MOTORUN AYNI FONKSİYONU (tracker.ts · trackerRead) Yahoo 5m ile
 *   günü baştan oynatır; o günün bütün 30 dk tahminleri + gerçekleşenleri, işlemleri ve uyarıları tek kayıtta DONDURULUR.
 *   İlk çalıştırmada son ~45 seans geriye dönük doldurulur (`backfill: true`); motor sürümü değişince yalnız geriye dönük
 *   kayıtlar yeniden üretilir, canlı dönemde yazılanlar korunur.
 * • Gün yaşanırken tarayıcıdan gelen anlık uyarılar (HAZIRLAN vb. — 5m mumdan yeniden üretilemez) günün bekleyen kaydına eklenir.
 * • GET özet: kurulum etiketine göre sonuçlar (n · kazanç · ort. R · durum), tahmin kuralına göre isabet, son işlemler.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, nyDateTimeToEpoch, type Bar } from "./core";
import { chart } from "./openForecastFetch";
import { rvolBaseline } from "./ladder";
import { trackerRead, summarizeTrades, TRACK_VERSION, type FcRule, type TagStat, type TrackTrade } from "./tracker";

const KEY = "spyengine_tracker";
const MAX_DAYS = 250;
const MAX_LIVE_ALERTS = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** [saat, yön, kural, puan, fiyat, hedef, iptal, 30dk hareket, yön doğru (1/0), hedefe değdi (1/0)] */
export type CompactPred = [string, number, FcRule | null, number, number, number | null, number | null, number, 0 | 1, 0 | 1];

export interface LiveAlert { t: number; clock: string; level: string; tag: string | null; side: string | null; text: string }

export interface TrackDay {
  date: string;
  version: string;
  backfill: boolean;
  bias: string;
  gap: { pts: number | null; type: string };
  dayClass: string | null;
  or15: { high: number; low: number } | null;
  realizedR: number;
  pred: { n: number; hit: number; tHit: number };
  preds: CompactPred[];
  trades: TrackTrade[];
  alerts: { clock: string; level: string; tag: string | null; side: string | null; text: string }[];
  live?: LiveAlert[];
}

interface Store { days: Record<string, TrackDay>; pending: Record<string, LiveAlert[]>; updatedAt: string }

async function readStore(): Promise<Store> {
  try {
    const { data } = await supabaseAdmin.from("shared_store").select("value").eq("key", KEY).maybeSingle();
    const v = data?.value as Store | undefined;
    if (v && typeof v === "object" && v.days) return { days: v.days, pending: v.pending ?? {}, updatedAt: v.updatedAt ?? "" };
  } catch {
    // Supabase erişilemiyorsa boş — sayfa yine çalışsın
  }
  return { days: {}, pending: {}, updatedAt: "" };
}

async function writeStore(s: Store): Promise<void> {
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete s.days[k];
  s.updatedAt = new Date().toISOString();
  await supabaseAdmin.from("shared_store").upsert({ key: KEY, value: s }, { onConflict: "key" });
}

/** Bir günü canlı motorla oynatıp kayda çevirir (geriye dönük test de aynı fonksiyonu kullanır) */
export function buildTrackDay(m5: Bar[], date: string, backfill: boolean, live?: LiveAlert[]): TrackDay | null {
  const r = trackerRead({ date, m5, nowSec: nyDateTimeToEpoch(date, 16 * 60 + 5), rvol: rvolBaseline(m5, date) });
  const st = r.steps.filter((s) => !s.pre);
  if (st.length < 60) return null; // yarım seans
  const preds: CompactPred[] = st
    .filter((s) => s.fc.dir && s.out?.done)
    .map((s) => [s.clock, s.fc.dir, s.fc.rule, s.score, s.price, s.fc.target, s.fc.invalid, s.out!.move, s.out!.hit ? 1 : 0, s.out!.targetHit ? 1 : 0]);
  return {
    date, version: TRACK_VERSION, backfill, bias: r.k0.bias, gap: r.gap, dayClass: r.dayClass,
    or15: r.or15 ? { high: r.or15.high, low: r.or15.low } : null, realizedR: r.realizedR, pred: r.pred, preds, trades: r.trades,
    alerts: r.alerts.filter((a) => a.level !== "KADEME").map((a) => ({ clock: a.clock, level: a.level, tag: a.tag, side: a.side, text: a.text })),
    ...(live?.length ? { live } : {}),
  };
}

let memo: { at: number; days: TrackDay[] } | null = null;

/** Eksik tamamlanmış seansları kaydeder. 10 dk önbellekli. */
export async function updateTrackerLog(force = false): Promise<TrackDay[]> {
  if (!force && memo && Date.now() - memo.at < 10 * 60 * 1000) return memo.days;
  const store = await readStore();
  const empty = Object.keys(store.days).length === 0;
  const isStale = (x: TrackDay) => x.backfill && x.version !== TRACK_VERSION;
  const staleAny = Object.values(store.days).some(isStale);
  let dirty = false;
  try {
    const raw = await chart("SPY", empty || staleAny ? "60d" : "1mo");
    const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(raw), 300)).bars;
    if (m5.length) {
      const np = nyParts(Math.floor(Date.now() / 1000));
      const dates = Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
      // ilk ~15 gün göstergelerin (4h EMA20, günlük ATR, RVOL tabanı) ısınması için
      const usable = dates.slice(Math.min(15, Math.max(0, dates.length - 1)));
      for (const d of usable) {
        const cur = store.days[d];
        if (cur && !isStale(cur)) continue;
        if (d === np.ymd && np.minutes < 16 * 60 + 5) continue;
        if (d > np.ymd) continue;
        const rec = buildTrackDay(m5, d, cur ? cur.backfill : empty, store.pending[d] ?? cur?.live);
        if (!rec) continue;
        store.days[d] = rec;
        delete store.pending[d];
        dirty = true;
      }
      for (const k of Object.keys(store.pending)) if (k < dates[Math.max(0, dates.length - 10)]) { delete store.pending[k]; dirty = true; }
    }
  } catch {
    // veri alınamadıysa mevcut kayıtla devam
  }
  if (dirty) {
    try { await writeStore(store); } catch { /* sonraki çağrıda yeniden denenir */ }
  }
  const days = Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
  memo = { at: Date.now(), days };
  return days;
}

/** Tarayıcıdan gelen canlı uyarıları günün bekleyen kaydına ekler (aynı uyarı iki kez yazılmaz) */
export async function appendTrackerAlerts(date: string, alerts: LiveAlert[]): Promise<number> {
  if (!DATE_RE.test(date) || !alerts.length) return 0;
  const store = await readStore();
  if (store.days[date]) return 0;
  const p = (store.pending[date] ??= []);
  const seen = new Set(p.map((a) => `${a.t}|${a.level}|${a.tag}|${a.side}`));
  let n = 0;
  for (const a of alerts) {
    const k = `${a.t}|${a.level}|${a.tag}|${a.side}`;
    if (seen.has(k) || p.length >= MAX_LIVE_ALERTS) continue;
    seen.add(k);
    p.push(a);
    n++;
  }
  if (n) await writeStore(store);
  return n;
}

export interface RuleStat { rule: FcRule; n: number; hit: number; tHit: number; avgMove: number; liveN: number; liveHit: number }

export interface TrackerSummary {
  count: number;
  liveCount: number;
  from: string | null;
  to: string | null;
  byTag: TagStat[];
  byRule: RuleStat[];
  pred: { n: number; hit: number; tHit: number };
  recent: { date: string; backfill: boolean; bias: string; gap: string; dayClass: string | null; trades: number; r: number; pred: string }[];
  trades: (TrackTrade & { date: string })[];
  /** Önerilen işlemler arşivi (son 60 seans, tüm işlemler) */
  allTrades: (TrackTrade & { date: string })[];
  /** Uyarı kaydı (son 10 seans; canlı HAZIRLAN dahil) */
  alertLog: { date: string; clock: string; level: string; side: string | null; text: string }[];
}

export function summarizeLog(days: TrackDay[]): TrackerSummary {
  const all = days.flatMap((d) => d.trades.map((t) => ({ ...t, date: d.date })));
  const rules = new Map<FcRule, RuleStat>();
  for (const d of days) {
    for (const p of d.preds) {
      const rule = p[2];
      if (!rule) continue;
      const o = rules.get(rule) ?? { rule, n: 0, hit: 0, tHit: 0, avgMove: 0, liveN: 0, liveHit: 0 };
      o.n++; o.hit += p[8]; o.tHit += p[9]; o.avgMove += p[1] * p[7];
      if (!d.backfill) { o.liveN++; o.liveHit += p[8]; }
      rules.set(rule, o);
    }
  }
  const byRule = [...rules.values()].map((o) => ({ ...o, avgMove: o.n ? Math.round((o.avgMove / o.n) * 1000) / 1000 : 0 }));
  const pred = days.reduce((a, d) => ({ n: a.n + d.pred.n, hit: a.hit + d.pred.hit, tHit: a.tHit + d.pred.tHit }), { n: 0, hit: 0, tHit: 0 });
  return {
    count: days.length,
    liveCount: days.filter((d) => !d.backfill).length,
    from: days[0]?.date ?? null,
    to: days[days.length - 1]?.date ?? null,
    byTag: summarizeTrades(all),
    byRule,
    pred,
    recent: days.slice(-10).reverse().map((d) => ({ date: d.date, backfill: d.backfill, bias: d.bias, gap: d.gap.type, dayClass: d.dayClass, trades: d.trades.length, r: d.realizedR, pred: `${d.pred.hit}/${d.pred.n}` })),
    trades: all.slice(-20).reverse(),
    allTrades: days.slice(-60).flatMap((d) => d.trades.map((t) => ({ ...t, date: d.date }))),
    alertLog: days.slice(-10).flatMap((d) => [
      ...d.alerts.map((a) => ({ date: d.date, clock: a.clock, level: a.level, side: a.side, text: a.text })),
      ...(d.live ?? []).filter((a) => a.level === "HAZIRLAN").map((a) => ({ date: d.date, clock: a.clock, level: a.level, side: a.side, text: a.text })),
    ]).sort((a, b) => (a.date === b.date ? a.clock.localeCompare(b.clock) : a.date.localeCompare(b.date))),
  };
}
