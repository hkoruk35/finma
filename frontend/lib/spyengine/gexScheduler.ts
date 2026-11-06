/**
 * SPY gamma kaydı zamanlayıcısı. Next.js üretim sunucusu içinde dakikada bir kontrol eder ve 30 dakikalık dilim başına
 * en fazla bir kayıt yazar. Başarısız dilim sonraki dakikada yeniden denenir. Takip Sistemi kararlarına girmez.
 */

import { currentGexBucket, recordGexSnapshot } from "./gexStore";

const TICK_MS = 60 * 1000;
const state = globalThis as typeof globalThis & { __spyGexScheduler?: NodeJS.Timeout };

let done = "";
let running = false;

async function tick(): Promise<void> {
  const slot = currentGexBucket();
  if (!slot || running) return;
  const key = `${slot.date}:${slot.bucket}`;
  if (key === done) return;
  running = true;
  try {
    const result = await recordGexSnapshot();
    done = key;
    if (result.saved) console.log(`[gex] ${result.date} ${result.bucket} kaydedildi (${result.count})`);
  } catch (e) {
    console.error(`[gex] ${key} kaydedilemedi: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    running = false;
  }
}

export function startGexScheduler(): void {
  if (state.__spyGexScheduler) return;
  state.__spyGexScheduler = setInterval(() => { void tick(); }, TICK_MS);
  state.__spyGexScheduler.unref();
  console.log("[gex] zamanlayıcı başladı");
  void tick();
}
