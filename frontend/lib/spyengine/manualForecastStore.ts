/**
 * SPY Engine — Manuel Günlük Tahmin (Daily Forecast) depolama katmanı.
 *
 * Bu, motorun KENDİ ürettiği "Gün Kapanış Tahmini" bandından (bkz.
 * app/api/admin/spyengine/v2/forecast/route.ts) TAMAMEN AYRI bir özellik:
 * kullanıcı kendi manuel 5 dakikalık fiyat tahminini (09:30-16:00 ET, ~78
 * nokta) elle girer, sistem bunu o günün gerçekleşen SPY 5m kapanışlarıyla
 * karşılaştırıp arşivler. Amaç kullanıcının KENDİ tahmin yönteminin isabetini
 * ölçmek — motor kararına hiçbir etkisi yok.
 *
 * Depolama: Supabase `shared_store` KV, archiveStore.ts ile aynı desen.
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const MANUAL_FORECAST_STORE_KEY = "spyengine_manual_forecast";
export const MANUAL_FORECAST_MAX_SESSIONS = 90;

export interface ManualForecastPoint {
  /** "HH:MM" ET, 09:30–16:00 arası 5 dakikalık kova */
  time: string;
  /** Kullanıcının o an için tahmin ettiği fiyat */
  price: number;
}

export interface ManualForecastSession {
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  points: ManualForecastPoint[];
  /** Kullanıcının yüklediği referans görsel (varsa) */
  imageUrl: string | null;
}

export interface ManualForecastPayload {
  sessions: Record<string, ManualForecastSession>;
}

export async function readManualForecasts(): Promise<ManualForecastPayload> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store")
      .select("value")
      .eq("key", MANUAL_FORECAST_STORE_KEY)
      .maybeSingle();
    const value = data?.value as ManualForecastPayload | undefined;
    if (value && typeof value === "object" && value.sessions) return value;
  } catch {
    // Supabase erişilemiyorsa boş dön — sayfa yine de çalışsın.
  }
  return { sessions: {} };
}

export async function writeManualForecastSession(
  date: string,
  points: ManualForecastPoint[],
  imageUrl: string | null
): Promise<ManualForecastSession> {
  const store = await readManualForecasts();
  const existing = store.sessions[date];
  const now = new Date().toISOString();
  const rec: ManualForecastSession = {
    date,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    points: points.slice().sort((a, b) => (a.time < b.time ? -1 : 1)),
    imageUrl: imageUrl ?? existing?.imageUrl ?? null,
  };
  store.sessions[date] = rec;

  const keys = Object.keys(store.sessions).sort().reverse().slice(0, MANUAL_FORECAST_MAX_SESSIONS);
  const trimmed: Record<string, ManualForecastSession> = {};
  for (const k of keys) trimmed[k] = store.sessions[k];

  const { error } = await supabaseAdmin
    .from("shared_store")
    .upsert(
      { key: MANUAL_FORECAST_STORE_KEY, value: { sessions: trimmed }, updated_at: now },
      { onConflict: "key" }
    );
  if (error) throw new Error(error.message);

  return rec;
}
