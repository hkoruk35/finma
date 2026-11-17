/**
 * Günlük Plan zamanlayıcısı (üretim Next.js sunucusu içinde, gexScheduler ile aynı desen).
 * Dakikada bir bakar; hafta içi 04:00–16:00 her 5m kapanışından sonra (SNAPSHOT_MIN: 04:06 … 16:01) SPY/QQQ/IWM için
 * yeni sürüm üretir. Yahoo mumu geç yayınlarsa (girdi özeti değişmez → sürüm açılmaz) aynı dilimde 3 dk boyunca her dakika
 * yeniden dener. Diğer semboller sayfa açıkken üretilir.
 */

import { nyParts } from "./core";
import { SNAPSHOT_MIN } from "./dayPlanConfig";
import { computePlan, saveVersion } from "./dayPlanStore";

const SYMBOLS = ["SPY", "QQQ", "IWM"];
const TICK_MS = 60 * 1000;
const state = globalThis as typeof globalThis & { __dayPlanScheduler?: NodeJS.Timeout };
let done = "";
let running = false;

const created = new Set<string>();

function dueSlot(): { key: string; age: number } | null {
  const t = Math.floor(Date.now() / 1000);
  const p = nyParts(t);
  const wd = new Date(`${p.ymd}T12:00:00Z`).getUTCDay();
  if (wd < 1 || wd > 5) return null;
  const slot = [...SNAPSHOT_MIN].reverse().find((m) => m <= p.minutes);
  if (slot == null || p.minutes - slot > 4) return null;
  return { key: `${p.ymd}:${slot}`, age: p.minutes - slot };
}

async function tick(): Promise<void> {
  const due = dueSlot();
  if (!due || due.key === done || running) return;
  const { key, age } = due;
  running = true;
  try {
    for (const s of SYMBOLS) {
      if (created.has(`${key}:${s}`)) continue;
      try {
        const plan = await computePlan(s);
        if (plan && (await saveVersion(plan, false)).created) created.add(`${key}:${s}`);
      } catch (e) {
        console.error(`[dayplan] ${s} ${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (age >= 3 || SYMBOLS.every((s) => created.has(`${key}:${s}`))) {
      done = key;
      for (const k of [...created]) if (!k.startsWith(`${key}:`)) created.delete(k);
    }
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
