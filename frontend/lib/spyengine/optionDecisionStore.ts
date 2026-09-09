/**
 * SPY Engine — SPY 0DTE opsiyon Greeks + prim eğrisi okuma katmanı (Faz 2,
 * bkz. tasks/active/013).
 *
 * Bu veri opsiyon242.py'den DEĞİL, ondan tamamen bağımsız
 * `spy_0dte_options_sync.py`'den gelir (repo kökü) — o script neden ayrı
 * olduğunu kendi başlığında anlatıyor (opsiyon242'nin sabit kapısı ve
 * DTE aralığı SPY için uygun değil). Supabase `shared_store` KV üzerinden
 * DOĞRUDAN REST ile yazılıyor (robinhood_spy_sync.py ile aynı desen —
 * `/api/internal/*-sync` + x-revalidate-secret yolunun sır uyuşmazlığı
 * yüzünden güvenilmez olduğu zaten keşfedilmişti, bkz. o dosyanın yorumu).
 *
 * Uydurma yok: script hiç çalışmadıysa veya veri bayatsa (bkz.
 * OPTION_DECISION_STALE_AFTER_SEC) `null` döner, arayüz "veri yok" gösterir.
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const OPTION_DECISION_STORE_KEY = "spyengine_option_decision";
/** Script günde 2 kez (11:00 & 15:30 NY) çalışıyor — 6 saatten eski veri bayat sayılır */
export const OPTION_DECISION_STALE_AFTER_SEC = 6 * 60 * 60;

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionLeg {
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  impliedVolatility: number | null;
  greeks: OptionGreeks;
}

export interface PremiumCurvePoint {
  targetPrice: number;
  callPremium: number;
  putPremium: number;
}

export interface OptionContractSnapshot {
  strike: number;
  call: OptionLeg;
  put: OptionLeg;
  premiumCurve: PremiumCurvePoint[];
}

export interface OptionDecisionSnapshot {
  generatedAt: string;
  spot: number;
  expiry: string;
  isZeroDte: boolean;
  yearsToExpiry: number;
  riskFreeRate: number;
  contracts: OptionContractSnapshot[];
}

export async function readOptionDecision(): Promise<OptionDecisionSnapshot | null> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store")
      .select("value, updated_at")
      .eq("key", OPTION_DECISION_STORE_KEY)
      .maybeSingle();
    const value = data?.value as OptionDecisionSnapshot | undefined;
    if (!value || typeof value !== "object" || !Array.isArray(value.contracts)) return null;

    const updatedAt = data?.updated_at ? Date.parse(data.updated_at) / 1000 : null;
    if (updatedAt != null && Date.now() / 1000 - updatedAt > OPTION_DECISION_STALE_AFTER_SEC) return null;

    return value;
  } catch {
    // Supabase erişilemiyorsa sessizce null -- sayfa yine de çalışsın.
    return null;
  }
}
