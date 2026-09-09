/**
 * Kullanıcının NET STRATEJİ SPEC'inin birebir testi — 20 seans.
 *
 * SPEC (kullanıcının tanımı, olduğu gibi):
 *   GİRİŞ
 *     1m : 2-3 ardışık aynı yönlü mum + hacim > son 15 mum ort. + RSI(14) yön onayı
 *     5m : aynı yönde mum kapanışı + RSI(14) aynı yönde (LONG'da >50, SHORT'ta <50)
 *     İkisi aynı anda sağlanmadan girilmez.
 *   POZİSYON
 *     sabit stop  : −%30 prim (asla taşınmaz)
 *     +%20'de      : pozisyonun YARISI kapanır
 *     kalan yarı   : +%50'de tam kapanır VEYA ters onay seti gelirse hemen kapanır
 *   SÜRE        : 40-50 dk üst sınır
 *   YENİDEN GİRİŞ: kapanıştan sonra ilk ters 1m mumu (düzeltme) beklenir
 *
 * ── NEDEN PRİM MODELLENİYOR ───────────────────────────────────────
 * Yüzdeler PRİM üzerinden tanımlı, ama arşiv yalnızca giriş/çıkış primini
 * saklıyor; işlem İÇİNDEKİ prim yolu hiçbir yerde yok ve Yahoo süresi dolmuş
 * 0DTE intraday primini siliyor. Yüzde kurallarını tek seanstan fazlasında
 * test etmenin tek yolu primi SPY'den üretmek.
 *
 * Model: Black-Scholes (r=0, q=0), ATM strike = round(spot), T = 16:00 ET'ye
 * kalan süre. σ o seansın KENDİ 1m getirilerinden (gerçekleşen oynaklık),
 * ivMult ile ölçeklenir. Model prim SEVİYESİNİ ve theta erimesini taşır —
 * yüzde eşiklerinin davranışı buna bağlı olduğu için ivMult duyarlılığı
 * ayrıca raporlanır. SPY PUAN ölçümleri gerçek; $ ve % çevrimi modeldir.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  barsOfSessionDay, nyParts, nyDateTimeToEpoch, rsi,
  RTH_OPEN_MIN, RTH_CLOSE_MIN, ENTRY_START_MIN, EOD_FORCE_MIN, type Bar,
} from "../lib/spyengine/core";

const CACHE = join(process.cwd(), ".cache-lagstudy");
function load(key: string): Bar[] {
  const f = join(CACHE, `${key}.json`);
  if (!existsSync(f)) throw new Error(`Önce lag_study.ts çalıştır (önbellek yok: ${key})`);
  return JSON.parse(readFileSync(f, "utf-8")).data as Bar[];
}

// ── Black-Scholes (0DTE ATM için yeterli) ─────────────────────────
const YEAR = 365 * 24 * 3600;
function ncdf(x: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
function bs(S: number, K: number, tYears: number, sigma: number, isCall: boolean): number {
  if (tYears <= 0) return Math.max(0, isCall ? S - K : K - S);
  const v = sigma * Math.sqrt(tYears);
  if (v < 1e-9) return Math.max(0, isCall ? S - K : K - S);
  const d1 = (Math.log(S / K) + 0.5 * v * v) / v;
  const d2 = d1 - v;
  return isCall ? S * ncdf(d1) - K * ncdf(d2) : K * ncdf(-d2) - S * ncdf(-d1);
}

/** O seansın 1m getirilerinden yıllıklandırılmış gerçekleşen oynaklık */
function realizedVol(m1: Bar[]): number {
  const rets: number[] = [];
  for (let i = 1; i < m1.length; i++) {
    if (m1[i - 1].close > 0) rets.push(Math.log(m1[i].close / m1[i - 1].close));
  }
  if (rets.length < 30) return 0.15;
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - mu) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(varr) * Math.sqrt(252 * 390);
}

const dirOf = (b: Bar) => (b.close > b.open ? 1 : b.close < b.open ? -1 : 0);
const bodyR = (b: Bar) => { const r = Math.max(1e-9, b.high - b.low); return Math.abs(b.close - b.open) / r; };
const closePos = (b: Bar) => { const r = Math.max(1e-9, b.high - b.low); return (b.close - b.low) / r; };
function avgVol(bars: Bar[], i: number, n = 15): number | null {
  const s = Math.max(0, i - n);
  if (s >= i) return null;
  return bars.slice(s, i).reduce((a, b) => a + (b.volume || 0), 0) / (i - s);
}

interface Ctx {
  m1: Bar[]; m5: Bar[];
  r1: (number | null)[]; r5: (number | null)[];
  sigma: number; expiry: number;
}

// ── SPEC: giriş kapısı ────────────────────────────────────────────
interface EntryCfg {
  streak: number;
  bodyMin: number;      // üretimdeki patern kapısı (spec'te yok ama üretimde var)
  closeMin: number;
  rsi5Level: boolean;   // spec: 5m RSI LONG'da >50, SHORT'ta <50
}

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

// ── SPEC: pozisyon yönetimi (prim yüzdeleri üzerinden) ────────────
interface PosCfg {
  stopPct: number;      // −0.30
  halfPct: number;      // +0.20 → yarı kapat
  fullPct: number;      // +0.50 → tam kapat
  maxMinutes: number;   // 45
  reverseExit: boolean; // ters onay seti gelirse kapat
}

interface Res {
  time: number; side: 1 | -1; entrySpot: number; entryPrem: number;
  exitTime: number; pnlPct: number; pnlUsd: number; reason: string;
  heldMin: number; hitHalf: boolean; spotPts: number;
}

function runTrade(ctx: Ctx, i: number, side: 1 | -1, cfg: PosCfg, ecfg: EntryCfg, eod: number): Res {
  const entryBar = ctx.m1[i];
  const S0 = entryBar.close;
  const K = Math.round(S0);
  const isCall = side === 1;
  const t0 = Math.max(60, ctx.expiry - entryBar.time) / YEAR;
  const P0 = Math.max(0.05, bs(S0, K, t0, ctx.sigma, isCall));

  let open = 1.0;           // kalan pozisyon oranı
  let realized = 0;         // kapatılan kısımlardan gelen % getiri (ağırlıklı)
  let hitHalf = false;
  let m5Cur = -1;
  let against = 0;

  for (let k = i + 1; k < ctx.m1.length; k++) {
    const b = ctx.m1[k];
    while (m5Cur + 1 < ctx.m5.length && ctx.m5[m5Cur + 1].time + 300 <= b.time + 60) m5Cur++;

    const tt = Math.max(30, ctx.expiry - b.time) / YEAR;
    const heldMin = (b.time - entryBar.time) / 60;

    // Mum içi uçlar: stop ve hedef için kötümser sıra (önce stop)
    const adverse = isCall ? b.low : b.high;
    const favorable = isCall ? b.high : b.low;
    const pAdv = bs(adverse, K, tt, ctx.sigma, isCall);
    const pFav = bs(favorable, K, tt, ctx.sigma, isCall);
    const pClose = bs(b.close, K, tt, ctx.sigma, isCall);

    // 1) sabit stop — asla taşınmaz
    if (pAdv <= P0 * (1 + cfg.stopPct)) {
      realized += open * cfg.stopPct;
      return {
        time: entryBar.time, side, entrySpot: S0, entryPrem: P0,
        exitTime: b.time, pnlPct: realized, pnlUsd: realized * P0 * 100,
        reason: "STOP", heldMin, hitHalf, spotPts: (b.close - S0) * side,
      };
    }
    // 2) +%20 → yarı kapat (bir kez)
    if (!hitHalf && pFav >= P0 * (1 + cfg.halfPct)) {
      realized += 0.5 * cfg.halfPct;
      open = 0.5;
      hitHalf = true;
    }
    // 3) +%50 → tam kapat
    if (hitHalf && pFav >= P0 * (1 + cfg.fullPct)) {
      realized += open * cfg.fullPct;
      return {
        time: entryBar.time, side, entrySpot: S0, entryPrem: P0,
        exitTime: b.time, pnlPct: realized, pnlUsd: realized * P0 * 100,
        reason: "TP50", heldMin, hitHalf, spotPts: (b.close - S0) * side,
      };
    }
    // 4) ters onay seti → hemen kapat
    if (cfg.reverseExit) {
      const d = dirOf(b);
      if (d === -side) against++; else if (d === side) against = 0;
      if (against >= 2 && entryOk(ctx, k, m5Cur, -side as 1 | -1, ecfg)) {
        realized += open * (pClose / P0 - 1);
        return {
          time: entryBar.time, side, entrySpot: S0, entryPrem: P0,
          exitTime: b.time, pnlPct: realized, pnlUsd: realized * P0 * 100,
          reason: "TERS", heldMin, hitHalf, spotPts: (b.close - S0) * side,
        };
      }
    }
    // 5) süre sınırı / gün sonu
    if (heldMin >= cfg.maxMinutes || b.time >= eod) {
      realized += open * (pClose / P0 - 1);
      return {
        time: entryBar.time, side, entrySpot: S0, entryPrem: P0,
        exitTime: b.time, pnlPct: realized, pnlUsd: realized * P0 * 100,
        reason: heldMin >= cfg.maxMinutes ? "SÜRE" : "EOD", heldMin, hitHalf, spotPts: (b.close - S0) * side,
      };
    }
  }
  const last = ctx.m1[ctx.m1.length - 1];
  const tt = Math.max(30, ctx.expiry - last.time) / YEAR;
  realized += open * (bs(last.close, K, tt, ctx.sigma, isCall) / P0 - 1);
  return {
    time: entryBar.time, side, entrySpot: S0, entryPrem: P0,
    exitTime: last.time, pnlPct: realized, pnlUsd: realized * P0 * 100,
    reason: "SON", heldMin: (last.time - entryBar.time) / 60, hitHalf, spotPts: (last.close - S0) * side,
  };
}

function runSession(ctx: Ctx, date: string, ecfg: EntryCfg, pcfg: PosCfg, entryEndMin: number): Res[] {
  const { m1 } = ctx;
  const eod = nyDateTimeToEpoch(date, EOD_FORCE_MIN);
  const out: Res[] = [];
  let streakDir = 0, streakLen = 0, m5Cur = -1, blockedUntil = -Infinity;

  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    while (m5Cur + 1 < ctx.m5.length && ctx.m5[m5Cur + 1].time + 300 <= b.time + 60) m5Cur++;
    const d = dirOf(b);
    if (d === 0) { streakDir = 0; streakLen = 0; continue; }
    if (d === streakDir) streakLen++; else { streakDir = d; streakLen = 1; }

    if (b.time < blockedUntil) continue;
    if (streakLen !== ecfg.streak) continue;
    const p = nyParts(b.time);
    if (p.ymd !== date || p.minutes < ENTRY_START_MIN || p.minutes >= entryEndMin) continue;

    const side = streakDir as 1 | -1;
    if (!entryOk(ctx, i, m5Cur, side, ecfg)) continue;

    const r = runTrade(ctx, i, side, pcfg, ecfg, eod);
    out.push(r);
    // Yeniden giriş: kapanıştan sonra İLK ters yönlü 1m mumu bekle
    const corr = m1.find((x) => x.time > r.exitTime && dirOf(x) === -side);
    blockedUntil = corr ? corr.time + 60 : Infinity;
  }
  return out;
}

// ── Rapor ─────────────────────────────────────────────────────────
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const SPREAD_USD = 4; // gidiş-dönüş, kontrat başına (SPY 0DTE ATM için tipik)

function report(label: string, rs: Res[], days: number) {
  if (!rs.length) { console.log(label.padEnd(30), "   0"); return; }
  const usd = rs.map((r) => r.pnlUsd);
  const net = usd.map((u) => u - SPREAD_USD);
  const wins = usd.filter((u) => u > 0).length;
  const stops = rs.filter((r) => r.reason === "STOP").length;
  console.log(
    label.padEnd(30),
    String(rs.length).padStart(4),
    (rs.length / days).toFixed(1).padStart(6),
    `${((wins / rs.length) * 100).toFixed(0)}%`.padStart(6),
    `${((rs.filter((r) => r.hitHalf).length / rs.length) * 100).toFixed(0)}%`.padStart(7),
    `${((stops / rs.length) * 100).toFixed(0)}%`.padStart(6),
    avg(rs.map((r) => r.entryPrem)).toFixed(2).padStart(8),
    avg(usd).toFixed(1).padStart(8),
    avg(net).toFixed(1).padStart(8),
    net.reduce((a, b) => a + b, 0).toFixed(0).padStart(9),
    avg(rs.map((r) => r.heldMin)).toFixed(0).padStart(7),
    avg(rs.map((r) => r.spotPts)).toFixed(3).padStart(9),
  );
}
const HEAD = "yapılandırma".padEnd(30) + "   n" + " gün/iş" + " isabet" + " yarıTP" + "  stop"
  + " ortPrim" + "   ortBrüt" + "   ortNet" + "  toplamNet" + " ortDak" + "  ortPuan";

function main() {
  const spy1 = load("spy1"), spy5 = load("spy5");
  const days = [...new Set(spy1.map((b) => nyParts(b.time).ymd))].sort()
    .filter((d) => barsOfSessionDay(spy1, d).length > 200);

  const ivMults = [1.0, 1.3];
  const SPEC_E: EntryCfg = { streak: 2, bodyMin: 0.5, closeMin: 0.6, rsi5Level: true };
  const SPEC_P: PosCfg = { stopPct: -0.30, halfPct: 0.20, fullPct: 0.50, maxMinutes: 45, reverseExit: true };

  for (const ivMult of ivMults) {
    const ctxByDay = new Map<string, Ctx>();
    for (const d of days) {
      const m1 = barsOfSessionDay(spy1, d);
      const m5 = spy5.filter((b) => nyParts(b.time).ymd === d);
      ctxByDay.set(d, {
        m1, m5,
        r1: rsi(m1.map((b) => b.close), 14),
        r5: rsi(m5.map((b) => b.close), 14),
        sigma: realizedVol(m1) * ivMult,
        expiry: nyDateTimeToEpoch(d, RTH_CLOSE_MIN),
      });
    }

    const run = (e: EntryCfg, p: PosCfg, endMin = 15 * 60 + 40) => {
      let all: Res[] = [];
      for (const d of days) all = all.concat(runSession(ctxByDay.get(d)!, d, e, p, endMin));
      return all;
    };

    console.log("");
    console.log(`═══ SPEC TESTİ · ivMult=${ivMult} · ${days.length} seans · σ ort ${(avg(days.map((d) => ctxByDay.get(d)!.sigma)) * 100).toFixed(0)}% ═══`);
    console.log(HEAD);

    report("SPEC (tam, 2 mum)", run(SPEC_E, SPEC_P), days.length);
    report("SPEC 3 mum seri", run({ ...SPEC_E, streak: 3 }, SPEC_P), days.length);
    report("SPEC − RSI50 şartı", run({ ...SPEC_E, rsi5Level: false }, SPEC_P), days.length);
    report("SPEC − yarı kapama", run(SPEC_E, { ...SPEC_P, halfPct: 999 }), days.length);
    report("SPEC − sabit stop", run(SPEC_E, { ...SPEC_P, stopPct: -0.95 }), days.length);
    report("SPEC − ters çıkış", run(SPEC_E, { ...SPEC_P, reverseExit: false }), days.length);
    report("SPEC süre 90dk (sınırsız)", run(SPEC_E, { ...SPEC_P, maxMinutes: 90 }), days.length);
    report("SPEC süre 25dk", run(SPEC_E, { ...SPEC_P, maxMinutes: 25 }), days.length);
    report("SPEC stop −%20", run(SPEC_E, { ...SPEC_P, stopPct: -0.20 }), days.length);
    report("SPEC stop −%40", run(SPEC_E, { ...SPEC_P, stopPct: -0.40 }), days.length);
    report("SPEC yarı +%15", run(SPEC_E, { ...SPEC_P, halfPct: 0.15 }), days.length);
    report("SPEC yarı +%30", run(SPEC_E, { ...SPEC_P, halfPct: 0.30 }), days.length);
    report("SPEC pencere 14:00", run(SPEC_E, SPEC_P, 14 * 60), days.length);
  }

  // Yüzde eşiklerinin SPY puanı karşılığı — saate göre nasıl değişiyor
  console.log("");
  console.log("═══ %20 / %30 EŞİKLERİ KAÇ SPY PUANINA DENK · ivMult=1.0 ═══");
  console.log("saat (ET)".padEnd(12) + "  ATM prim" + "   delta" + "   +%20 =" + "   −%30 =");
  {
    const d = days[days.length - 1];
    const m1 = barsOfSessionDay(spy1, d);
    const sigma = realizedVol(m1);
    const expiry = nyDateTimeToEpoch(d, RTH_CLOSE_MIN);
    const S = m1[m1.length - 1].close, K = Math.round(S);
    for (const min of [RTH_OPEN_MIN + 30, 11 * 60, 12 * 60, 13 * 60, 14 * 60, 15 * 60]) {
      const t = Math.max(60, expiry - nyDateTimeToEpoch(d, min)) / YEAR;
      const P = bs(S, K, t, sigma, true);
      const eps = 0.01;
      const delta = (bs(S + eps, K, t, sigma, true) - bs(S - eps, K, t, sigma, true)) / (2 * eps);
      console.log(
        `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`.padEnd(12),
        `$${P.toFixed(2)}`.padStart(10),
        delta.toFixed(2).padStart(8),
        `${(0.20 * P / delta).toFixed(2)} puan`.padStart(11),
        `${(0.30 * P / delta).toFixed(2)} puan`.padStart(11),
      );
    }
  }
  console.log("");
  console.log(`Net = brüt − $${SPREAD_USD} gidiş-dönüş spread. Prim MODEL (Black-Scholes, σ = o seansın gerçekleşen`);
  console.log("oynaklığı × ivMult). SPY puan ölçümü gerçek; prim seviyesi ve % davranışı modele bağlı.");
}

main();
