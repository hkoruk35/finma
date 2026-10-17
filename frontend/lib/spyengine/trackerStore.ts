/**
 * Takip Sistemi günlüğü (sunucu) — Supabase `shared_store` anahtarı `spyengine_tracker` (SPY) / `qqqengine_tracker` (QQQ).
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
import { trackerRead, refSide15Of, summarizeTrades, TRACK_CFG, TRACK_VERSION, type D, type FcRule, type TagStat, type TrackCfg, type TrackTrade } from "./tracker";
import { QQQ_TRACK_CFG, QQQ_TRACK_VERSION } from "../qqqengine/config";

export type TrackSymbol = "SPY" | "QQQ";
export const TRACK_SYMBOLS: TrackSymbol[] = ["SPY", "QQQ"];
const KEYS: Record<TrackSymbol, string> = { SPY: "spyengine_tracker", QQQ: "qqqengine_tracker" };
const MAX_DAYS = 250;
const MAX_LIVE_ALERTS = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** sembol başına Takip kuralları — QQQ kendi 5m ayarlarıyla (qqqengine/config.ts) */
const CFGS: Record<TrackSymbol, TrackCfg> = { SPY: TRACK_CFG, QQQ: QQQ_TRACK_CFG };
const VERSIONS: Record<TrackSymbol, string> = { SPY: TRACK_VERSION, QQQ: QQQ_TRACK_VERSION };
/** referans 15m yönü gereken semboller için referans sembol (yalnız cfg.refAlign15 açıksa; şu an hiçbiri) */
const REF: Partial<Record<TrackSymbol, TrackSymbol>> = CFGS.QQQ.refAlign15 !== "off" ? { QQQ: "SPY" } : {};

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

async function readStore(sym: TrackSymbol): Promise<Store> {
  try {
    const { data } = await supabaseAdmin.from("shared_store").select("value").eq("key", KEYS[sym]).maybeSingle();
    const v = data?.value as Store | undefined;
    if (v && typeof v === "object" && v.days) return { days: v.days, pending: v.pending ?? {}, updatedAt: v.updatedAt ?? "" };
  } catch {
    // Supabase erişilemiyorsa boş — sayfa yine çalışsın
  }
  return { days: {}, pending: {}, updatedAt: "" };
}

async function writeStore(sym: TrackSymbol, s: Store): Promise<void> {
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete s.days[k];
  s.updatedAt = new Date().toISOString();
  await supabaseAdmin.from("shared_store").upsert({ key: KEYS[sym], value: s }, { onConflict: "key" });
}

/** Bir günü canlı motorla oynatıp kayda çevirir (geriye dönük test de aynı fonksiyonu kullanır) */
export function buildTrackDay(m5: Bar[], date: string, backfill: boolean, live?: LiveAlert[], sym: TrackSymbol = "SPY", refM5?: Bar[] | null): TrackDay | null {
  const nowSec = nyDateTimeToEpoch(date, 16 * 60 + 5);
  const refSide15 = REF[sym] && refM5?.length ? refSide15Of(refM5, date, nowSec) : null;
  if (REF[sym] && !refSide15) return null; // referans verisi yoksa günü dondurma (sonra yeniden denenir)
  const r = trackerRead({ date, m5, nowSec, rvol: rvolBaseline(m5, date), cfg: CFGS[sym], refSide15 });
  const st = r.steps.filter((s) => !s.pre);
  if (st.length < 60) return null; // yarım seans
  const preds: CompactPred[] = st
    .filter((s) => s.fc.dir && s.out?.done)
    .map((s) => [s.clock, s.fc.dir, s.fc.rule, s.score, s.price, s.fc.target, s.fc.invalid, s.out!.move, s.out!.hit ? 1 : 0, s.out!.targetHit ? 1 : 0]);
  return {
    date, version: VERSIONS[sym], backfill, bias: r.k0.bias, gap: r.gap, dayClass: r.dayClass,
    or15: r.or15 ? { high: r.or15.high, low: r.or15.low } : null, realizedR: r.realizedR, pred: r.pred, preds, trades: r.trades,
    alerts: r.alerts.filter((a) => a.level !== "KADEME").map((a) => ({ clock: a.clock, level: a.level, tag: a.tag, side: a.side, text: a.text })),
    ...(live?.length ? { live } : {}),
  };
}

const memo: Partial<Record<TrackSymbol, { at: number; days: TrackDay[] }>> = {};

/** Eksik tamamlanmış seansları kaydeder. 10 dk önbellekli. */
export async function updateTrackerLog(force = false, sym: TrackSymbol = "SPY"): Promise<TrackDay[]> {
  const mm = memo[sym];
  if (!force && mm && Date.now() - mm.at < 10 * 60 * 1000) return mm.days;
  const store = await readStore(sym);
  const empty = Object.keys(store.days).length === 0;
  const isStale = (x: TrackDay) => x.backfill && x.version !== VERSIONS[sym];
  const staleAny = Object.values(store.days).some(isStale);
  let dirty = false;
  try {
    const range = empty || staleAny ? "60d" : "1mo";
    const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(await chart(sym, range)), 300)).bars;
    const refSym = REF[sym];
    const refM5: Bar[] | null = refSym ? dropBadPrints(snapToInterval(normalizeBars(await chart(refSym, range)), 300)).bars : null;
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
        const rec = buildTrackDay(m5, d, cur ? cur.backfill : empty, store.pending[d] ?? cur?.live, sym, refM5);
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
    try { await writeStore(sym, store); } catch { /* sonraki çağrıda yeniden denenir */ }
  }
  const days = Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
  memo[sym] = { at: Date.now(), days };
  return days;
}

/** Tarayıcıdan gelen canlı uyarıları günün bekleyen kaydına ekler (aynı uyarı iki kez yazılmaz) */
export async function appendTrackerAlerts(date: string, alerts: LiveAlert[], sym: TrackSymbol = "SPY"): Promise<number> {
  if (!DATE_RE.test(date) || !alerts.length) return 0;
  const store = await readStore(sym);
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
  if (n) await writeStore(sym, store);
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

const refMemo = new Map<string, { at: number; ref: [number, D][] }>();

/** Canlı sayfa için referans sembolün (QQQ → SPY) kapanmış 15m yönü — Yahoo 5m, 30 sn önbellekli */
export async function liveRefSide15(sym: TrackSymbol, date: string): Promise<[number, D][]> {
  const refSym = REF[sym];
  if (!refSym || !DATE_RE.test(date)) return [];
  const k = `${refSym}:${date}`;
  const hit = refMemo.get(k);
  if (hit && Date.now() - hit.at < 30 * 1000) return hit.ref;
  const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(await chart(refSym, "1mo")), 300)).bars;
  const nowSec = Math.min(Math.floor(Date.now() / 1000), nyDateTimeToEpoch(date, 16 * 60 + 5));
  const ref = [...refSide15Of(m5, date, nowSec).entries()];
  refMemo.set(k, { at: Date.now(), ref });
  return ref;
}
