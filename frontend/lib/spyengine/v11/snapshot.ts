/**
 * SPY Engine V11 — sayfaya giden tek yük (`V11Snapshot`) biçimlendirmesi.
 *
 * Burada YENİ KARAR ÜRETİLMEZ: hüküm, rejim, skor ve olay sınıfları
 * engine.ts'ten gelir; bu dosya yalnızca onları (arşiv etiketleriyle) sayfanın
 * göstereceği biçime çevirir. Sayfa da hiçbir yön hesaplamaz.
 */

import { nyParts, nyClock, r2 } from "../core";
import { regimeText, type DayRun, type GradedEvent, type Level, type Prep, type ScoreParts, type Trade, type Verdict, SETUP_LABEL } from "./engine";
import { archiveLabel, type ArchiveStats } from "./archive";
import { V11_CONFIG as CFG } from "./config";

export const V11_VERSION = "v11.0";

export interface StripItem {
  clock: string;
  label: string;
  level: string;
  effect: string;
  invalidation: number;
  ageMin: number;
  outcomes: { min: number; state: "✓" | "✗" | "…" }[];
  archive: string;
  /** Yanıp sönme + bildirim penceresinde mi */
  fresh: boolean;
  /** Sesli uyarı/bildirim için tekil kimlik */
  id: string;
}

export interface LevelRow {
  price: number;
  label: string;
  kind: string;
  /** (seviye − fiyat) / ATR */
  distAtr: number | null;
  dynamic: boolean;
}

export interface EventRow {
  clock: string;
  label: string;
  grade: "A" | "B";
  level: string;
  effect: string;
  outcomes: { min: number; state: "✓" | "✗" | "…" }[];
  archive: string;
  experimental: boolean;
}

export interface LegRow {
  setup: string;
  side: "LONG" | "SHORT";
  entryClock: string;
  entry: number;
  exitClock: string | null;
  exit: number | null;
  reason: string | null;
  r: number | null;
  open: boolean;
}

export interface ChartData {
  /** [başlangıç, açılış, yüksek, düşük, kapanış] — yalnızca kapanmış RTH 5m mumları */
  bars: [number, number, number, number, number][];
  /** Her mum kapanışındaki RTH VWAP (tek kaynak) */
  vwap: number[];
  /** A/B sınıfı olaylar (nötr işaret) */
  marks: { t: number; price: number; grade: "A" | "B" }[];
  /** Karar kartının planı (giriş/stop/hedef) */
  lines: { price: number; label: string }[];
}

export interface V11Snapshot {
  ok: true;
  version: string;
  generatedAt: number;
  ymd: string;
  asOf: number | null;
  asOfClock: string | null;
  session: { live: boolean; phase: "PRE" | "RTH" | "POST" | "CLOSED"; note: string | null; replay: boolean };
  /** Karar fiyatı: son KAPANMIŞ RTH 5m kapanışı */
  price: number | null;
  /** Seans dışı fiyat — yalnızca bilgi rozeti, karar alanlarına girmez */
  ah: { label: "AH" | "PM"; price: number; diff: number | null } | null;
  verdict: Verdict | null;
  regime: { kind: string; text: string; since: string | null };
  opening: { done: boolean; text: string } | null;
  strip: StripItem[];
  chart: ChartData;
  evidence: {
    regime: {
      candidate: string;
      pending: string | null;
      inputs: { cross2h: number; insideRatio: number | null; acceptance: string | null; htfBias: number | null; rangeVsAdr: number | null; orBreak: string | null };
    };
    roles: { htf: string; m15: string; m5: string };
    scores: { m15: ScoreParts | null; m30: ScoreParts | null; h1: ScoreParts | null; dir15: string };
    vwap: number | null;
    ema20m15: number | null;
    atr5: number | null;
    levels: LevelRow[];
    events: EventRow[];
    legs: LegRow[];
    experimental: { name: string; detail: string }[];
    archive: {
      days: number;
      from: string | null;
      to: string | null;
      trades: ArchiveStats["trades"] | null;
      baseline: number | null;
      horizonMin: number;
    } | null;
  };
}

const ageMin = (end: number, now: number) => Math.max(0, Math.round((now - end) / 60));

function legRow(t: Trade): LegRow {
  return {
    setup: SETUP_LABEL[t.setup], side: t.side, entryClock: nyClock(t.entryEnd), entry: t.entry,
    exitClock: t.exitEnd ? nyClock(t.exitEnd) : null, exit: t.exit, reason: t.exitReason, r: t.r, open: t.exitEnd == null,
  };
}

export function buildSnapshot(args: {
  prep: Prep;
  run: DayRun;
  archive: ArchiveStats | null;
  nowSec: number;
  replay: boolean;
  phase: "PRE" | "RTH" | "POST" | "CLOSED";
  ah: { label: "AH" | "PM"; price: number } | null;
  experimentalExtra?: { name: string; detail: string }[];
}): V11Snapshot {
  const { prep, run, archive, nowSec } = args;
  const last = run.last;
  const lastBar = run.bars.length ? run.bars[run.bars.length - 1] : null;
  const price = lastBar ? lastBar.close : null;

  // — olay etiketleri + ana ekran uygunluğu (İlke 7) —
  const labelOf = (e: GradedEvent) => archiveLabel(e, archive);
  const A = run.events.filter((e) => e.grade === "A");
  const eligibleA = A.filter((e) => labelOf(e).eligible);
  const strip: StripItem[] = eligibleA
    .slice(-CFG.events.stripCount)
    .reverse()
    .map((e) => ({
      clock: e.clock, label: e.label, level: e.levelText, effect: e.effect, invalidation: e.invalidation,
      ageMin: ageMin(e.end, nowSec), outcomes: e.outcomes, archive: labelOf(e).text,
      fresh: nowSec - e.end <= CFG.events.blinkSec + 300 && nowSec - e.end >= 0 && e.end >= (last?.end ?? 0) - 300,
      id: `${run.ymd}:${e.end}:${e.kind}`,
    }));

  const eventRows: EventRow[] = run.events
    .filter((e): e is GradedEvent & { grade: "A" | "B" } => e.grade !== "C")
    .slice()
    .reverse()
    .map((e) => {
      const l = labelOf(e);
      return { clock: e.clock, label: e.label, grade: e.grade, level: e.levelText, effect: e.effect, outcomes: e.outcomes, archive: l.text, experimental: l.experimental };
    });

  // deneysel metrikler: arşivde isabeti < %50 olan olay türleri (yeterli örneklemle)
  const experimental: { name: string; detail: string }[] = [];
  if (archive) {
    const seen = new Set<string>();
    for (const e of run.events) {
      if (e.grade === "C") continue;
      const l = labelOf(e);
      const key = `${e.kind}|${e.grade}`;
      if (l.experimental && !seen.has(key)) {
        seen.add(key);
        experimental.push({ name: `${e.label} (${e.grade} sınıfı)`, detail: `arşiv %${Math.round((l.rate ?? 0) * 100)} (${l.n} olay) < %${Math.round(archive.minHitRate * 100)} — ana ekrandan kaldırıldı` });
      }
    }
  }
  for (const x of args.experimentalExtra ?? []) experimental.push(x);

  // — seviyeler: tek birleşik liste —
  const atrV = last?.atr ?? null;
  const rows: LevelRow[] = [];
  const dist = (p: number) => (price != null && atrV ? r2((p - price) / atrV) : null);
  for (const l of last?.levels ?? []) {
    rows.push({ price: r2(l.price), label: l.label, kind: l.kind, distAtr: dist(l.price), dynamic: false });
  }
  if (last) {
    rows.push({ price: r2(last.vwap), label: "VWAP (RTH, 09:30 ankrajlı)", kind: "VWAP", distAtr: dist(last.vwap), dynamic: true });
    if (last.ema15 != null) rows.push({ price: r2(last.ema15), label: "EMA20 (15m)", kind: "EMA", distAtr: dist(last.ema15), dynamic: true });
    rows.push({ price: r2(last.dayHigh), label: "Gün tepesi", kind: "GÜN", distAtr: dist(last.dayHigh), dynamic: false });
    rows.push({ price: r2(last.dayLow), label: "Gün dibi", kind: "GÜN", distAtr: dist(last.dayLow), dynamic: false });
  }
  // yinelenenleri (aynı fiyat+etiket) ele
  const uniq = new Map<string, LevelRow>();
  for (const r of rows) uniq.set(`${r.price}|${r.label}`, r);
  const levels = Array.from(uniq.values()).sort((a, b) => b.price - a.price);

  // — açılış satırı (10:00'dan sonra katlanmış arşiv satırı) —
  let opening: V11Snapshot["opening"] = null;
  if (last) {
    const doneAt = run.steps.find((s) => nyParts(s.end - 300).minutes + 5 >= CFG.time.openEndMin);
    if (last.or && doneAt) {
      opening = {
        done: true,
        text: `Açılış 09:30–10:00 · aralık ${last.or.low.toFixed(2)} – ${last.or.high.toFixed(2)} (${(last.or.high - last.or.low).toFixed(2)}) · 10:00 rejimi: ${regimeText(doneAt.regime)}`,
      };
    } else {
      opening = { done: false, text: "Açılış aralığı toplanıyor (09:30–10:00)" };
    }
  }

  const s = last;
  const dirTxt = !s ? "—" : s.dir15 > 0 ? "yukarı" : s.dir15 < 0 ? "aşağı" : "nötr";
  const sc = (x: ScoreParts | null) => (x ? `${x.total > 0 ? "+" : ""}${x.total}` : "—");
  const htfBias = s?.inputs.htfBias;

  const trades = run.trades.map(legRow).reverse();

  return {
    ok: true,
    version: V11_VERSION,
    generatedAt: nowSec,
    ymd: run.ymd,
    asOf: s ? s.end : null,
    asOfClock: s ? nyClock(s.end) : null,
    session: {
      live: !args.replay && args.phase === "RTH",
      phase: args.phase,
      replay: args.replay,
      note: args.replay ? `Geriye dönük oynatma — ${run.ymd}` : args.phase === "RTH" ? null : "Seans dışı: karar son kapanmış RTH mumuna dayanır",
    },
    price,
    ah: args.ah && price != null ? { label: args.ah.label, price: r2(args.ah.price), diff: r2(args.ah.price - price) } : null,
    verdict: s ? s.verdict : null,
    regime: { kind: s?.regime ?? "AÇILIŞ", text: s ? regimeText(s.regime) : "—", since: s ? nyClock(s.regimeSince) : null },
    opening,
    strip,
    chart: {
      bars: run.bars.map((b) => [b.time, b.open, b.high, b.low, b.close]),
      vwap: prep.vwap.slice(prep.dayRange.get(run.ymd)?.s ?? 0, (prep.dayRange.get(run.ymd)?.s ?? 0) + run.bars.length).map(r2),
      marks: run.events.filter((e): e is GradedEvent & { grade: "A" | "B" } => e.grade !== "C").map((e) => ({ t: e.time, price: e.price, grade: e.grade })),
      lines: (() => {
        const pl = s?.verdict.plan;
        const out: { price: number; label: string }[] = [];
        if (pl) {
          if (s?.verdict.state === "GİR" || s?.verdict.state === "YÖNET") out.push({ price: pl.entry, label: "giriş" });
          out.push({ price: pl.stop, label: s?.verdict.state === "HAZIRLAN" ? "iptal" : "stop" });
          if (pl.t1 != null) out.push({ price: pl.t1, label: "T1" });
          if (pl.t2 != null) out.push({ price: pl.t2, label: "T2" });
        }
        return out;
      })(),
    },
    evidence: {
      regime: {
        candidate: s ? regimeText(s.candidate) : "—",
        pending: s?.pendingKind ? `${regimeText(s.pendingKind)} ${s.pendingCount}/${CFG.regime.hysteresis.confirmCloses}` : null,
        inputs: {
          cross2h: s?.inputs.cross2h ?? 0,
          insideRatio: s?.inputs.insideRatio ?? null,
          acceptance: s?.inputs.acceptance ?? null,
          htfBias: s?.inputs.htfBias ?? null,
          rangeVsAdr: s?.inputs.rangeVsAdr != null ? r2(s.inputs.rangeVsAdr) : null,
          orBreak: s?.inputs.orBreak ?? null,
        },
      },
      roles: {
        htf: `1h ${sc(s?.score60 ?? null)} · 30m ${sc(s?.score30 ?? null)} → htf_bias ${htfBias == null ? "—" : htfBias.toFixed(1)} (rejim girdisi)`,
        m15: `15m skor ${sc(s?.score15 ?? null)} (konum ${s?.score15?.pos ?? "—"} · eğim ${s?.score15?.slope ?? "—"} · yapı ${s?.score15?.struct ?? "—"} · hacim ${s?.score15?.vol ?? "—"}) → yön ${dirTxt}`,
        m5: s?.verdict.trigger ? `5m tetik: ${s.verdict.trigger}` : "5m tetik: kurulum yok",
      },
      scores: { m15: s?.score15 ?? null, m30: s?.score30 ?? null, h1: s?.score60 ?? null, dir15: dirTxt },
      vwap: s ? r2(s.vwap) : null,
      ema20m15: s?.ema15 != null ? r2(s.ema15) : null,
      atr5: atrV != null ? Math.round(atrV * 1000) / 1000 : null,
      levels,
      events: eventRows,
      legs: trades,
      experimental,
      archive: archive
        ? { days: archive.days, from: archive.from, to: archive.to, trades: archive.trades, baseline: archive.baseline.rate, horizonMin: archive.horizonMin }
        : null,
    },
  };
}

export type { Level };
