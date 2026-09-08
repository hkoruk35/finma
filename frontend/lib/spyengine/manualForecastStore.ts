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
  /** Kapanış tahmini — tek zorunlu alan (mumlu grafik için open/high/low de girilebilir) */
  close: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface ManualForecastSession {
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  points: ManualForecastPoint[];
}

export interface ManualForecastPayload {
  sessions: Record<string, ManualForecastSession>;
}

/** Eski format (`{time, price}`) noktalarını yeni `{time, close}` şekline çevirir — geriye dönük uyumluluk. */
function normalizePoint(p: ManualForecastPoint | (ManualForecastPoint & { price?: number })): ManualForecastPoint {
  if (p.close == null && typeof (p as { price?: number }).price === "number") {
    return { time: p.time, close: (p as { price: number }).price };
  }
  return p;
}

export async function readManualForecasts(): Promise<ManualForecastPayload> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store")
      .select("value")
      .eq("key", MANUAL_FORECAST_STORE_KEY)
      .maybeSingle();
    const value = data?.value as ManualForecastPayload | undefined;
    if (value && typeof value === "object" && value.sessions) {
      for (const s of Object.values(value.sessions)) {
        s.points = s.points.map(normalizePoint);
      }
      return value;
    }
  } catch {
    // Supabase erişilemiyorsa boş dön — sayfa yine de çalışsın.
  }
  return { sessions: {} };
}

export async function writeManualForecastSession(
  date: string,
  points: ManualForecastPoint[]
): Promise<ManualForecastSession> {
  const store = await readManualForecasts();
  const existing = store.sessions[date];
  const now = new Date().toISOString();
  const rec: ManualForecastSession = {
    date,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    points: points.slice().sort((a, b) => (a.time < b.time ? -1 : 1)),
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
