/**
 * SPY Engine — Tahmin Günlüğü (sunucu). Her TAMAMLANAN seans için:
 *   • açılış tahmini (04:00 / 07:00 / 08:30 / 09:25) + gerçek açılış → hata, aralık içi mi, gap yönü doğru mu
 *   • açılış aşamaları (09:35 … 10:00) + gün yönü kararı → 60 dk sonra ve kapanışta doğru mu
 * Kayıtlar Supabase `shared_store` (`spyengine_journal`) içinde DONDURULUR —
 * bir gün yazıldıktan sonra yeniden hesaplanmaz; böylece istatistik, o günkü
 * kod sürümünün gerçek performansını gösterir. İlk çalıştırmada Yahoo'nun
 * sakladığı son ~60 gün geriye dönük doldurulur (`backfill: true`).
 *
 * ÖĞRENME: `journalStats()` gerçekleşen isabetleri hesaplar; N ≥ MIN_N olunca
 * aşama isabetleri ve açılış bandı ölçeği sabit tablonun yerine geçer.
 * Hepsi tahmindir; kayıt hiçbir işlem kararı almaz.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { nyParts, isRthBar, bucketAggregate, nyDateTimeToEpoch, type Bar } from "./core";
import { daySeries, emaByTime, openingRegime } from "./openingMap";
import { CHECKPOINTS, BAND80_BASE } from "./openForecast";
import { chart, sessionForecaster, SYMBOLS, type Key } from "./openForecastFetch";

const STORE_KEY = "spyengine_journal";
const MAX_DAYS = 250;
export const JOURNAL_VERSION = "v9.6";
export const MIN_N = 20;

export interface JournalDay {
  date: string;
  version: string;
  backfill: boolean;
  prevClose: number;
  open: number;
  close: number;
  /** Açılış tahmini kontrol noktaları */
  forecasts: { label: string; center: number; lo: number; hi: number; dir: string; confidence: string; error: number; inBand: boolean; dirOk: boolean | null }[];
  /** Açılış aşamaları: yön ve sonuç (dir UP/DOWN iken) */
  stages: { clock: string; dir: string | null; price: number | null; ok60: boolean | null; okClose: boolean | null }[];
  /** Gün yönü kararı */
  decision: { side: string | null; decidedAt: string | null; strength: string | null; ok60: boolean | null; okClose: boolean | null };
}

interface Store {
  days: Record<string, JournalDay>;
  updatedAt: string;
}

async function readStore(): Promise<Store> {
  try {
    const { data } = await supabaseAdmin.from("shared_store").select("value").eq("key", STORE_KEY).maybeSingle();
    const v = data?.value as Store | undefined;
    if (v && typeof v === "object" && v.days) return v;
  } catch {
    // Supabase erişilemiyorsa boş — panel yine çalışsın
  }
  return { days: {}, updatedAt: "" };
}

async function writeStore(s: Store): Promise<void> {
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete s.days[k];
  s.updatedAt = new Date().toISOString();
  await supabaseAdmin.from("shared_store").upsert({ key: STORE_KEY, value: s }, { onConflict: "key" });
}

const STAGE_IDX: Record<string, number> = { "09:35": 0, "09:40": 1, "09:45": 2, "09:50": 3, "09:55": 4, "10:00": 5 };

/** Tek seansın kaydı — verilen veriden (gün tamamlanmış olmalı) */
export function buildDay(S: Record<Key, Bar[]>, date: string, backfill: boolean): JournalDay | null {
  const rth = S.SPY.filter((b) => isRthBar(b) && nyParts(b.time).ymd === date);
  if (rth.length < 70) return null;
  const open = rth[0].open, close = rth[rth.length - 1].close;
  const ret = (i: number, d: number) => {
    if (i < 0 || i >= rth.length) return { ok60: null, okClose: null };
    const p = rth[i].close, p60 = rth[Math.min(i + 12, rth.length - 1)].close;
    return { ok60: d * (p60 - p) > 0, okClose: d * (close - p) > 0 };
  };

  // açılış tahmini
  const fc = sessionForecaster(S, date);
  if (!fc) return null;
  const forecasts: JournalDay["forecasts"] = [];
  for (const c of CHECKPOINTS) {
    const f = fc.at(nyDateTimeToEpoch(date, c.minutes));
    if (!f) continue;
    const realGap = open - fc.prevClose;
    forecasts.push({
      label: c.label, center: f.center, lo: f.lo, hi: f.hi, dir: f.dir, confidence: f.confidence,
      error: Math.round((open - f.center) * 100) / 100,
      inBand: open >= f.lo && open <= f.hi,
      dirOk: Math.abs(realGap) < fc.prevClose * 0.0005 || f.dir === "FLAT" ? null : Math.sign(realGap) === (f.dir === "UP" ? 1 : -1),
    });
  }

  // açılış aşamaları — 10:05'te (tüm aşamalar kapanmış) okunur
  const t = nyDateTimeToEpoch(date, 10 * 60 + 5);
  const upto = S.SPY.filter((b) => b.time < t);
  const m5 = bucketAggregate(upto, 5), m15 = bucketAggregate(upto, 15), m30 = bucketAggregate(upto, 30);
  const s5 = daySeries(m5, "5m", date, t, t), s15 = daySeries(m15, "15m", date, t, t), s30 = daySeries(m30, "30m", date, t, t);
  const op = openingRegime(s5, s15, emaByTime(m5), s30);
  const sg = (d: string | null) => (d === "UP" ? 1 : d === "DOWN" ? -1 : 0);
  const stages = op.stages.map((st) => {
    const i = STAGE_IDX[st.clock];
    const d = sg(st.dir);
    return { clock: st.clock, dir: st.dir, price: rth[i]?.close ?? null, ...(d ? ret(i, d) : { ok60: null, okClose: null }) };
  });
  const dd = sg(op.side === "UP" ? "UP" : op.side === "DOWN" ? "DOWN" : null);
  const di = op.decidedAt === "09:55" ? 4 : op.decidedAt === "EMA" && op.weak ? 4 : 5;

  return {
    date, version: JOURNAL_VERSION, backfill, prevClose: Math.round(fc.prevClose * 100) / 100,
    open: Math.round(open * 100) / 100, close: Math.round(close * 100) / 100,
    forecasts, stages,
    decision: { side: op.side, decidedAt: op.decidedAt, strength: op.strength, ...(dd ? ret(di, dd) : { ok60: null, okClose: null }) },
  };
}

export interface JournalStats {
  n: number;
  liveN: number;
  /** Açılış tahmini: kontrol noktası başına gerçekleşen ort. hata, %80 hata, aralık içi oranı, gap yönü isabeti */
  forecast: Record<string, { n: number; meanErr: number; p80: number; inBandPct: number; dirPct: number | null; bandScale: number | null }>;
  /** Aşama isabeti (yalnız yön verdiği günler) */
  stages: Record<string, { n: number; hit60: number; hitClose: number }>;
  decision: { n: number; hit60: number; hitClose: number; byWhen: Record<string, { n: number; hitClose: number }> };
}

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export function journalStats(days: JournalDay[]): JournalStats {
  const forecast: JournalStats["forecast"] = {};
  for (const c of CHECKPOINTS) {
    const rows = days.flatMap((d) => d.forecasts.filter((f) => f.label === c.label));
    if (!rows.length) continue;
    const errs = rows.map((r) => Math.abs(r.error)).sort((a, b) => a - b);
    const p80 = errs[Math.min(errs.length - 1, Math.floor(0.8 * errs.length))];
    const dirRows = rows.filter((r) => r.dirOk != null);
    const base = BAND80_BASE[c.label];
    forecast[c.label] = {
      n: rows.length,
      meanErr: Math.round((errs.reduce((a, x) => a + x, 0) / errs.length) * 100) / 100,
      p80: Math.round(p80 * 100) / 100,
      inBandPct: pct(rows.filter((r) => r.inBand).length, rows.length),
      dirPct: dirRows.length ? pct(dirRows.filter((r) => r.dirOk).length, dirRows.length) : null,
      bandScale: rows.length >= MIN_N && base ? Math.round((p80 / base) * 100) / 100 : null,
    };
  }
  const stages: JournalStats["stages"] = {};
  for (const clock of Object.keys(STAGE_IDX)) {
    const rows = days.flatMap((d) => d.stages.filter((s) => s.clock === clock && s.ok60 != null));
    if (rows.length) stages[clock] = { n: rows.length, hit60: pct(rows.filter((r) => r.ok60).length, rows.length), hitClose: pct(rows.filter((r) => r.okClose).length, rows.length) };
  }
  const dec = days.filter((d) => d.decision.ok60 != null);
  const byWhen: JournalStats["decision"]["byWhen"] = {};
  for (const d of dec) {
    const k = d.decision.decidedAt ?? "—";
    const b = (byWhen[k] ??= { n: 0, hitClose: 0 });
    b.n++;
    if (d.decision.okClose) b.hitClose++;
  }
  for (const k of Object.keys(byWhen)) byWhen[k].hitClose = pct(byWhen[k].hitClose, byWhen[k].n);
  return {
    n: days.length,
    liveN: days.filter((d) => !d.backfill).length,
    forecast,
    stages,
    decision: { n: dec.length, hit60: pct(dec.filter((d) => d.decision.ok60).length, dec.length), hitClose: pct(dec.filter((d) => d.decision.okClose).length, dec.length), byWhen },
  };
}

let memo: { at: number; days: JournalDay[]; stats: JournalStats } | null = null;

/**
 * Günlüğü günceller (eksik tamamlanmış seansları ekler) ve istatistik döndürür.
 * 10 dk önbellekli. İlk çalıştırmada 60 günlük veriyle geriye dönük doldurur.
 */
export async function updateJournal(): Promise<{ days: JournalDay[]; stats: JournalStats; added: string[] }> {
  if (memo && Date.now() - memo.at < 10 * 60 * 1000) return { days: memo.days, stats: memo.stats, added: [] };
  const store = await readStore();
  const empty = Object.keys(store.days).length === 0;
  const entries = await Promise.all((Object.keys(SYMBOLS) as Key[]).map(async (k) => [k, await chart(SYMBOLS[k], empty ? "60d" : "5d")] as const));
  const S = Object.fromEntries(entries) as Record<Key, Bar[]>;
  const added: string[] = [];
  if (S.SPY.length && S.ES.length) {
    const nowSec = Math.floor(Date.now() / 1000);
    const np = nyParts(nowSec);
    const days = Array.from(new Set(S.SPY.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
    for (const d of days) {
      if (store.days[d]) continue; // dondurulmuş kayıt
      if (d === np.ymd && np.minutes < 16 * 60 + 5) continue; // seans bitmedi
      const rec = buildDay(S, d, empty);
      if (rec) { store.days[d] = rec; added.push(d); }
    }
    if (added.length) {
      try { await writeStore(store); } catch { /* yazılamadıysa bir sonraki çağrıda yeniden denenir */ }
    }
  }
  const all = Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
  const stats = journalStats(all);
  memo = { at: Date.now(), days: all, stats };
  return { days: all, stats, added };
}

/** Öğrenilen ayarlar: aşama isabetleri ve açılış bant ölçeği (yalnız N ≥ MIN_N olanlar) */
export function learned(stats: JournalStats | null) {
  if (!stats) return { stageStats: null, bandScale: null };
  const stageStats: Record<string, { hit60: number; hitClose: number }> = {};
  for (const [k, v] of Object.entries(stats.stages)) if (v.n >= MIN_N) stageStats[k] = { hit60: v.hit60, hitClose: v.hitClose };
  const bandScale: Record<string, number> = {};
  for (const [k, v] of Object.entries(stats.forecast)) if (v.bandScale != null) bandScale[k] = v.bandScale;
  return { stageStats: Object.keys(stageStats).length ? stageStats : null, bandScale: Object.keys(bandScale).length ? bandScale : null };
}
