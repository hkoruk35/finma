/**
 * Karar Günlüğü deposu (sunucu) — SPY ve QQQ Engine için ortak fabrika. Supabase `shared_store`.
 *
 * • Tamamlanan her seans için DecisionDay (lib/spyengine/decisionCore.ts) bir kez yazılır ve DONDURULUR
 *   (o günkü kod sürümünün gerçek kararları). İlk çalıştırmada Yahoo'nun sakladığı son ~60 gün
 *   walk-forward (her gün yalnız önceki günlerin modeliyle) geriye dönük doldurulur (`backfill: true`).
 *   Eski sürümle üretilmiş GERİYE DÖNÜK kayıtlar yeni motorla yeniden üretilir; canlı kayıtlı günler dondurulmuş kalır.
 * • Gün yaşanırken tarayıcıdan gelen anlık kararlar (`live`) gün kaydına eklenir; gün kapanınca kayda birleşir.
 * • Model (learnFromLog) arşivden her güncellemede yeniden öğrenilir.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, type Bar } from "./core";
import { chart } from "./openForecastFetch";
import { buildDecisionDay, learnFromLog, ENGINE_VERSION, type DecisionDay, type DecisionModel, type LiveEvent } from "./decisionCore";
import type { LadderCfg, LadderInput } from "./ladder";

const MAX_DAYS = 300;
const MAX_LIVE_PER_DAY = 400;

interface Pending { date: string; live: LiveEvent[] }
interface Store { days: Record<string, DecisionDay>; pending: Record<string, Pending>; updatedAt: string }

export interface DecisionLogOptions {
  /** shared_store anahtarı */
  key: string;
  /** Yahoo sembolü (5m mumlar) */
  symbol: string;
  /** Motorun taban ayarı */
  cfg?: LadderCfg;
  /** Ek semboller (QQQ: teknoloji liderleri) ve onlardan günlük girdi üretici */
  extra?: { symbols: string[]; techFor: (by: Record<string, Bar[]>, main: Bar[]) => (date: string, nowSec: number) => LadderInput["tech"] };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function createDecisionLog(o: DecisionLogOptions) {
  async function readStore(): Promise<Store> {
    try {
      const { data } = await supabaseAdmin.from("shared_store").select("value").eq("key", o.key).maybeSingle();
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
    await supabaseAdmin.from("shared_store").upsert({ key: o.key, value: s }, { onConflict: "key" });
  }

  const prep = async (range: string) => {
    const raw = await chart(o.symbol, range);
    const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(raw), 300)).bars;
    let techFor: ReturnType<NonNullable<DecisionLogOptions["extra"]>["techFor"]> | undefined;
    if (o.extra) {
      const by: Record<string, Bar[]> = { [o.symbol]: m5 };
      await Promise.all(
        o.extra.symbols.map(async (s) => {
          try { by[s] = dropBadPrints(snapToInterval(normalizeBars(await chart(s, range)), 300)).bars; } catch { by[s] = []; }
        }),
      );
      techFor = o.extra.techFor(by, m5);
    }
    return { m5, techFor };
  };

  let memo: { at: number; days: DecisionDay[]; model: DecisionModel; added: string[] } | null = null;

  /** Eksik tamamlanmış seansları arşivler; modeli döndürür. 10 dk önbellekli. */
  async function update(force = false): Promise<{ days: DecisionDay[]; model: DecisionModel; added: string[] }> {
    if (!force && memo && Date.now() - memo.at < 10 * 60 * 1000) return memo;
    const store = await readStore();
    const empty = Object.keys(store.days).length === 0;
    const isStale = (x: DecisionDay) => x.backfill && x.version !== ENGINE_VERSION && !x.live?.length;
    const staleAny = Object.values(store.days).some(isStale);
    const { m5, techFor } = await prep(empty || staleAny ? "60d" : "10d");
    const added: string[] = [];
    let dirty = false;
    if (m5.length) {
      const np = nyParts(Math.floor(Date.now() / 1000));
      const dates = Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
      const ordered = () => Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
      for (const d of dates) {
        const stale = !!store.days[d] && isStale(store.days[d]);
        if (store.days[d] && !stale) continue;
        if (d === np.ymd && np.minutes < 16 * 60 + 5) continue; // seans bitmedi
        if (d > np.ymd) continue;
        const prior = ordered().filter((x) => x.date < d);
        const rec = buildDecisionDay({ m5, date: d, backfill: empty || stale, model: prior.length ? learnFromLog(prior) : null, live: store.pending[d]?.live, baseCfg: o.cfg, techFor });
        if (!rec) continue;
        store.days[d] = rec;
        delete store.pending[d];
        added.push(d);
        dirty = true;
      }
      for (const k of Object.keys(store.pending)) if (k < dates[Math.max(0, dates.length - 10)]) { delete store.pending[k]; dirty = true; }
    }
    if (dirty) {
      try { await writeStore(store); } catch { /* yazılamadıysa sonraki çağrıda yeniden denenir */ }
    }
    const days = Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
    const model = learnFromLog(days);
    memo = { at: Date.now(), days, model, added };
    return memo;
  }

  /** Tarayıcıdan gelen anlık kararları günün bekleyen kaydına ekler (aynı olay iki kez yazılmaz) */
  async function appendLive(date: string, events: LiveEvent[]): Promise<number> {
    if (!DATE_RE.test(date) || !events.length) return 0;
    const store = await readStore();
    if (store.days[date]) return 0; // gün zaten donduruldu
    const p = (store.pending[date] ??= { date, live: [] });
    const seen = new Set(p.live.map((e) => `${e.t}|${e.status}|${e.side}|${e.mode}`));
    let n = 0;
    for (const e of events) {
      const k = `${e.t}|${e.status}|${e.side}|${e.mode}`;
      if (seen.has(k) || p.live.length >= MAX_LIVE_PER_DAY) continue;
      seen.add(k);
      p.live.push(e);
      n++;
    }
    if (n) await writeStore(store);
    return n;
  }

  return { update, appendLive };
}

/** SPY Engine karar günlüğü */
const spy = createDecisionLog({ key: "spyengine_decisions", symbol: "SPY" });
export const updateDecisionLog = spy.update;
export const appendLiveEvents = spy.appendLive;
