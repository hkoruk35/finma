/**
 * SPY gamma kaydı (sunucu): Cboe gecikmeli zinciri + Supabase `shared_store` anahtarı `spyengine_gex_log`.
 * Zamanlı yazıcı üretim sunucusu içindeki gexScheduler'dır; sayfa yalnız okur. Kayıt yalnız ölçüm içindir,
 * Takip Sistemi kararlarına girmez.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { nyParts } from "./core";
import { computeGex, type GexRead } from "./gex";

const URL = "https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json";
const STORE_KEY = "spyengine_gex_log";
const CACHE_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 90;
const BUCKET_MIN = 30;
const FIRST_MIN = 9 * 60;
const LAST_MIN = 16 * 60 + 10;

export interface GexSnapshot extends GexRead { bucket: number }
interface Store { sessions: Record<string, { date: string; snapshots: GexSnapshot[] }>; updatedAt: string }

let cache: { at: number; value: GexRead } | null = null;

export async function fetchGex(): Promise<GexRead | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return cache?.value ?? null;
    const value = computeGex(await res.json(), Math.floor(Date.now() / 1000));
    if (!value) return cache?.value ?? null;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return cache?.value ?? null;
  }
}

async function readStore(): Promise<Store> {
  const { data, error } = await supabaseAdmin.from("shared_store").select("value").eq("key", STORE_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  const v = data?.value as Store | undefined;
  return v?.sessions ? v : { sessions: {}, updatedAt: "" };
}

export async function readGexDay(date: string): Promise<GexSnapshot[]> {
  try {
    return (await readStore()).sessions[date]?.snapshots ?? [];
  } catch {
    return [];
  }
}

/** Kayıt saatindeyse NY tarihi ve 30 dakikalık dilim */
export function currentGexBucket(nowSec = Math.floor(Date.now() / 1000)): { date: string; bucket: number } | null {
  const now = nyParts(nowSec);
  if (now.weekday < 1 || now.weekday > 5 || now.minutes < FIRST_MIN || now.minutes > LAST_MIN) return null;
  return { date: now.ymd, bucket: Math.floor(now.minutes / BUCKET_MIN) * BUCKET_MIN };
}

/** NY işlem saatlerinde 30 dakikalık dilim başına bir özet yazar. */
export async function recordGexSnapshot(): Promise<{ saved: boolean; reason: string; date: string; bucket: number | null; count: number }> {
  const slot = currentGexBucket();
  if (!slot) return { saved: false, reason: "kayıt saati dışında", date: nyParts(Math.floor(Date.now() / 1000)).ymd, bucket: null, count: 0 };
  const { date, bucket } = slot;
  const store = await readStore();
  const day = store.sessions[date] ?? { date, snapshots: [] };
  if (day.snapshots.some((s) => s.bucket === bucket)) {
    return { saved: false, reason: "bu dilim zaten kayıtlı", date, bucket, count: day.snapshots.length };
  }
  const read = await fetchGex();
  if (!read) throw new Error("Cboe zinciri alınamadı");

  day.snapshots = [...day.snapshots, { ...read, bucket }].sort((a, b) => a.bucket - b.bucket);
  store.sessions[date] = day;
  for (const k of Object.keys(store.sessions).sort().reverse().slice(MAX_SESSIONS)) delete store.sessions[k];
  store.updatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin.from("shared_store").upsert({ key: STORE_KEY, value: store }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { saved: true, reason: "kaydedildi", date, bucket, count: day.snapshots.length };
}
