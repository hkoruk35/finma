/**
 * SPY Engine V11 — sunucu servisi: veriyi çeker, motoru çalıştırır, anlık
 * görüntüyü üretir. Karar mantığı burada DEĞİL (engine.ts'te); burası yalnızca
 * veri toplama + önbellek.
 *
 * Veri: Yahoo 5m (60 gün geçmiş, 6 sa önbellek) + canlı 5m (5 gün, 6 sn önbellek)
 * birleştirilir; bugünün mumları canlı kaynaktan gelir.
 */

import "server-only";
import { nyParts, nyDateTimeToEpoch, type Bar } from "../core";
import { fetchSpyBundle, fetchSpy5mHistory } from "../market";
import { fetchOptionLevels } from "../optionFetch";
import { prepare, runDay } from "./engine";
import { buildArchive, type ArchiveStats } from "./archive";
import { buildSnapshot, type V11Snapshot } from "./snapshot";
import { V11_CONFIG as CFG } from "./config";

let archiveCache: { key: string; at: number; value: ArchiveStats } | null = null;

function phaseOf(nowSec: number): "PRE" | "RTH" | "POST" | "CLOSED" {
  const p = nyParts(nowSec);
  if (p.weekday === 0 || p.weekday === 6) return "CLOSED";
  if (p.minutes >= 4 * 60 && p.minutes < 9 * 60 + 30) return "PRE";
  if (p.minutes >= 9 * 60 + 30 && p.minutes < 16 * 60) return "RTH";
  if (p.minutes >= 16 * 60 && p.minutes < 20 * 60) return "POST";
  return "CLOSED";
}

function merge(hist: Bar[], live: Bar[]): Bar[] {
  const m = new Map<number, Bar>();
  for (const b of hist) m.set(b.time, b);
  for (const b of live) m.set(b.time, b);
  return Array.from(m.values()).sort((a, b) => a.time - b.time);
}

export async function getV11Snapshot(opts: { date?: string | null; asof?: string | null } = {}): Promise<V11Snapshot> {
  const realNow = Math.floor(Date.now() / 1000);
  const [bundle, hist] = await Promise.all([fetchSpyBundle(), fetchSpy5mHistory().catch(() => ({ bars: [] as Bar[] }))]);
  const m5All = merge(hist.bars, bundle.m5);

  // geriye dönük oynatma: ?date=YYYY-MM-DD[&asof=HH:MM]
  const replayDate = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : null;
  let nowSec = realNow;
  let ymd = nyParts(realNow).ymd;
  if (replayDate) {
    ymd = replayDate;
    const m = opts.asof && /^(\d{1,2}):(\d{2})$/.exec(opts.asof);
    const min = m ? Number(m[1]) * 60 + Number(m[2]) : 16 * 60;
    nowSec = nyDateTimeToEpoch(replayDate, min);
  }

  const prep = prepare(m5All, nowSec);
  if (!prep.dayRange.has(ymd) && prep.days.length) {
    // bugün henüz RTH mumu yok (seans öncesi / hafta sonu) → son seansı göster
    ymd = prep.days[prep.days.length - 1];
  }

  let options = null;
  if (!replayDate && ymd === nyParts(realNow).ymd) options = await fetchOptionLevels().catch(() => null);
  const run = runDay(prep, ymd, { options });

  // arşiv (6 sa önbellek): geçmiş günlerin olay isabeti + V11 hüküm sonuçları
  const lastPast = prep.days.filter((d) => d !== ymd).slice(-1)[0] ?? "";
  const key = `${lastPast}:${prep.days.length}`;
  if (!archiveCache || archiveCache.key !== key || Date.now() - archiveCache.at > CFG.serve.archiveTtlSec * 1000) {
    try {
      archiveCache = { key, at: Date.now(), value: buildArchive(m5All, nowSec) };
    } catch {
      archiveCache = null;
    }
  }

  const phase = replayDate ? "CLOSED" : phaseOf(realNow);
  let ah: { label: "AH" | "PM"; price: number } | null = null;
  if (!replayDate && phase !== "RTH" && bundle.marketPrice != null && bundle.marketTime != null) {
    const lastEnd = run.last?.end ?? 0;
    if (bundle.marketTime >= lastEnd) ah = { label: phase === "PRE" ? "PM" : "AH", price: bundle.marketPrice };
  }
  // yalnızca açıkça seans dışı bir son fiyat varsa; RTH'de fiyat zaten karar alanında
  const snap = buildSnapshot({
    prep, run, archive: archiveCache?.value ?? null, nowSec, replay: !!replayDate, phase, ah,
    experimentalExtra: [
      { name: "Tahmin haritası · gün sonu kapanış tahmini", detail: "V10 ölçümü isabet %41 (<%50) — V11 ana ekranında yok; yalnızca V10 sayfasında" },
    ],
  });
  return snap;
}
