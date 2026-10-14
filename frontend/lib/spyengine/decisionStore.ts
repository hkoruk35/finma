/**
 * SPY Engine — Karar Günlüğü deposu (sunucu). Supabase `shared_store` / `spyengine_decisions`.
 *
 * • Tamamlanan her seans için DecisionDay (lib/spyengine/decisionCore.ts) bir kez yazılır ve DONDURULUR
 *   (o günkü kod sürümünün gerçek kararları). İlk çalıştırmada Yahoo'nun sakladığı son ~60 gün
 *   walk-forward (her gün yalnız önceki günlerin modeliyle) geriye dönük doldurulur (`backfill: true`).
 * • Gün yaşanırken tarayıcıdan gelen anlık kararlar (`live`) gün kaydına eklenir; gün kapanınca kayda birleşir.
 * • Model (learnFromLog) arşivden her güncellemede yeniden öğrenilir.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, type Bar } from "./core";
import { chart } from "./openForecastFetch";
import { buildDecisionDay, learnFromLog, type DecisionDay, type DecisionModel, type LiveEvent } from "./decisionCore";

const STORE_KEY = "spyengine_decisions";
const MAX_DAYS = 300;
const MAX_LIVE_PER_DAY = 400;

interface Pending { date: string; live: LiveEvent[] }
interface Store { days: Record<string, DecisionDay>; pending: Record<string, Pending>; updatedAt: string }

async function readStore(): Promise<Store> {
  try {
    const { data } = await supabaseAdmin.from("shared_store").select("value").eq("key", STORE_KEY).maybeSingle();
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
  await supabaseAdmin.from("shared_store").upsert({ key: STORE_KEY, value: s }, { onConflict: "key" });
}

let memo: { at: number; days: DecisionDay[]; model: DecisionModel; added: string[] } | null = null;

/** Eksik tamamlanmış seansları arşivler; modeli döndürür. 10 dk önbellekli. */
export async function updateDecisionLog(force = false): Promise<{ days: DecisionDay[]; model: DecisionModel; added: string[] }> {
  if (!force && memo && Date.now() - memo.at < 10 * 60 * 1000) return memo;
  const store = await readStore();
  const empty = Object.keys(store.days).length === 0;
  const raw = await chart("SPY", empty ? "60d" : "10d");
  const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(raw), 300)).bars;
  const added: string[] = [];
  let dirty = false;
  if (m5.length) {
    const np = nyParts(Math.floor(Date.now() / 1000));
    const dates = Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
    const ordered = () => Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
    for (const d of dates) {
      if (store.days[d]) continue;
      if (d === np.ymd && np.minutes < 16 * 60 + 5) continue; // seans bitmedi
      if (d > np.ymd) continue;
      const model = learnFromLog(ordered().filter((x) => x.date < d)); // walk-forward: yalnız önceki günler
      const rec = buildDecisionDay({ m5, date: d, backfill: empty, model: ordered().length ? model : null, live: store.pending[d]?.live });
      if (!rec) continue;
      store.days[d] = rec;
      delete store.pending[d];
      added.push(d);
      dirty = true;
    }
    // sona ermiş ama kayda dönüşmemiş eski bekleyenleri temizle (veri yoksa 10 günden eskisi atılır)
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
export async function appendLiveEvents(date: string, events: LiveEvent[]): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !events.length) return 0;
  const store = await readStore();
  if (store.days[date]) return 0; // gün zaten donduruldu
  const p = (store.pending[date] ??= { date, live: [] });
  const seen = new Set(p.live.map((e) => `${e.t}|${e.status}|${e.side}|${e.mode}`));
  let n = 0;
  for (const e of events) {
    const k = `${e.t}|${e.status}|${e.side}|${e.mode}`;
    if (seen.has(k) || p.live.length >= MAX_LIVE_PER_DAY) continue;
    seen.add(k); p.live.push(e); n++;
  }
  if (n) await writeStore(store);
  return n;
}
