/**
 * Günlük Plan — sunucu: girdileri toplar, planı kurar, sürümlü kaydeder (v1, v2, …; eski sürüm asla değişmez).
 *
 * Kayıt: Supabase `shared_store`
 *   indeks  `spyengine_dayplan_{SYMBOL}_{YYYY-MM-DD}`     = { symbol, date, versions: { v, asOf, asof_et, created_at_et, spot, inputs_hash }[], updatedAt }
 *   sürüm   `spyengine_dayplan_{SYMBOL}_{YYYY-MM-DD}_v{N}` = DayPlan payload (yazıldıktan sonra değişmez)
 * (spy_forecast_snapshots / spy_forecast_levels tabloları yerine: projede DDL göçü bu yoldan yapılmıyor; şekil
 *  docs/DATA_CONTRACTS.md'de kayıtlı. Seviyeler payload.levels içinde.)
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { nyParts } from "./core";
import { buildDayPlan, tradeDateOf, type DayPlan, type Straddle, type Walls } from "./dayPlan";
import { bars5Extended, dailyBars, dailyRawBars, ivAt, macroEvents, megaEarnings, relSymbolsFor } from "./dayPlanFetch";
import { fetchGex } from "./gexStore";
import { fetchOptionLevels } from "./optionFetch";

export interface DayVersion { v: number; asOf: number; asof_et: string; created_at_et: string; spot: number; inputs_hash: string }
interface DayRow { symbol: string; date: string; versions: DayVersion[]; updatedAt: string }

const MAX_VERSIONS = 120;
const keyOf = (symbol: string, date: string) => `spyengine_dayplan_${symbol}_${date}`;
const nowSec = () => Math.floor(Date.now() / 1000);
const etClock = (sec: number) => { const m = nyParts(sec).minutes; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

/** Opsiyon tabanlı girdiler yalnız CANLI hesapta (geçmiş zincir tutulmuyor → replay'de "veri yok") */
async function liveOptionInputs(symbol: string): Promise<{ walls: Walls | null; straddle: Straddle | null }> {
  let walls: Walls | null = null;
  let straddle: Straddle | null = null;
  try {
    if (symbol === "SPY") {
      const g = await fetchGex();
      const sc = g?.d0 ?? g?.d7 ?? null;
      if (g && sc && (sc.flip != null || sc.callWall != null || sc.putWall != null)) walls = { flip: sc.flip, callWall: sc.callWall, putWall: sc.putWall, source: `Cboe gecikmeli zincir (${g.source})` };
    }
  } catch { /* gamma yok */ }
  try {
    const ol = await fetchOptionLevels(symbol);
    if (ol) {
      if (!walls && (ol.callWalls.length || ol.putWalls.length)) {
        walls = { flip: null, callWall: ol.callWalls[0]?.strike ?? null, putWall: ol.putWalls[0]?.strike ?? null, source: `Yahoo ${ol.expiry} ${ol.basis === "OI" ? "açık pozisyon" : "hacim"}` };
      }
      const q = [...ol.quotes].filter((x) => x.callMid != null && x.putMid != null && x.callMid > 0 && x.putMid > 0)
        .sort((a, b) => Math.abs(a.strike - ol.spot) - Math.abs(b.strike - ol.spot))[0];
      if (q) straddle = { expiry: `${ol.expiry}${ol.isZeroDte ? " (0DTE)" : ""}`, strike: q.strike, value: q.callMid! + q.putMid! };
    }
  } catch { /* zincir yok */ }
  return { walls, straddle };
}

export async function computePlan(symbol: string, asOf = nowSec()): Promise<DayPlan | null> {
  const live = Math.abs(nowSec() - asOf) < 600;
  const rels = relSymbolsFor(symbol);
  const [bars5, daily, dailyRaw, iv, macro, earn, opt, ...relBars] = await Promise.all([
    bars5Extended(symbol), dailyBars(symbol), dailyRawBars(symbol), ivAt(symbol, asOf), macroEvents(), megaEarnings(),
    live ? liveOptionInputs(symbol) : Promise.resolve({ walls: null, straddle: null }),
    ...rels.map((s) => bars5Extended(s)),
  ]);
  return buildDayPlan({
    symbol, asOf, bars5, daily, dailyRaw, iv, macroEvents: macro, earnings: earn,
    walls: opt.walls, straddle: opt.straddle, rel: rels.map((s, i) => ({ symbol: s, bars5: relBars[i] })),
  });
}

export async function readDay(symbol: string, date: string): Promise<DayRow | null> {
  const { data, error } = await supabaseAdmin.from("shared_store").select("value").eq("key", keyOf(symbol, date)).maybeSingle();
  if (error) throw new Error(error.message);
  const v = data?.value as DayRow | undefined;
  return v?.versions ? v : null;
}

export async function readVersion(symbol: string, date: string, v: number): Promise<DayPlan | null> {
  const { data, error } = await supabaseAdmin.from("shared_store").select("value").eq("key", `${keyOf(symbol, date)}_v${v}`).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value as DayPlan | undefined) ?? null;
}

const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(k) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(k, next.catch(() => undefined));
  return next;
}

/**
 * Yeni sürüm kaydeder. force=false: girdi özeti son sürümle aynıysa yeni sürüm açılmaz (aynı girdi = aynı plan).
 * Dönüş: kaydedilen (ya da değişmeyen son) sürüm.
 */
export async function saveVersion(plan: DayPlan, force: boolean): Promise<{ version: DayVersion; payload: DayPlan | null; created: boolean }> {
  const { symbol, date } = plan.meta;
  return withLock(keyOf(symbol, date), async () => {
    const row: DayRow = (await readDay(symbol, date)) ?? { symbol, date, versions: [], updatedAt: "" };
    const last = row.versions[row.versions.length - 1];
    if (last && !force && last.inputs_hash === plan.meta.inputs_hash) return { version: last, payload: null, created: false };
    const v = (last?.v ?? 0) + 1;
    const payload: DayPlan = { ...plan, meta: { ...plan.meta, version: `v${v}` } };
    // önce sürüm satırı (değişmez), sonra indeks — indeks yazılamazsa sürüm görünmez ama bozuk kayıt oluşmaz
    const w1 = await supabaseAdmin.from("shared_store").upsert({ key: `${keyOf(symbol, date)}_v${v}`, value: payload }, { onConflict: "key" });
    if (w1.error) throw new Error(w1.error.message);
    const ver: DayVersion = { v, asOf: plan.meta.asOf, asof_et: plan.meta.asof_et, created_at_et: etClock(nowSec()), spot: plan.meta.spot, inputs_hash: plan.meta.inputs_hash };
    row.versions = [...row.versions, ver].slice(-MAX_VERSIONS);
    row.updatedAt = new Date().toISOString();
    const w2 = await supabaseAdmin.from("shared_store").upsert({ key: keyOf(symbol, date), value: row }, { onConflict: "key" });
    if (w2.error) throw new Error(w2.error.message);
    return { version: ver, payload, created: true };
  });
}

/** Canlı pencere (hafta içi 04:00–16:05 ET) içinde son sürüm 5 dk'dan eskiyse ya da hiç yoksa yenisini üretir */
export async function ensureFresh(symbol: string): Promise<DayRow | null> {
  const t = nowSec();
  const date = tradeDateOf(t);
  const row = await readDay(symbol, date).catch(() => null);
  const last = row?.versions[row.versions.length - 1];
  const p = nyParts(t);
  const wd = new Date(`${p.ymd}T12:00:00Z`).getUTCDay();
  const liveWindow = p.ymd === date && wd >= 1 && wd <= 5 && p.minutes >= 4 * 60 && p.minutes <= 16 * 60 + 5;
  if (last && (!liveWindow || t - last.asOf < 300)) return row;
  const plan = await computePlan(symbol, t);
  if (!plan) return row;
  await saveVersion(plan, false);
  return readDay(symbol, date);
}

export const versionList = (row: DayRow | null) => (row?.versions ?? []).map((x) => ({ v: x.v, asof_et: x.asof_et, created_at_et: x.created_at_et, spot: x.spot }));
