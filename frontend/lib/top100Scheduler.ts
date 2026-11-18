/**
 * Top 100 Tracker zamanlayıcısı (üretim Next.js sunucusu içinde, gexScheduler ile aynı desen).
 *
 * Neden: Vercel cron'ları (/api/cron/refresh-top100, /api/cron/top100-swing-composition) Hetzner'e
 * geçişten sonra hiçbir şey tarafından tetiklenmiyordu; yerel PC görevleri de 403 veriyordu → Top 100
 * 2026-09-03'ten beri donmuştu. Bu zamanlayıcı yerel PC'ye, Vercel'e ve gizli anahtar eşitlemeye bağlı
 * değildir: Supabase'e doğrudan (servis anahtarıyla) yazar.
 *
 *  - Hafta içi NY 09:35, 10:05 … 16:05: 'fixed' (/tracker listesi) + mevcut 'swing_daily' satırlarının
 *    fiyat/gösterge tazelemesi.
 *  - Hafta içi NY 14:00 sonrası ilk dakika: swing_daily kompozisyonu (/swing en yüksek 10 skor).
 * Başarısız dilim sonraki dakikada yeniden denenir (en fazla 20 dk pencere).
 */

import { nyParts } from "./spyengine/core";
import { supabaseAdmin } from "./supabase-admin";
import { getSwingAllPicks } from "./data";
import { syncTop100Composition } from "./top100Sync";

const TICK_MS = 60 * 1000;
const WINDOW_MIN = 20;
const SWING_TOP_N = 10;
// 09:35, sonra her saat :05 (10:05 … 16:05)
const REFRESH_SLOTS = [9 * 60 + 35, ...[10, 11, 12, 13, 14, 15, 16].map((h) => h * 60 + 5)];
const COMPOSITION_SLOT = 14 * 60;

const state = globalThis as typeof globalThis & { __top100Scheduler?: NodeJS.Timeout };
const done = new Set<string>();
let running = false;

function dueSlots(): { ymd: string; refresh: number | null; composition: boolean } | null {
  const p = nyParts(Math.floor(Date.now() / 1000));
  const wd = new Date(`${p.ymd}T12:00:00Z`).getUTCDay();
  if (wd < 1 || wd > 5) return null;
  const within = (slot: number) => p.minutes >= slot && p.minutes - slot <= WINDOW_MIN;
  const refresh = REFRESH_SLOTS.find(within) ?? null;
  return { ymd: p.ymd, refresh, composition: within(COMPOSITION_SLOT) };
}

async function refreshFixed(): Promise<void> {
  const { data: row } = await supabaseAdmin.from("shared_store").select("value").eq("key", "tracker_v1").single();
  const tickers: string[] = Array.from(new Set(row?.value?.tickers ?? []));
  if (tickers.length === 0) throw new Error("tracker_v1 bos");
  const r = await syncTop100Composition("fixed", tickers);
  if (!r.ok) throw new Error(`fixed: ${r.error}`);
  console.log(`[top100] fixed: ${r.updated.length} güncellendi, ${r.failed.length} başarısız`);
}

async function refreshSwingRows(): Promise<void> {
  const { data } = await supabaseAdmin.from("top100_tickers").select("ticker").eq("source", "swing_daily").eq("active", true);
  const tickers = (data ?? []).map((t) => t.ticker as string);
  if (tickers.length === 0) return;
  const r = await syncTop100Composition("swing_daily", tickers);
  if (!r.ok) throw new Error(`swing_daily: ${r.error}`);
  console.log(`[top100] swing_daily tazelendi: ${r.updated.length}`);
}

async function refreshComposition(): Promise<void> {
  const data = await getSwingAllPicks();
  const picks: any[] = data?.picks ?? [];
  // Boş liste kompozisyonu silerdi; veri gelmediyse dokunma.
  if (picks.length === 0) return;
  const top = [...picks]
    .sort((a, b) => (b?.score ?? b?.boga_score ?? 0) - (a?.score ?? a?.boga_score ?? 0))
    .slice(0, SWING_TOP_N)
    .map((p) => p.ticker)
    .filter(Boolean);
  if (top.length === 0) return;
  const r = await syncTop100Composition("swing_daily", top);
  if (!r.ok) throw new Error(`composition: ${r.error}`);
  console.log(`[top100] swing_daily kompozisyonu: ${top.join(",")}`);
}

async function tick(): Promise<void> {
  if (running) return;
  const due = dueSlots();
  if (!due) return;
  const jobs: { key: string; run: () => Promise<void> }[] = [];
  if (due.composition) jobs.push({ key: `${due.ymd}:comp`, run: refreshComposition });
  if (due.refresh != null) {
    jobs.push({ key: `${due.ymd}:fixed:${due.refresh}`, run: refreshFixed });
    jobs.push({ key: `${due.ymd}:swing:${due.refresh}`, run: refreshSwingRows });
  }
  const pending = jobs.filter((j) => !done.has(j.key));
  if (pending.length === 0) return;
  running = true;
  try {
    for (const j of pending) {
      try {
        await j.run();
        done.add(j.key);
      } catch (e) {
        console.error(`[top100] ${j.key} başarısız: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    running = false;
    if (done.size > 200) done.clear();
  }
}

export function startTop100Scheduler(): void {
  if (state.__top100Scheduler) return;
  state.__top100Scheduler = setInterval(() => { void tick(); }, TICK_MS);
  state.__top100Scheduler.unref();
  console.log("[top100] zamanlayıcı başladı");
  void tick();
}
