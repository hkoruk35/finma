/**
 * Kullanıcı SPEC'inin GERÇEK 0DTE primiyle testi.
 *
 * ── ÖNEMLİ BULGU ──────────────────────────────────────────────────
 * Repo'nun kendi notu "Yahoo süresi dolmuş 0DTE intraday primini siliyor"
 * diyor. Bu YANLIŞ: v8 chart, OCC sembolüyle ve DAR bir period1/period2
 * penceresiyle (8 günlük 1m sınırının içinde) istendiğinde süresi dolmuş
 * 0DTE kontratların 1m primini veriyor. Örn. SPY260831C00765000 → 404 bar,
 * 09:30 $2.81. Bu yüzden yüzde bazlı kurallar MODELE gerek kalmadan,
 * gerçek primle test edilebiliyor (son ~6 seans).
 *
 * SPEC (kullanıcının tanımı):
 *   giriş  : 1m 2-3 ardışık mum + hacim > 15 mum ort. + 1m RSI yönü
 *            5m aynı yön + 5m RSI aynı yön (LONG >50 / SHORT <50)
 *   stop   : −%30 prim, asla taşınmaz
 *   +%20   : yarı kapat
 *   kalan  : +%50 tam kapat VEYA ters onay seti gelirse kapat
 *   süre   : 45 dk
 *   tekrar : kapanış sonrası ilk ters 1m mumu bekle
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  barsOfSessionDay, nyParts, nyDateTimeToEpoch, rsi,
  ENTRY_START_MIN, EOD_FORCE_MIN, type Bar,
} from "../lib/spyengine/core";

const CACHE = join(process.cwd(), ".cache-lagstudy");
const PREM = join(CACHE, "prem");
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json", Referer: "https://finance.yahoo.com/",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadCached(key: string): Bar[] {
  const f = join(CACHE, `${key}.json`);
  if (!existsSync(f)) throw new Error(`Önce lag_study.ts çalıştır (önbellek yok: ${key})`);
  return JSON.parse(readFileSync(f, "utf-8")).data as Bar[];
}

function occ(ymd: string, isCall: boolean, strike: number): string {
  const [y, m, d] = ymd.split("-");
  return `SPY${y.slice(2)}${m}${d}${isCall ? "C" : "P"}${String(Math.round(strike * 1000)).padStart(8, "0")}`;
}

/** Süresi dolmuş 0DTE kontratın 1m primi — dar pencere şart (8 gün sınırı) */
async function fetchPremium(ymd: string, isCall: boolean, strike: number): Promise<Bar[]> {
  if (!existsSync(PREM)) mkdirSync(PREM, { recursive: true });
  const s = occ(ymd, isCall, strike);
  const f = join(PREM, `${s}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf-8")) as Bar[];

  const day = Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${s}`
    + `?interval=1m&period1=${day - 86400}&period2=${day + 2 * 86400}&includePrePost=true`;
  let out: Bar[] = [];
  try {
    const raw = await (await fetch(url, { headers: H })).json();
    const r = raw?.chart?.result?.[0];
    const ts: number[] = r?.timestamp || [];
    const q = r?.indicators?.quote?.[0] || {};
    for (let i = 0; i < ts.length; i++) {
      if (q.close?.[i] == null) continue;
      out.push({
        time: ts[i], open: q.open?.[i] ?? q.close[i], high: q.high?.[i] ?? q.close[i],
        low: q.low?.[i] ?? q.close[i], close: q.close[i], volume: q.volume?.[i] ?? 0,
      });
    }
  } catch { out = []; }
  writeFileSync(f, JSON.stringify(out));
  await sleep(320);
  return out;
}

const dirOf = (b: Bar) => (b.close > b.open ? 1 : b.close < b.open ? -1 : 0);
const bodyR = (b: Bar) => { const r = Math.max(1e-9, b.high - b.low); return Math.abs(b.close - b.open) / r; };
const closePos = (b: Bar) => { const r = Math.max(1e-9, b.high - b.low); return (b.close - b.low) / r; };
function avgVol(bars: Bar[], i: number, n = 15): number | null {
  const s = Math.max(0, i - n);
  return s >= i ? null : bars.slice(s, i).reduce((a, b) => a + (b.volume || 0), 0) / (i - s);
}

interface Ctx { m1: Bar[]; m5: Bar[]; r1: (number | null)[]; r5: (number | null)[] }
interface EntryCfg { streak: number; bodyMin: number; closeMin: number; rsi5Level: boolean }

function entryOk(ctx: Ctx, i: number, m5Cur: number, side: 1 | -1, cfg: EntryCfg): boolean {
  const b = ctx.m1[i];
  if (cfg.bodyMin > 0 && bodyR(b) < cfg.bodyMin) return false;
  if (cfg.closeMin > 0) {
    const cs = side === 1 ? closePos(b) : 1 - closePos(b);
    if (cs < cfg.closeMin) return false;
  }
  const va = avgVol(ctx.m1, i, 15);
  if (va != null && va > 0 && (b.volume || 0) < va) return false;
  const r = ctx.r1[i], rp = ctx.r1[i - 1];
  if (r == null || rp == null) return false;
  if (side === 1 ? r <= rp : r >= rp) return false;
  if (m5Cur < 1) return false;
  if (dirOf(ctx.m5[m5Cur]) !== side) return false;
  const r5 = ctx.r5[m5Cur], r5p = ctx.r5[m5Cur - 1];
  if (r5 == null || r5p == null) return false;
  if (side === 1 ? r5 < r5p : r5 > r5p) return false;
  if (cfg.rsi5Level && (side === 1 ? r5 <= 50 : r5 >= 50)) return false;
  return true;
}

interface PosCfg {
  stopPct: number; halfPct: number | null; fullPct: number;
  maxMinutes: number | null; reverseExit: boolean;
}
interface Res {
  day: string; time: number; side: 1 | -1; contract: string;
  entryPrem: number; pnlPct: number; pnlUsd: number;
  reason: string; heldMin: number; hitHalf: boolean; spotPts: number;
}

/** Girişleri üretir (çıkıştan bağımsız) — prim indirmesini tek seferde planlamak için */
function scanEntries(ctx: Ctx, date: string, cfg: EntryCfg, endMin: number) {
  const { m1 } = ctx;
  const out: { i: number; side: 1 | -1 }[] = [];
  let streakDir = 0, streakLen = 0, m5Cur = -1;
  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    while (m5Cur + 1 < ctx.m5.length && ctx.m5[m5Cur + 1].time + 300 <= b.time + 60) m5Cur++;
    const d = dirOf(b);
    if (d === 0) { streakDir = 0; streakLen = 0; continue; }
    if (d === streakDir) streakLen++; else { streakDir = d; streakLen = 1; }
    if (streakLen !== cfg.streak) continue;
    const p = nyParts(b.time);
    if (p.ymd !== date || p.minutes < ENTRY_START_MIN || p.minutes >= endMin) continue;
    const side = streakDir as 1 | -1;
    if (!entryOk(ctx, i, m5Cur, side, cfg)) continue;
    out.push({ i, side });
  }
  return out;
}

function simulate(
  ctx: Ctx, date: string, cfg: EntryCfg, pos: PosCfg, endMin: number,
  premOf: (isCall: boolean, strike: number) => Map<number, Bar> | null,
): Res[] {
  const { m1 } = ctx;
  const eod = nyDateTimeToEpoch(date, EOD_FORCE_MIN);
  const out: Res[] = [];
  let blockedUntil = -Infinity;

  for (const { i, side } of scanEntries(ctx, date, cfg, endMin)) {
    const entryBar = m1[i];
    if (entryBar.time < blockedUntil) continue;

    const strike = Math.round(entryBar.close);
    const isCall = side === 1;
    const series = premOf(isCall, strike);
    const p0bar = series?.get(entryBar.time);
    if (!series || !p0bar || p0bar.close <= 0.05) continue; // gerçek prim yoksa işlem sayılmaz
    const P0 = p0bar.close;

    let open = 1.0, realized = 0, hitHalf = false, against = 0, m5Cur = -1;
    let exitTime = entryBar.time, reason = "SON", spotPts = 0;

    for (let k = i + 1; k < m1.length; k++) {
      const b = m1[k];
      while (m5Cur + 1 < ctx.m5.length && ctx.m5[m5Cur + 1].time + 300 <= b.time + 60) m5Cur++;
      const pb = series.get(b.time);
      if (!pb) continue;
      const heldMin = (b.time - entryBar.time) / 60;
      exitTime = b.time; spotPts = (b.close - entryBar.close) * side;

      // 1) sabit stop (mum içi dip, kötümser)
      if (pb.low <= P0 * (1 + pos.stopPct)) {
        realized += open * pos.stopPct; reason = "STOP"; open = 0; break;
      }
      // 2) yarı kapama
      if (pos.halfPct != null && !hitHalf && pb.high >= P0 * (1 + pos.halfPct)) {
        realized += 0.5 * pos.halfPct; open = 0.5; hitHalf = true;
      }
      // 3) tam hedef
      if ((pos.halfPct == null || hitHalf) && pb.high >= P0 * (1 + pos.fullPct)) {
        realized += open * pos.fullPct; reason = "TP"; open = 0; break;
      }
      // 4) ters onay seti
      if (pos.reverseExit) {
        const d = dirOf(b);
        if (d === -side) against++; else if (d === side) against = 0;
        if (against >= 2 && entryOk(ctx, k, m5Cur, -side as 1 | -1, cfg)) {
          realized += open * (pb.close / P0 - 1); reason = "TERS"; open = 0; break;
        }
      }
      // 5) süre / gün sonu
      if ((pos.maxMinutes != null && heldMin >= pos.maxMinutes) || b.time >= eod) {
        realized += open * (pb.close / P0 - 1);
        reason = b.time >= eod ? "EOD" : "SÜRE"; open = 0; break;
      }
    }
    if (open > 0) {
      const lastP = series.get(exitTime);
      if (lastP) realized += open * (lastP.close / P0 - 1);
    }

    out.push({
      day: date, time: entryBar.time, side, contract: occ(date, isCall, strike),
      entryPrem: P0, pnlPct: realized, pnlUsd: realized * P0 * 100,
      reason, heldMin: (exitTime - entryBar.time) / 60, hitHalf, spotPts,
    });
    const corr = m1.find((x) => x.time > exitTime && dirOf(x) === -side);
    blockedUntil = corr ? corr.time + 60 : Infinity;
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const SPREAD = 4;

function report(label: string, rs: Res[]) {
  if (!rs.length) { console.log(label.padEnd(28), "   0"); return; }
  const usd = rs.map((r) => r.pnlUsd), net = usd.map((u) => u - SPREAD);
  const wins = usd.filter((u) => u > 0).length;
  const pct = (f: (r: Res) => boolean) => `${((rs.filter(f).length / rs.length) * 100).toFixed(0)}%`;
  console.log(
    label.padEnd(28),
    String(rs.length).padStart(4),
    `${((wins / rs.length) * 100).toFixed(0)}%`.padStart(7),
    pct((r) => r.hitHalf).padStart(7),
    pct((r) => r.reason === "STOP").padStart(6),
    pct((r) => r.reason === "TP").padStart(5),
    `$${avg(rs.map((r) => r.entryPrem)).toFixed(2)}`.padStart(8),
    avg(usd).toFixed(1).padStart(9),
    avg(net).toFixed(1).padStart(8),
    net.reduce((a, b) => a + b, 0).toFixed(0).padStart(10),
    avg(rs.map((r) => r.heldMin)).toFixed(0).padStart(7),
  );
}
const HEAD = "yapılandırma".padEnd(28) + "   n" + " isabet" + "  yarıTP" + "  stop" + "   TP"
  + " ortPrim" + "    ortBrüt" + "   ortNet" + "   toplamNet" + " ortDak";

async function main() {
  const spy1 = loadCached("spy1"), spy5 = loadCached("spy5");
  const all = [...new Set(spy1.map((b) => nyParts(b.time).ymd))].sort()
    .filter((d) => barsOfSessionDay(spy1, d).length > 200);
  // Gerçek 0DTE primi yalnızca 1m'in 8 günlük penceresinde var
  const days = all.slice(-7);
  console.log(`Prim verisi denenecek seanslar: ${days.join(" ")}\n`);

  const SPEC_E: EntryCfg = { streak: 2, bodyMin: 0.5, closeMin: 0.6, rsi5Level: true };
  const SPEC_P: PosCfg = { stopPct: -0.30, halfPct: 0.20, fullPct: 0.50, maxMinutes: 45, reverseExit: true };
  const END = 15 * 60 + 40;

  const ctxByDay = new Map<string, Ctx>();
  for (const d of days) {
    const m1 = barsOfSessionDay(spy1, d);
    const m5 = spy5.filter((b) => nyParts(b.time).ymd === d);
    ctxByDay.set(d, { m1, m5, r1: rsi(m1.map((b) => b.close), 14), r5: rsi(m5.map((b) => b.close), 14) });
  }

  // Gereken kontratları topla (tüm varyantların birleşimi) ve indir
  const need = new Set<string>();
  for (const d of days) {
    const ctx = ctxByDay.get(d)!;
    for (const cfg of [SPEC_E, { ...SPEC_E, rsi5Level: false }, { ...SPEC_E, streak: 3 }]) {
      for (const { i, side } of scanEntries(ctx, d, cfg, END)) {
        need.add(`${d}|${side === 1 ? "C" : "P"}|${Math.round(ctx.m1[i].close)}`);
      }
    }
  }
  console.log(`Gereken 0DTE kontrat: ${need.size} — indiriliyor…`);
  const premCache = new Map<string, Map<number, Bar>>();
  let ok = 0;
  for (const key of need) {
    const [d, cp, k] = key.split("|");
    const bars = await fetchPremium(d, cp === "C", Number(k));
    if (bars.length) { premCache.set(key, new Map(bars.map((b) => [b.time, b]))); ok++; }
  }
  console.log(`prim verisi gelen: ${ok}/${need.size}\n`);

  const premOf = (d: string) => (isCall: boolean, strike: number) =>
    premCache.get(`${d}|${isCall ? "C" : "P"}|${strike}`) ?? null;

  const run = (e: EntryCfg, p: PosCfg, endMin = END) => {
    let out: Res[] = [];
    for (const d of days) out = out.concat(simulate(ctxByDay.get(d)!, d, e, p, endMin, premOf(d)));
    return out;
  };

  console.log("═══ SPEC · GERÇEK 0DTE PRİMİ ═══");
  console.log(HEAD);
  const spec = run(SPEC_E, SPEC_P);
  report("SPEC (tam)", spec);
  report("SPEC 3 mum", run({ ...SPEC_E, streak: 3 }, SPEC_P));
  report("SPEC − RSI50 şartı", run({ ...SPEC_E, rsi5Level: false }, SPEC_P));
  report("SPEC − yarı kapama", run(SPEC_E, { ...SPEC_P, halfPct: null }));
  report("SPEC − sabit stop", run(SPEC_E, { ...SPEC_P, stopPct: -0.95 }));
  report("SPEC − süre sınırı", run(SPEC_E, { ...SPEC_P, maxMinutes: null }));
  report("SPEC − ters çıkış", run(SPEC_E, { ...SPEC_P, reverseExit: false }));
  report("SPEC stop −%20", run(SPEC_E, { ...SPEC_P, stopPct: -0.20 }));
  report("SPEC stop −%40", run(SPEC_E, { ...SPEC_P, stopPct: -0.40 }));
  report("SPEC stop −%50", run(SPEC_E, { ...SPEC_P, stopPct: -0.50 }));
  report("SPEC yarı +%15", run(SPEC_E, { ...SPEC_P, halfPct: 0.15 }));
  report("SPEC yarı +%30", run(SPEC_E, { ...SPEC_P, halfPct: 0.30 }));
  report("SPEC hedef +%80", run(SPEC_E, { ...SPEC_P, fullPct: 0.80 }));
  report("SPEC süre 25dk", run(SPEC_E, { ...SPEC_P, maxMinutes: 25 }));
  report("SPEC süre 60dk", run(SPEC_E, { ...SPEC_P, maxMinutes: 60 }));
  report("SPEC pencere 14:00", run(SPEC_E, SPEC_P, 14 * 60));

  console.log("\n═══ SPEC · GÜNLÜK ═══");
  console.log("gün".padEnd(12) + "   n" + "   günNet$" + "  kümülatif");
  let cum = 0;
  for (const d of days) {
    const ts = spec.filter((r) => r.day === d);
    const s = ts.reduce((a, r) => a + r.pnlUsd - SPREAD, 0);
    cum += s;
    console.log(d.padEnd(12), String(ts.length).padStart(4), s.toFixed(0).padStart(10), cum.toFixed(0).padStart(11));
  }

  console.log("\n═══ SPEC · İŞLEM DÖKÜMÜ ═══");
  console.log("gün".padEnd(11) + " saat" + "  yön" + "  kontrat".padEnd(12) + " giriş$" + "   %sonuç" + "    net$" + "  dak" + "  neden");
  for (const r of spec) {
    console.log(
      r.day.padEnd(11),
      nyParts(r.time).hhmm,
      (r.side === 1 ? "CALL" : "PUT ").padStart(5),
      r.contract.slice(3).padEnd(13),
      `$${r.entryPrem.toFixed(2)}`.padStart(6),
      `${(r.pnlPct * 100).toFixed(1)}%`.padStart(8),
      (r.pnlUsd - SPREAD).toFixed(0).padStart(7),
      r.heldMin.toFixed(0).padStart(5),
      ` ${r.reason}`,
    );
  }
  console.log(`\nNet = brüt − $${SPREAD} gidiş-dönüş spread · prim GERÇEK (Yahoo 1m, süresi dolmuş 0DTE zinciri)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
