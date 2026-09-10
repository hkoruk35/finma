/**
 * SPY Engine — Karar Sayfası anlık görüntü günlüğü (Faz 4 hazırlığı, bkz.
 * tasks/active/013 "Kalan İşler" #1).
 *
 * Faz 4 (Tier 3 skorlarının lojistik regresyonla gerçek olasılığa
 * kalibrasyonu) yeterli GEÇMİŞ veri gerektirir — bu veri hiçbir yerde
 * birikmiyordu. Bu modül, her YENİ kapanan 5m barda (poll başına DEĞİL —
 * `route.ts`'teki bellek-içi `lastLoggedBarTime` koruması bunu sağlar) bir
 * anlık görüntüyü Supabase `shared_store`'a ekliyor. Sadece GİRDİLERİ ve
 * O ANKİ TAHMİNLERİ kaydeder — "gerçekleşen" sonuç burada HESAPLANMAZ;
 * Faz 4'te ayrı bir "grading" adımı bu snapshot'ları gerçekleşen 5m
 * kapanışlarıyla eşleştirip Brier skoru / güvenilirlik eğrisi üretecek.
 *
 * Depolama: manualForecastStore.ts / archiveStore.ts ile AYNI desen
 * (`shared_store` KV, gün bazlı `sessions` sözlüğü, azami gün sayısıyla
 * budanır) — yeni bir Supabase tablosu/migration GEREKMEDİ.
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const DECISION_LOG_STORE_KEY = "spyengine_option_decision_log";
export const DECISION_LOG_MAX_DAYS = 30;
/** Bir günde en fazla bu kadar snapshot tutulur (5dk aralıkla ~78 RTH barı yeterince fazla) */
export const DECISION_LOG_MAX_PER_DAY = 100;

export interface DecisionLogSnapshot {
  /** Bu anlık görüntünün dayandığı, tohumlamada kullanılan kapalı 5m barın zamanı */
  barTime: number;
  loggedAt: string;
  spot: number;
  /** Tier 1 — 30 dakikalık ufukta, fiyat ızgarasındaki erişim olasılıkları (%) */
  tier1_30: { price: number; touchProbability: number }[];
  /** Tier 2 — en yakın strike'ın piyasa-örtük olasılığı (varsa) */
  tier2Nearest: { strike: number; callImpliedProb: number | null; putImpliedProb: number | null } | null;
  /** Tier 3 — kalibrasyon hedefi olacak ham skorlar */
  tier3: { reversalLong: number; reversalShort: number; exhaustionLong: number; exhaustionShort: number };
  /** Tier 5 — ATM'e en yakın seviyenin edge skorları */
  tier5Atm: { edgeLong: number; edgeShort: number } | null;
}

export interface DecisionLogDay {
  date: string;
  updatedAt: string;
  snapshots: DecisionLogSnapshot[];
}

export interface DecisionLogPayload {
  sessions: Record<string, DecisionLogDay>;
}

async function readLog(): Promise<DecisionLogPayload> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store")
      .select("value")
      .eq("key", DECISION_LOG_STORE_KEY)
      .maybeSingle();
    const value = data?.value as DecisionLogPayload | undefined;
    if (value && typeof value === "object" && value.sessions) return value;
  } catch {
    // Supabase erişilemiyorsa sessizce boş -- loglama best-effort, ana akışı asla bloklamaz.
  }
  return { sessions: {} };
}

/**
 * Bugünün gününe bir snapshot ekler. `barTime` zaten o günün son kaydında
 * varsa TEKRAR EKLEMEZ (idempotent) — çağıran taraf yine de her seferinde
 * çağırabilir, asıl tekilleştirme burada güvenceye alınır (bellek-içi
 * korumanın yanı sıra, sunucu yeniden başladığında da doğru davranır).
 */
export async function appendDecisionSnapshot(date: string, snapshot: DecisionLogSnapshot): Promise<void> {
  try {
    const log = await readLog();
    const day = log.sessions[date] ?? { date, updatedAt: new Date().toISOString(), snapshots: [] };
    const last = day.snapshots[day.snapshots.length - 1];
    if (last && last.barTime === snapshot.barTime) return; // zaten kaydedilmiş

    day.snapshots.push(snapshot);
    if (day.snapshots.length > DECISION_LOG_MAX_PER_DAY) {
      day.snapshots = day.snapshots.slice(-DECISION_LOG_MAX_PER_DAY);
    }
    day.updatedAt = new Date().toISOString();
    log.sessions[date] = day;

    const keys = Object.keys(log.sessions).sort().reverse().slice(0, DECISION_LOG_MAX_DAYS);
    const trimmed: Record<string, DecisionLogDay> = {};
    for (const k of keys) trimmed[k] = log.sessions[k];

    const { error } = await supabaseAdmin
      .from("shared_store")
      .upsert({ key: DECISION_LOG_STORE_KEY, value: { sessions: trimmed }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  } catch {
    // Loglama başarısız olsa bile Karar Sayfası'nın canlı yanıtı ETKİLENMEZ --
    // bu tamamen best-effort bir arka plan kaydı.
  }
}

export async function readDecisionLog(): Promise<DecisionLogPayload> {
  return readLog();
}
