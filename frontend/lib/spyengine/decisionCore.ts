/**
 * SPY Engine — KARAR GÜNLÜĞÜ + EĞİTİM NOTLARI + ÖĞRENEN MODEL (saf, izomorfik).
 *
 * Her seans için motorun TÜM kararları tarihli bir kayıt olarak arşivlenir:
 *   • durum geçişleri (İŞLEM YOK / İZLE / ERKEN UYARI / TETİK / TERS UYARI / İPTAL) ve gerekçeleri,
 *   • erken uyarı bölümleri ve sonuçları (tetiğe döndü mü, yön doğru muydu),
 *   • işlemler: giriş / stop / hedef / çıkış nedeni / R,
 *   • açılış kararı ve sonucu, 15m 4-mum tahminlerinin sonuçları,
 *   • kapalı (gölge) modların hesaplanmış işlemleri — kapatılan bir mod izlenmeye devam eder,
 *   • "eğitim notları": her sonuçtan çıkarılan dersler (etiketli).
 *
 * ÖĞRENME (learnFromLog): arşivlenen sonuçlardan mod bazında isabet / beklenen R / güven aralığı çıkarılır,
 * etiketli derslerin oranları hesaplanır. applyTrust yalnız GÜVENLİ bir şeyi otomatik yapar: kanıt güçlüyse
 * (≥30 işlem, ort. R ≤ −0,15 ve son işlemler de eksi) zarar ettiren modu KAPATIR. Hiçbir şeyi kendiliğinden AÇMAZ
 * ve eşik/stop gibi parametreleri değiştirmez — bunlar "öneri" olarak yazılır, kararı insan verir.
 * Kayıtlar günü kapanınca DONDURULUR (o günkü kod sürümünün gerçek performansı); model her yeni gün eklenince güncellenir.
 */

import {
  atr, bucketAggregate, isRthBar, nyDateTimeToEpoch, nyParts, r2, type Bar,
} from "./core";
import { daySeries, emaByTime } from "./openingMap";
import { LADDER_CFG, ladderRead, rsiSeries, rvolBaseline, type Attempt, type LadderCfg, type LadderInput, type LadderRead, type PlanMode } from "./ladder";
import { prevDayPivots } from "./pivots";
import { barEnd, readSetup15, sessionAggregate } from "./setup15";

// ── Sürüm ───────────────────────────────────────────────────────────

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
/** Motor ayarlarının parmak izi — kayıtta hangi kod/ayar sürümüyle üretildiği görünür */
export const cfgHash = (c: LadderCfg = LADDER_CFG) => hash(JSON.stringify(c));
export const ENGINE_VERSION = "ladder-2026.10.14.5";

// ── Tipler ──────────────────────────────────────────────────────────

export interface Transition { clock: string; status: string; side: string | null; mode: string; price: number; msg: string }
export interface WarnEpisode { clock: string; side: string; mode: string; converted: boolean; right: 1 | -1 | 0 }
export interface LoggedAttempt {
  clock: string; side: string; mode: string; setup: string; entry: number; stop: number; target: number;
  exitClock: string | null; exit: number | null; result: string | null; exitWhy: string | null; r: number | null; mfe: number;
  rsi15: number | null; confirm: number; shadow?: boolean;
  /** Yönetim: hedefte yarı satış + kalan yarının sonucu (resmî işlem hedefte tam çıkış olarak kalır) */
  managed?: { why: string | null; restR: number | null; totalR: number | null; exitClock: string | null } | null;
}
export interface Lesson { tag: string; text: string; clock?: string }
export interface LiveEvent { t: number; clock: string; status: string; side: string | null; mode: string; msg: string; price: number | null; entry?: number; stop?: number; target?: number }
export interface DecisionDay {
  date: string;
  version: string;
  cfg: string;
  backfill: boolean;
  generatedAt: string;
  prevClose: number;
  open: number;
  close: number;
  atr5: number;
  opening: { label: string; side: string | null; net: boolean; decidedAt: string | null; strength: string | null; gap: number | null; move2h: number | null; right: boolean | null };
  transitions: Transition[];
  warnings: WarnEpisode[];
  /** Trend sonu uyarıları: seviye değişimleri ve 6 mum içinde BİTTİ'ye dönüp dönmediği */
  trendEnds: { clock: string; level: string; ended6: boolean }[];
  /** İşlem yönetimi tavsiyeleri (değişim anları) */
  manageLog: { clock: string; action: string }[];
  attempts: LoggedAttempt[];
  /** Kapalı modların gölge işlemleri (gerçek karar değil; izlenir) */
  shadow: LoggedAttempt[];
  summary: { n: number; wins: number; R: number; pts: number };
  fc15: { n: number; dirN: number; dirHit: number; bandHit: number; bandN: number; mae: number; naiveMae: number } | null;
  lessons: Lesson[];
  /** Gün yaşanırken tarayıcıdan gelen anlık kararlar (zaman damgalı) */
  live?: LiveEvent[];
}

export const MODES: PlanMode[] = ["AÇILIŞ YÖNÜ", "ÖĞLEN DÖNÜŞ", "TREND YAPISI", "KAPANIŞ YÖNÜ", "TEPE/DİP REDDİ"];

// ── Mod anahtarları ve güven ile ayar uygulama ─────────────────────

export function modeEnabled(c: LadderCfg, m: string): boolean {
  return m === "AÇILIŞ YÖNÜ" ? c.plan.openOn : m === "ÖĞLEN DÖNÜŞ" ? c.plan.fadeOn : m === "KAPANIŞ YÖNÜ" ? c.plan.closeOn : m === "TEPE/DİP REDDİ" ? c.climax.on : m === "TREND YAPISI" ? c.trend.on : true;
}
function setMode(c: LadderCfg, m: string, on: boolean) {
  if (m === "AÇILIŞ YÖNÜ") c.plan.openOn = on; else if (m === "ÖĞLEN DÖNÜŞ") c.plan.fadeOn = on; else if (m === "KAPANIŞ YÖNÜ") c.plan.closeOn = on; else if (m === "TEPE/DİP REDDİ") c.climax.on = on; else if (m === "TREND YAPISI") c.trend.on = on;
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export type Trust = "YÜKSEK" | "ORTA" | "DÜŞÜK" | "KAPAT" | "YETERSİZ";
export interface ModeStat {
  n: number; wins: number; sumR: number; avgR: number; pts: number; se: number;
  /** son 12 işlem */
  recentN: number; recentAvgR: number | null;
  level: Trust; note: string;
}
export interface DecisionModel {
  version: string;
  days: number;
  liveDays: number;
  trades: number;
  modes: Record<string, ModeStat>;
  /** Kapalı (gölge) modların izlenen sonuçları */
  shadow: Record<string, ModeStat & { reopen: boolean }>;
  warn: { n: number; convPct: number; rightPct: number };
  /** Yönetim politikası (hedefte yarı sat, kalan taşı) ile resmî (tam çıkış) toplam R karşılaştırması — mod bazında */
  managed: Record<string, { n: number; carried: number; baseR: number; managedR: number }>;
  trendEnd: { warnN: number; endedPct: number };
  opening: { netN: number; netHitPct: number; otherN: number; otherHitPct: number; otherMovePct: number };
  fc15: { n: number; dirPct: number | null; bandPct: number | null; mae: number | null; naiveMae: number | null };
  lessons: Record<string, { n: number; of: number }>;
  insights: string[];
  /** applyTrust'ın otomatik kapattığı modlar */
  disabled: string[];
}

export const MIN_TRADES = 30;

function modeStat(xs: { r: number; pts: number }[]): Omit<ModeStat, "level" | "note"> {
  const n = xs.length;
  const sumR = xs.reduce((a, x) => a + x.r, 0);
  const avgR = n ? sumR / n : 0;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x.r - avgR) ** 2, 0) / (n - 1)) : 0;
  const rec = xs.slice(-12);
  return {
    n, wins: xs.filter((x) => x.r > 0).length, sumR: r2(sumR), avgR: r2(avgR), pts: r2(xs.reduce((a, x) => a + x.pts, 0)),
    se: n > 1 ? r2(sd / Math.sqrt(n)) : 0, recentN: rec.length, recentAvgR: rec.length ? r2(rec.reduce((a, x) => a + x.r, 0) / rec.length) : null,
  };
}

function trustOf(s: Omit<ModeStat, "level" | "note">): { level: Trust; note: string } {
  if (s.n < MIN_TRADES) return { level: "YETERSİZ", note: `${s.n} işlem — güven için en az ${MIN_TRADES} gerekir` };
  const lo = s.avgR - 1.0 * s.se, hi = s.avgR + 1.0 * s.se;
  if (s.avgR <= -0.15 && hi < 0.1 && (s.recentAvgR ?? 0) < 0) return { level: "KAPAT", note: `ort. ${s.avgR}R, son 12 işlem ${s.recentAvgR}R — kanıt güçlü eksi: mod otomatik kapatılır` };
  if (lo > 0.1) return { level: "YÜKSEK", note: `ort. +${s.avgR}R (alt sınır +${r2(lo)}R)` };
  if (s.avgR > 0) return { level: "ORTA", note: `ort. +${s.avgR}R ama belirsizlik büyük (±${s.se})` };
  return { level: "DÜŞÜK", note: `ort. ${s.avgR}R — kenar yok; izleniyor` };
}

const asRec = (a: LoggedAttempt) => ({ r: a.r ?? 0, pts: a.exit != null ? (a.exit - a.entry) * (a.side === "CALL" ? 1 : -1) : 0 });

/** Arşivden öğren: mod güveni, uyarı/açılış/tahmin isabeti, ders oranları ve öneriler */
export function learnFromLog(days: DecisionDay[]): DecisionModel {
  const ds = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const modes: DecisionModel["modes"] = {};
  const shadow: DecisionModel["shadow"] = {};
  const byMode = (pick: (d: DecisionDay) => LoggedAttempt[]) => {
    const g: Record<string, LoggedAttempt[]> = {};
    for (const d of ds) for (const a of pick(d)) if (a.r != null) (g[a.mode] ??= []).push(a);
    return g;
  };
  for (const [m, xs] of Object.entries(byMode((d) => d.attempts))) { const s = modeStat(xs.map(asRec)); modes[m] = { ...s, ...trustOf(s) }; }
  for (const [m, xs] of Object.entries(byMode((d) => d.shadow))) {
    const s = modeStat(xs.map(asRec)); const t = trustOf(s);
    shadow[m] = { ...s, ...t, reopen: s.n >= MIN_TRADES && s.avgR - s.se >= 0.3 && (s.recentAvgR ?? 0) > 0 };
  }
  const W = ds.flatMap((d) => d.warnings);
  const warn = { n: W.length, convPct: W.length ? Math.round((100 * W.filter((w) => w.converted).length) / W.length) : 0, rightPct: (() => { const j = W.filter((w) => w.right !== 0); return j.length ? Math.round((100 * j.filter((w) => w.right > 0).length) / j.length) : 0; })() };
  const managed: DecisionModel["managed"] = {};
  for (const d of ds) for (const a of d.attempts) {
    if (a.r == null) continue;
    const g = (managed[a.mode] ??= { n: 0, carried: 0, baseR: 0, managedR: 0 });
    g.n++; g.baseR += a.r; g.managedR += a.managed?.totalR ?? a.r; if (a.managed) g.carried++;
  }
  for (const g of Object.values(managed)) { g.baseR = r2(g.baseR); g.managedR = r2(g.managedR); }
  const TE = ds.flatMap((d) => d.trendEnds ?? []).filter((t) => t.level === "UYARI");
  const trendEnd = { warnN: TE.length, endedPct: TE.length ? Math.round((100 * TE.filter((t) => t.ended6).length) / TE.length) : 0 };
  const net = ds.filter((d) => d.opening.net && d.opening.right != null), oth = ds.filter((d) => !d.opening.net && d.opening.side && d.opening.right != null);
  const opening = {
    netN: net.length, netHitPct: net.length ? Math.round((100 * net.filter((d) => d.opening.right).length) / net.length) : 0,
    otherN: oth.length, otherHitPct: oth.length ? Math.round((100 * oth.filter((d) => d.opening.right).length) / oth.length) : 0,
    otherMovePct: oth.length ? Math.round((100 * oth.filter((d) => d.lessons.some((l) => l.tag === "AÇILIŞ_HAREKETİ_KAÇTI")).length) / oth.length) : 0,
  };
  const F = ds.flatMap((d) => (d.fc15 ? [d.fc15] : []));
  const sum = (k: "dirN" | "dirHit" | "bandN" | "bandHit" | "n") => F.reduce((a, f) => a + f[k], 0);
  const fc15 = { n: sum("n"), dirPct: sum("dirN") ? Math.round((100 * sum("dirHit")) / sum("dirN")) : null, bandPct: sum("bandN") ? Math.round((100 * sum("bandHit")) / sum("bandN")) : null, mae: sum("n") ? r2(F.reduce((a, f) => a + f.mae * f.n, 0) / sum("n")) : null, naiveMae: sum("n") ? r2(F.reduce((a, f) => a + f.naiveMae * f.n, 0) / sum("n")) : null };
  const lessons: DecisionModel["lessons"] = {};
  const allAtt = ds.flatMap((d) => d.attempts);
  const stops = allAtt.filter((a) => a.exitWhy === "STOP");
  for (const d of ds) for (const l of d.lessons) (lessons[l.tag] ??= { n: 0, of: 0 }).n++;
  if (lessons["STOP_SONRASI_HEDEF"]) lessons["STOP_SONRASI_HEDEF"].of = stops.length;
  if (lessons["KARŞI_MOMENTUM"]) lessons["KARŞI_MOMENTUM"].of = allAtt.filter((a) => a.mode === "ÖĞLEN DÖNÜŞ").length;

  const insights: string[] = [];
  const sh = lessons["STOP_SONRASI_HEDEF"];
  if (sh && sh.of >= 15) {
    const p = Math.round((100 * sh.n) / sh.of);
    insights.push(p >= 50 ? `Stopların %${p}'i (${sh.n}/${sh.of}) kapandıktan sonra hedefe ulaştı — stoplar dar olabilir; ölçümle genişletme denenmeli (şu an otomatik değişmez).` : `Stopların yalnız %${p}'i sonradan hedefe gitti (${sh.n}/${sh.of}) — stoplar uygun görünüyor.`);
  }
  if (opening.netN >= 10) insights.push(`NET açılış kararı ${opening.netN} günde %${opening.netHitPct} doğru (2 saat); NET olmayan ${opening.otherN} günde %${opening.otherHitPct} — NET olmayan günde açılış işlemi yapılmıyor.`);
  if (warn.n >= 30) insights.push(`Erken uyarının ${warn.n} bölümünün %${warn.convPct}'i 4 mumda tetiğe döndü, yönü %${warn.rightPct} doğru — uyarı "emri hazırla" demektir, yön tahmini değil.`);
  {
    // dönüş işlemlerinde 15m RSI'nın durumu (arşivden öğrenilen fark)
    const ct: LoggedAttempt[] = [], ok: LoggedAttempt[] = [];
    for (const d of ds) {
      const tags = new Set(d.lessons.filter((l) => l.tag === "KARŞI_MOMENTUM").map((l) => l.clock));
      for (const a of d.attempts) if (a.mode === "ÖĞLEN DÖNÜŞ" && a.r != null) (tags.has(a.clock) ? ct : ok).push(a);
    }
    if (ct.length >= 10 && ok.length >= 10) {
      const A = modeStat(ct.map(asRec)), B2 = modeStat(ok.map(asRec));
      insights.push(`Öğlen dönüşünde 15m RSI hâlâ uzama yönündeyken (${A.n} işlem): %${Math.round((100 * A.wins) / A.n)} kazanç, ort. ${A.avgR}R; RSI dönmüş/kararsızken (${B2.n}): %${Math.round((100 * B2.wins) / B2.n)}, ort. ${B2.avgR}R — ${A.avgR < B2.avgR - 0.3 ? "fark belirgin: dönüş teyidini beklemek düşünülebilir (otomatik uygulanmaz)" : "fark küçük: filtre gerekmiyor"}.`);
    }
  }
  for (const [m, s] of Object.entries(shadow)) if (s.reopen) insights.push(`Kapalı ${m} modu gölgede ${s.n} işlemde ort. +${s.avgR}R — yeniden açma ADAYI (otomatik açılmaz; ölçümle doğrula).`);
  for (const [m, s] of Object.entries(modes)) if (s.level === "KAPAT") insights.push(`${m}: ${s.note}.`);
  if (fc15.dirPct != null && fc15.naiveMae != null && fc15.mae != null) insights.push(`15m 4-mum tahmini: yön %${fc15.dirPct}, bant içi %${fc15.bandPct}; hata ${fc15.mae} vs "fiyat aynı kalır" ${fc15.naiveMae} — ${fc15.mae < fc15.naiveMae * 0.98 ? "tahmin değer katıyor" : "tahmin şimdilik değer katmıyor, yalnız senaryo aracı"}.`);

  const disabled = Object.entries(modes).filter(([, s]) => s.level === "KAPAT").map(([m]) => m);
  for (const [m, g] of Object.entries(managed)) if (g.carried >= 8) insights.push(`Yönetim (${m}): ${g.carried} işlemde yarı hedefte satılıp kalan taşındı — toplam ${g.baseR >= 0 ? "+" : ""}${g.baseR}R → ${g.managedR >= 0 ? "+" : ""}${g.managedR}R (${g.managedR > g.baseR ? "taşıma değer katıyor" : "taşıma değer katmıyor"}).`);
  if (trendEnd.warnN >= 15) insights.push(`Trend sonu uyarısı ${trendEnd.warnN} kez yandı; %${trendEnd.endedPct}'i 6 mum içinde gerçekten BİTTİ'ye döndü.`);
  return { version: ENGINE_VERSION, days: ds.length, liveDays: ds.filter((d) => !d.backfill).length, trades: allAtt.length, modes, shadow, warn, managed, trendEnd, opening, fc15, lessons, insights, disabled };
}

/** Kanıt güçlü eksi ise o modu KAPATIR; hiçbir şeyi açmaz */
export function applyTrust(base: LadderCfg, model: DecisionModel | null): LadderCfg {
  if (!model || !model.disabled.length) return base;
  const c = clone(base);
  for (const m of model.disabled) setMode(c, m, false);
  return c;
}

// ── Günü kaydet ─────────────────────────────────────────────────────

const am = (bs: Bar[]) => { const a = atr(bs, 14); const m = new Map<number, number>(); bs.forEach((b, i) => { if (a[i] != null) m.set(b.time, a[i] as number); }); return m; };

/** Bir seans için ladderRead girdisi (sayfa ile aynı kurulum; m5 = 5m mumlar, premarket dahil, ≥ date) */
export function ladderInputFor(m5All: Bar[], date: string, prevClose: number | null, tech?: LadderInput["tech"]): LadderInput {
  const m5 = m5All.filter((b) => nyParts(b.time).ymd <= date);
  const m15 = bucketAggregate(m5, 15), m30 = bucketAggregate(m5, 30), m60 = bucketAggregate(m5, 60);
  const now = nyDateTimeToEpoch(date, 16 * 60 + 5);
  return {
    date, s5: daySeries(m5, "5m", date, now, null), s15: daySeries(m15, "15m", date, now, null), s30: daySeries(m30, "30m", date, now, null),
    ema5: emaByTime(m5), ema15: emaByTime(m15), atr5: am(m5), atr15: am(m15), rvol: rvolBaseline(m5, date), prevClose, staticLevels: [],
    htf: { m30, e30: emaByTime(m30), m60, e60: emaByTime(m60) }, rsi: { r15: rsiSeries(m15), r30: rsiSeries(m30) },
    ...(tech ? { tech } : {}),
  };
}

const cap = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const logAtt = (a: Attempt, rsi15: number | null, shadow = false): LoggedAttempt => ({
  clock: a.clock, side: a.side, mode: a.mode, setup: cap(a.setup, 60), entry: a.entry, stop: a.stop, target: a.target, exitClock: a.exitClock, exit: a.exit,
  result: a.result, exitWhy: a.exitWhy ?? null, r: a.r, mfe: r2(a.mfe), rsi15, confirm: a.confirm, ...(shadow ? { shadow: true } : {}),
  managed: a.managed ? { why: a.managed.why, restR: a.managed.restR, totalR: a.managed.totalR, exitClock: a.managed.exitClock } : null,
});

function forecast15Day(m5All: Bar[], date: string, prevClose: number | null): DecisionDay["fc15"] {
  const m15 = bucketAggregate(m5All.filter((b) => nyParts(b.time).ymd <= date), 15).filter(isRthBar);
  const h1all = sessionAggregate(m5All.filter((b) => nyParts(b.time).ymd <= date), 60);
  const idx: number[] = []; m15.forEach((b, i) => { if (nyParts(b.time).ymd === date) idx.push(i); });
  let n = 0, dirN = 0, dirHit = 0, bandN = 0, bandHit = 0, ae = 0, nae = 0;
  const pc = new Map<string, ReturnType<typeof prevDayPivots>>();
  for (const i of idx) {
    if (i < 30 || i + 4 >= m15.length) continue;
    const t = m15[i].time, end = t + 900;
    const real = m15.slice(i + 1, i + 5);
    if (real.length < 4 || nyParts(real[3].time).ymd !== date) continue;
    const pv = pc.get(date) ?? prevDayPivots(m5All.filter((b) => nyParts(b.time).ymd <= date), date, prevClose); pc.set(date, pv);
    const r = readSetup15({ m15: m15.slice(0, i + 1), h1: h1all.filter((b) => barEnd(b.time, 60) <= end), pivots: pv, vwap: null });
    if (!r) continue;
    n++;
    r.forecast.candles.forEach((k, j) => { bandN++; if (real[j].close >= k.lo && real[j].close <= k.hi) bandHit++; });
    const move = real[3].close - r.forecast.base;
    ae += Math.abs(real[3].close - r.forecast.candles[3].c); nae += Math.abs(move);
    if (r.forecast.dir !== 0 && Math.abs(r.forecast.candles[3].c - r.forecast.base) >= 0.1 * r.atr) { dirN++; if (Math.sign(move) === r.forecast.dir) dirHit++; }
  }
  return n ? { n, dirN, dirHit, bandN, bandHit, mae: r2(ae / n), naiveMae: r2(nae / n) } : null;
}

export function buildDecisionDay(args: {
  m5: Bar[]; date: string; backfill: boolean; model: DecisionModel | null; live?: LiveEvent[];
  /** Motorun taban ayarı (varsayılan SPY; QQQ kendi ayarını verir) */
  baseCfg?: LadderCfg;
  /** Sembole özel ek girdi: o gün için teknoloji liderleri serisi (QQQ) */
  techFor?: (date: string, nowSec: number) => LadderInput["tech"];
}): DecisionDay | null {
  const { m5, date, backfill, model } = args;
  const rth = m5.filter((b) => isRthBar(b));
  const days = [...new Set(rth.map((b) => nyParts(b.time).ymd))].sort();
  const di = days.indexOf(date);
  if (di < 1) return null;
  const dayBars = rth.filter((b) => nyParts(b.time).ymd === date);
  if (dayBars.length < 70) return null;
  const prev = rth.filter((b) => nyParts(b.time).ymd === days[di - 1]);
  const prevClose = prev[prev.length - 1].close;
  const baseCfg = args.baseCfg ?? LADDER_CFG;
  const inp = ladderInputFor(m5, date, prevClose, args.techFor?.(date, nyDateTimeToEpoch(date, 16 * 60 + 5)));
  const cfgEff = applyTrust(baseCfg, model);
  const lr: LadderRead = ladderRead({ ...inp, cfg: cfgEff });
  const B = inp.s5.bars;
  const A = (i: number) => inp.atr5.get(B[i].time) ?? 0.5;
  const kOf = (t: number) => B.findIndex((b) => b.time === t);
  /** "HH:MM" kapanış saatine denk gelen mum indeksi */
  const kClock = (clock: string | null) => (clock ? B.findIndex((b) => nyParts(b.time).minutes + 5 === Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3))) : -1);

  // gölge: kapalı modlar için hesaplanan işlemler
  const sc = clone(baseCfg); for (const m of MODES) setMode(sc, m, true);
  const off = MODES.filter((m) => !modeEnabled(cfgEff, m));
  const shadow = off.length ? ladderRead({ ...inp, cfg: sc }).attempts.filter((a) => off.includes(a.mode)) : [];

  // durum geçişleri
  const transitions: Transition[] = [];
  lr.steps.forEach((s, i) => {
    const prevS = lr.steps[i - 1];
    if (!prevS || prevS.status !== s.status || prevS.side !== s.side || prevS.regime.mode !== s.regime.mode)
      transitions.push({ clock: s.clock, status: s.status, side: s.side, mode: s.regime.mode, price: r2(B[i].close), msg: cap(s.message) });
  });

  // erken uyarı bölümleri
  const warnings: WarnEpisode[] = [];
  lr.steps.forEach((s, i) => {
    if (s.status !== "ERKEN UYARI" || !s.side) return;
    const p = lr.steps[i - 1]; if (p && p.status === "ERKEN UYARI" && p.side === s.side) return;
    const dd = s.side === "CALL" ? 1 : -1; const a = A(i), p0 = B[i].close;
    const converted = lr.steps.slice(i + 1, i + 5).some((x) => x.status === "TETİK" && x.side === s.side && lr.attempts.some((t) => t.time === x.time));
    let right: 1 | -1 | 0 = 0;
    for (let j = i + 1; j < Math.min(B.length, i + 9); j++) {
      const fav = dd > 0 ? B[j].high - p0 : p0 - B[j].low, adv = dd > 0 ? p0 - B[j].low : B[j].high - p0;
      if (fav >= 0.75 * a && adv >= 0.75 * a) break;
      if (fav >= 0.75 * a) { right = 1; break; }
      if (adv >= 0.75 * a) { right = -1; break; }
    }
    warnings.push({ clock: s.clock, side: s.side, mode: s.regime.mode, converted, right });
  });

  const trendEnds: DecisionDay["trendEnds"] = [];
  lr.steps.forEach((s, i) => {
    const t = s.trendEnd, p = lr.steps[i - 1]?.trendEnd;
    if (!t || t.level === "İZLE" || p?.level === t.level) return;
    trendEnds.push({ clock: s.clock, level: t.level, ended6: lr.steps.slice(i + 1, i + 7).some((x) => x.trendEnd?.level === "BİTTİ") });
  });
  const manageLog: DecisionDay["manageLog"] = [];
  lr.steps.forEach((s, i) => { const m = s.manage, p = lr.steps[i - 1]?.manage; if (m && (!p || p.action !== m.action)) manageLog.push({ clock: s.clock, action: m.action }); });

  const rsiAt = (t: number) => { const k = kOf(t); return k >= 0 ? lr.steps[k].rsi?.v15 ?? null : null; };
  const attempts = lr.attempts.map((a) => logAtt(a, rsiAt(a.time)));
  const shadowL = shadow.map((a) => logAtt(a, null, true));

  // açılış
  const op = lr.opening; const k10 = B.findIndex((b) => nyParts(b.time).minutes + 5 === 600), k12 = B.findIndex((b) => nyParts(b.time).minutes + 5 === 720);
  const sd = op && (op.side === "UP" ? 1 : op.side === "DOWN" ? -1 : 0);
  const move2h = k10 >= 0 && k12 >= 0 ? r2(B[k12].close - B[k10].close) : null;
  const opening: DecisionDay["opening"] = {
    label: op?.label ?? "—", side: op?.side ?? null, net: !!op?.net, decidedAt: op?.decidedAt ?? null, strength: op?.strength ?? null,
    gap: op?.gap ? op.gap.pts : null, move2h, right: sd && move2h != null && Math.abs(move2h) >= 0.05 ? move2h * sd > 0 : null,
  };

  // eğitim notları
  const lessons: Lesson[] = [];
  for (const a of lr.attempts) {
    const k = kOf(a.time); if (k < 0 || a.r == null) continue;
    const dd = a.side === "CALL" ? 1 : -1;
    const exitK = kClock(a.exitClock);
    if (a.exitWhy === "STOP") {
      const reached = exitK >= 0 && B.slice(exitK + 1, exitK + 13).some((b) => (dd > 0 ? b.high >= a.target : b.low <= a.target));
      if (reached) lessons.push({ tag: "STOP_SONRASI_HEDEF", clock: a.clock, text: `${a.clock} ${a.side} ${a.mode}: stop (${a.stop}) çalıştı ama fiyat sonraki 1 saatte hedefe (${a.target}) ulaştı — stop dar/erken olabilir.` });
      else lessons.push({ tag: "STOP_DOĞRU", clock: a.clock, text: `${a.clock} ${a.side} ${a.mode}: stop gerekliydi — fiyat hedefe gitmedi (${a.r}R).` });
    } else if (a.exitWhy === "HEDEF") lessons.push({ tag: "HEDEF", clock: a.clock, text: `${a.clock} ${a.side} ${a.mode}: hedefe ulaştı (+${a.r}R).` });
    const r15 = lr.steps[k].rsi?.d15 ?? 0;
    if (a.mode === "ÖĞLEN DÖNÜŞ" && r15 === -dd) lessons.push({ tag: "KARŞI_MOMENTUM", clock: a.clock, text: `${a.clock} ${a.side} dönüş girişi 15m RSI hâlâ uzama yönündeyken açıldı → sonuç ${a.result} (${a.r}R).` });
    if (a.mfe >= 1.5 * Math.abs(a.entry - a.stop) && (a.r ?? 0) < 0.5) lessons.push({ tag: "KÂR_GERİ_VERİLDİ", clock: a.clock, text: `${a.clock} ${a.side}: en iyi +${r2(a.mfe)} puana çıktı ama ${a.r}R ile kapandı — kısmi kâr/başabaş stop düşünülebilir.` });
  }
  if (op && op.side && !op.net && move2h != null && k10 >= 0 && Math.abs(move2h) >= 3 * A(k10) && sd && move2h * sd > 0)
    lessons.push({ tag: "AÇILIŞ_HAREKETİ_KAÇTI", text: `Açılış ${op.side === "UP" ? "yukarı" : "aşağı"} eğilimi NET değildi (işlem yok) ama 10:00→12:00 ${move2h > 0 ? "+" : ""}${move2h} puan aynı yönde gitti.` });
  if (opening.net && opening.right === false) lessons.push({ tag: "AÇILIŞ_NET_YANILDI", text: `NET açılış kararı (${op!.side}) 2 saatte tersine döndü (${move2h} puan).` });
  if (opening.net && opening.right) lessons.push({ tag: "AÇILIŞ_NET_DOĞRU", text: `NET açılış kararı doğru çıktı (${move2h} puan).` });
  // kaçırılan hareket: işlemsiz en büyük 12 mumluk hareket
  {
    let best: { i: number; mv: number } | null = null;
    for (let i = 24; i + 12 < B.length; i++) {
      if (nyParts(B[i].time).minutes < 600 || nyParts(B[i].time).minutes > 14 * 60) continue;
      const mv = B[i + 12].close - B[i].close;
      const inTrade = lr.attempts.some((a) => { const k = kOf(a.time); const ek = a.exitClock ? kClock(a.exitClock) : B.length; return k <= i + 12 && ek >= i; });
      if (!inTrade && Math.abs(mv) >= 3.5 * A(i) && (!best || Math.abs(mv) > Math.abs(best.mv))) best = { i, mv };
    }
    if (best) lessons.push({ tag: "KAÇIRILAN_HAREKET", clock: lr.steps[best.i].clock, text: `${lr.steps[best.i].clock}'den 1 saatte ${best.mv > 0 ? "+" : ""}${r2(best.mv)} puanlık hareket işlemsiz geçti (o an durum: ${lr.steps[best.i].status}${lr.steps[best.i].side ? " " + lr.steps[best.i].side : ""}, mod ${lr.steps[best.i].regime.mode}).` });
  }

  const done = lr.attempts.filter((a) => a.r != null);
  return {
    date, version: ENGINE_VERSION, cfg: cfgHash(cfgEff), backfill, generatedAt: new Date().toISOString(),
    prevClose: r2(prevClose), open: r2(dayBars[0].open), close: r2(dayBars[dayBars.length - 1].close), atr5: r2(k10 >= 0 ? A(k10) : 0),
    opening, transitions, warnings, trendEnds, manageLog, attempts, shadow: shadowL,
    summary: { n: done.length, wins: done.filter((a) => (a.r ?? 0) > 0).length, R: r2(done.reduce((s, a) => s + (a.r ?? 0), 0)), pts: r2(done.reduce((s, a) => s + (a.exit != null ? (a.exit - a.entry) * (a.side === "CALL" ? 1 : -1) : 0), 0)) },
    fc15: forecast15Day(m5, date, prevClose), lessons, ...(args.live?.length ? { live: args.live } : {}),
  };
}
