/**
 * Günlük Plan zamanlayıcısı (üretim Next.js sunucusu içinde, gexScheduler ile aynı desen).
 * Dakikada bir bakar; hafta içi SNAPSHOT_MIN saatlerinde (04:05, 06:45, 08:35, 09:15, 09:31…16:01 her 5 dk)
 * SPY/QQQ/IWM için yeni sürüm üretir. Girdi değişmediyse sürüm açılmaz. Diğer semboller sayfa açılınca üretilir.
 */

import { nyParts } from "./core";
import { SNAPSHOT_MIN } from "./dayPlanConfig";
import { computePlan, saveVersion } from "./dayPlanStore";

const SYMBOLS = ["SPY", "QQQ", "IWM"];
const TICK_MS = 60 * 1000;
const state = globalThis as typeof globalThis & { __dayPlanScheduler?: NodeJS.Timeout };
let done = "";
let running = false;

function dueSlot(): string | null {
  const t = Math.floor(Date.now() / 1000);
  const p = nyParts(t);
  const wd = new Date(`${p.ymd}T12:00:00Z`).getUTCDay();
  if (wd < 1 || wd > 5) return null;
  const slot = [...SNAPSHOT_MIN].reverse().find((m) => m <= p.minutes);
  if (slot == null || p.minutes - slot > 4) return null;
  return `${p.ymd}:${slot}`;
}

async function tick(): Promise<void> {
  const key = dueSlot();
  if (!key || key === done || running) return;
  running = true;
  try {
    for (const s of SYMBOLS) {
      try {
        const plan = await computePlan(s);
        if (plan) await saveVersion(plan, false);
      } catch (e) {
        console.error(`[dayplan] ${s} ${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    done = key;
  } finally {
    running = false;
  }
}

export function startDayPlanScheduler(): void {
  if (state.__dayPlanScheduler) return;
  state.__dayPlanScheduler = setInterval(() => { void tick(); }, TICK_MS);
  state.__dayPlanScheduler.unref();
  console.log("[dayplan] zamanlayıcı başladı");
  void tick();
}
