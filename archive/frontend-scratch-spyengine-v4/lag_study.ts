/**
 * "Geç sinyal" teşhisi + erken giriş varyantları — 1m SPY, ~21 seans.
 *
 * NEDEN BU SCRIPT: kullanıcı gözlemi "tam kapı oluştuğunda iş işten geçmiş
 * oluyor, aldığımızda ters mum başlıyor". Bu ölçülebilir bir iddia:
 * girişten ÖNCE ne kadar hareket verilmiş, girişten SONRA ne kadar kalmış.
 *
 * VERİ: Yahoo 1m geçmişi tek istekte 5 gün veriyor ama 7 günlük
 * period1/period2 pencereleriyle 30 güne kadar iniyor (probe_history.ts ile
 * doğrulandı). Böylece örneklem 5 seanstan ~21 seansa çıkıyor — 5 seansta
 * tune etmek curve-fitting olurdu.
 *
 * ÖLÇÜM TANIMLARI (hepsi objektif, tek yorum noktası burada):
 *   origin  = tetikleyen serinin başlangıcından ÖNCEKİ 15 mumun dip/zirvesi
 *             (LONG için min(low), SHORT için max(high)) — hareketin doğduğu yer
 *   peak    = girişten SONRAKİ 30 mumun lehte uç noktası
 *   yakalama% = (peak − giriş) / (peak − origin)  → %100 = hareketin başında
 *             girmişiz, %30 = hareketin üçte ikisi biz girmeden yaşanmış
 *   önKoşu  = giriş fiyatı − son 10 mumun lehte olmayan ucu (ne kadar uzamış)
 *
 * MALİYET: 0DTE ATM ≈ delta 0.5 → prim ≈ SPY puanı × 0.5 × 100. Gidiş-dönüş
 * spread ~$5/kontrat varsayılıyor. Bu bir YAKLAŞIKTIR (gerçek prim yalnızca
 * bugünün zincirinde var); yön/puan ölçümü gerçek, $ çevrimi yaklaşık.
 */

import {
  normalizeBars, snapToInterval, dropBadPrints, barsOfSessionDay,
  nyParts, nyDateTimeToEpoch, rsi, ema,
  RTH_OPEN_MIN, ENTRY_START_MIN, ENTRY_END_MIN, EOD_FORCE_MIN, type Bar,
} from "../lib/spyengine/core";

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json", Referer: "https://finance.yahoo.com/",
};
const SPAN: Record<string, number> = { "1m": 60, "5m": 300 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chartWindow(symbol: string, interval: string, p1: number, p2: number): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?interval=${interval}&period1=${p1}&period2=${p2}&includePrePost=true`;
  const raw = await (await fetch(url, { headers: H })).json();
  const r = raw?.chart?.result?.[0];
  if (!r) return [];
  const ts: number[] = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const out: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open?.[i] == null || q.close?.[i] == null) continue;
    out.push({ time: ts[i], open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] ?? 0 });
  }
  return out;
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache-lagstudy");

/** Yahoo yanıtını diske yazar — varyant taramasını her denemede yeniden indirmeyelim */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const f = join(CACHE_DIR, `${key}.json`);
  if (existsSync(f)) {
    const age = Date.now() - JSON.parse(readFileSync(f, "utf-8")).ts;
    if (age < 6 * 3600 * 1000) return Promise.resolve(JSON.parse(readFileSync(f, "utf-8")).data as T);
  }
  return load().then((data) => { writeFileSync(f, JSON.stringify({ ts: Date.now(), data })); return data; });
}

/** 30 günü 7 günlük pencerelerle toplar (Yahoo 1m sınırı) */
async function loadHistory(symbol: string, interval: string, weeks = 4): Promise<Bar[]> {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const map = new Map<number, Bar>();
  for (let w = 0; w < weeks; w++) {
    const p2 = now - w * 7 * DAY;
    const p1 = p2 - 7 * DAY;
    const bars = await chartWindow(symbol, interval, p1, p2);
    for (const b of bars) map.set(b.time, b);
    await sleep(350);
  }
  const merged = Array.from(map.values()).sort((a, b) => a.time - b.time);
  const s = SPAN[interval] ?? 0;
  return dropBadPrints(s ? snapToInterval(normalizeBars(merged), s) : normalizeBars(merged)).bars;
}

const dirOf = (b: Bar) => (b.close > b.open ? 1 : b.close < b.open ? -1 : 0);
const bodyR = (b: Bar) => { const r = Math.max(1e-9, b.high - b.low); return Math.abs(b.close - b.open) / r; };
const closePos = (b: Bar) => { const r = Math.max(1e-9, b.high - b.low); return (b.close - b.low) / r; };

/** Üretimdeki avgVolume ile birebir: [i-n, i-1] ortalaması, mevcut mum HARİÇ */
function avgVol(bars: Bar[], i: number, n = 15): number | null {
  const start = Math.max(0, i - n);
  if (start >= i) return null;
  const slice = bars.slice(start, i);
  return slice.reduce((s, b) => s + (b.volume || 0), 0) / slice.length;
}

/** 09:30'dan itibaren çapalanmış kümülatif VWAP (trader'ın kastettiği VWAP) */
function rthVwap(m1: Bar[], rthOpen: number): (number | null)[] {
  let pv = 0, vv = 0;
  return m1.map((b) => {
    if (b.time < rthOpen) return null;
    const tp = (b.high + b.low + b.close) / 3;
    pv += tp * (b.volume || 0);
    vv += b.volume || 0;
    return vv > 0 ? pv / vv : null;
  });
}

interface Ctx {
  m1: Bar[]; m5: Bar[];
  r1: (number | null)[]; r5: (number | null)[];
  vwap: (number | null)[];
  e5: (number | null)[];        // 5m EMA9 (eğim için)
  qqqDir: (number | null)[];    // aynı dakikadaki QQQ mum yönü
  qqqVwapSide: (number | null)[]; // QQQ VWAP'ın hangi tarafında
  orHigh: number | null; orLow: number | null; orEnd: number;
  rthOpen: number;
}

function buildCtx(m1: Bar[], m5All: Bar[], qqq1: Map<number, Bar>, date: string): Ctx {
  const rthOpen = nyDateTimeToEpoch(date, RTH_OPEN_MIN);
  const m5 = m5All.filter((b) => nyParts(b.time).ymd === date);

  // Açılış aralığı: 09:30–09:45
  const orEnd = rthOpen + 15 * 60;
  const orBars = m1.filter((b) => b.time >= rthOpen && b.time < orEnd);
  const orHigh = orBars.length ? Math.max(...orBars.map((b) => b.high)) : null;
  const orLow = orBars.length ? Math.min(...orBars.map((b) => b.low)) : null;

  // QQQ: aynı dakikanın mum yönü + kendi VWAP tarafı
  const qqqSession = Array.from(qqq1.values())
    .filter((b) => nyParts(b.time).ymd === date)
    .sort((a, b) => a.time - b.time);
  const qVwap = rthVwap(qqqSession, rthOpen);
  const qVwapAt = new Map<number, number | null>();
  qqqSession.forEach((b, i) => qVwapAt.set(b.time, qVwap[i]));

  return {
    m1, m5,
    r1: rsi(m1.map((b) => b.close), 14),
    r5: rsi(m5.map((b) => b.close), 14),
    vwap: rthVwap(m1, rthOpen),
    e5: ema(m5.map((b) => b.close), 9),
    qqqDir: m1.map((b) => { const q = qqq1.get(b.time); return q ? dirOf(q) : null; }),
    qqqVwapSide: m1.map((b) => {
      const q = qqq1.get(b.time); const v = qVwapAt.get(b.time);
      if (!q || v == null) return null;
      return q.close > v ? 1 : q.close < v ? -1 : 0;
    }),
    orHigh, orLow, orEnd, rthOpen,
  };
}

// ── Giriş varyantları ─────────────────────────────────────────────

export interface Variant {
  name: string;
  streak: number;
  bodyMin: number;
  closeMin: number;
  volMult: number;          // hacim eşiği = ort × volMult
  rsi1Dir: boolean;
  m5Candle: boolean;        // son KAPALI 5m mum yönü (gecikme kaynağı şüphelisi)
  m5Rsi: boolean;
  m5RsiLevel: boolean;      // spec: 5m RSI LONG>50 / SHORT<50
  vwapSide: boolean;        // fiyat VWAP'ın doğru tarafında
  m5EmaSlope: boolean;      // 5m EMA9 eğimi yönle uyumlu
  qqqConfirm: boolean;      // QQQ aynı yönde (mum yönü)
  qqqVwap: boolean;         // QQQ da kendi VWAP'ının doğru tarafında
  orb: boolean;             // açılış aralığı kırılımı + retest gerekli
  perHour: number | null;
}

const BASE: Omit<Variant, "name"> = {
  streak: 2, bodyMin: 0.5, closeMin: 0.6, volMult: 1, rsi1Dir: true,
  m5Candle: true, m5Rsi: true, m5RsiLevel: false, vwapSide: false, m5EmaSlope: false,
  qqqConfirm: false, qqqVwap: false, orb: false, perHour: 3,
};

function entryOk(ctx: Ctx, i: number, m5Cur: number, side: 1 | -1, v: Variant): boolean {
  const b = ctx.m1[i];

  if (bodyR(b) < v.bodyMin) return false;
  const cs = side === 1 ? closePos(b) : 1 - closePos(b);
  if (cs < v.closeMin) return false;

  const va = avgVol(ctx.m1, i, 15);
  if (va != null && va > 0 && (b.volume || 0) < va * v.volMult) return false;

  if (v.rsi1Dir) {
    const r = ctx.r1[i], rp = ctx.r1[i - 1];
    if (r == null || rp == null) return false;
    if (side === 1 ? r <= rp : r >= rp) return false;
  }
  if (v.m5Candle) {
    if (m5Cur < 0) return false;
    if (dirOf(ctx.m5[m5Cur]) !== side) return false;
  }
  if (v.m5Rsi) {
    if (m5Cur < 1) return false;
    const r = ctx.r5[m5Cur], rp = ctx.r5[m5Cur - 1];
    if (r == null || rp == null) return false;
    if (side === 1 ? r < rp : r > rp) return false;
    if (v.m5RsiLevel && (side === 1 ? r <= 50 : r >= 50)) return false;
  }
  if (v.m5EmaSlope) {
    if (m5Cur < 1) return false;
    const e = ctx.e5[m5Cur], ep = ctx.e5[m5Cur - 1];
    if (e == null || ep == null) return false;
    if (side === 1 ? e <= ep : e >= ep) return false;
  }
  if (v.vwapSide) {
    const w = ctx.vwap[i];
    if (w == null) return false;
    if (side === 1 ? b.close <= w : b.close >= w) return false;
  }
  if (v.qqqConfirm) {
    const d = ctx.qqqDir[i];
    if (d == null || d !== side) return false;
  }
  if (v.qqqVwap) {
    const s = ctx.qqqVwapSide[i];
    if (s == null || s !== side) return false;
  }
  if (v.orb) {
    if (ctx.orHigh == null || ctx.orLow == null) return false;
    if (b.time < ctx.orEnd) return false;
    const lvl = side === 1 ? ctx.orHigh : ctx.orLow;
    // kırılım YAŞANMIŞ olmalı (son 30 mumda seviyeyi aşan bir kapanış)
    let broke = false, retest = false;
    for (let k = Math.max(0, i - 30); k < i; k++) {
      const x = ctx.m1[k];
      if (!broke && (side === 1 ? x.close > lvl : x.close < lvl)) { broke = true; continue; }
      // kırılımdan sonra seviyeye geri dokunma (retest)
      if (broke && (side === 1 ? x.low <= lvl * 1.0006 : x.high >= lvl * 0.9994)) retest = true;
    }
    if (!broke || !retest) return false;
    if (side === 1 ? b.close <= lvl : b.close >= lvl) return false;
  }
  return true;
}

// ── Çıkış ─────────────────────────────────────────────────────────

export interface ExitCfg {
  reversal: number;
  fullConfirm: boolean;   // ters seride girişin TÜM onay seti ters yönde (üretim)
  tpPoints: number | null;   // sabit hedef (SPY puanı)
  slPoints: number | null;   // sabit stop (SPY puanı)
  trailAfter: number | null; // bu kadar puan lehte gidince trailing başlar
  trailBy: number | null;    // zirveden bu kadar geri çekilince çık
  maxBars: number | null;    // süre sınırı
}

const EXIT_PROD: ExitCfg = {
  reversal: 2, fullConfirm: true,
  tpPoints: null, slPoints: null, trailAfter: null, trailBy: null, maxBars: null,
};

function scanExit(ctx: Ctx, entryIdx: number, side: 1 | -1, eod: number, ex: ExitCfg) {
  const entry = ctx.m1[entryIdx].close;
  let against = 0, m5Cur = -1, best = 0;

  for (let i = entryIdx + 1; i < ctx.m1.length; i++) {
    const b = ctx.m1[i];
    while (m5Cur + 1 < ctx.m5.length && ctx.m5[m5Cur + 1].time + 300 <= b.time + 60) m5Cur++;
    if (b.time >= eod) return { idx: i, price: b.close, reason: "EOD" };

    const fav = side === 1 ? b.high - entry : entry - b.low;
    const adv = side === 1 ? b.low - entry : entry - b.high;

    // Sabit stop önce (aynı mumda ikisi de olursa kötümser varsayım)
    if (ex.slPoints != null && adv <= -ex.slPoints) {
      return { idx: i, price: side === 1 ? entry - ex.slPoints : entry + ex.slPoints, reason: "SL" };
    }
    if (ex.tpPoints != null && fav >= ex.tpPoints) {
      return { idx: i, price: side === 1 ? entry + ex.tpPoints : entry - ex.tpPoints, reason: "TP" };
    }
    best = Math.max(best, fav);
    if (ex.trailAfter != null && ex.trailBy != null && best >= ex.trailAfter) {
      const stop = side === 1 ? entry + best - ex.trailBy : entry - best + ex.trailBy;
      if (side === 1 ? b.low <= stop : b.high >= stop) return { idx: i, price: stop, reason: "TRAIL" };
    }
    if (ex.maxBars != null && i - entryIdx >= ex.maxBars) {
      return { idx: i, price: b.close, reason: "TIME" };
    }

    const d = dirOf(b);
    if (d === -side) against++;
    else if (d === side) against = 0;

    if (against >= ex.reversal) {
      if (!ex.fullConfirm) return { idx: i, price: b.close, reason: "REV" };
      // Üretim: ters seri + ters yönde patern/hacim/1m RSI/5m mum/5m RSI
      const opp = -side as 1 | -1;
      if (entryOk(ctx, i, m5Cur, opp, { name: "", ...BASE })) {
        return { idx: i, price: b.close, reason: "REV" };
      }
    }
  }
  const last = ctx.m1[ctx.m1.length - 1];
  return { idx: ctx.m1.length - 1, price: last.close, reason: "SON" };
}

// ── Seans oynatma ─────────────────────────────────────────────────

export interface Trade {
  time: number; side: 1 | -1; spot: number;
  exitTime: number; exitSpot: number; reason: string;
  pts: number; mfe: number; mae: number; bars: number;
  capture: number | null;   // hareketin ne kadarını yakaladık (0..1)
  preRun: number;           // girişten önce verilen hareket (puan)
  mae3: number;             // ilk 3 mumdaki en kötü nokta
  barsToPeak: number;
}

function runSession(ctx: Ctx, date: string, v: Variant, ex: ExitCfg): Trade[] {
  const { m1 } = ctx;
  const eod = nyDateTimeToEpoch(date, EOD_FORCE_MIN);
  const trades: Trade[] = [];
  let streakDir = 0, streakLen = 0, streakStart = 0, m5Cur = -1;
  let blockedUntil = -Infinity;
  const recent: number[] = [];

  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    while (m5Cur + 1 < ctx.m5.length && ctx.m5[m5Cur + 1].time + 300 <= b.time + 60) m5Cur++;

    const d = dirOf(b);
    if (d === 0) { streakDir = 0; streakLen = 0; continue; }
    if (d === streakDir) streakLen++;
    else { streakDir = d; streakLen = 1; streakStart = i; }

    if (b.time < blockedUntil) continue;
    if (streakLen !== v.streak) continue;

    const p = nyParts(b.time);
    if (p.ymd !== date || p.minutes < ENTRY_START_MIN || p.minutes >= ENTRY_END_MIN) continue;

    const side = streakDir as 1 | -1;
    if (!entryOk(ctx, i, m5Cur, side, v)) continue;

    if (v.perHour != null) {
      while (recent.length && b.time - recent[0] > 3600) recent.shift();
      if (recent.length >= v.perHour) continue;
    }

    const exit = scanExit(ctx, i, side, eod, ex);
    const entry = b.close;

    let mfe = 0, mae = 0, mae3 = 0, barsToPeak = 0;
    for (let k = i + 1; k <= exit.idx; k++) {
      const fav = side === 1 ? m1[k].high - entry : entry - m1[k].low;
      const adv = side === 1 ? m1[k].low - entry : entry - m1[k].high;
      if (fav > mfe) { mfe = fav; barsToPeak = k - i; }
      mae = Math.min(mae, adv);
      if (k - i <= 3) mae3 = Math.min(mae3, adv);
    }

    // Gecikme ölçümü: origin (seri öncesi 15 mum) → peak (giriş sonrası 30 mum)
    const oStart = Math.max(0, streakStart - 15);
    const oWin = m1.slice(oStart, streakStart + 1);
    const origin = oWin.length
      ? (side === 1 ? Math.min(...oWin.map((x) => x.low)) : Math.max(...oWin.map((x) => x.high)))
      : entry;
    const pWin = m1.slice(i + 1, Math.min(m1.length, i + 31));
    const peak = pWin.length
      ? (side === 1 ? Math.max(...pWin.map((x) => x.high)) : Math.min(...pWin.map((x) => x.low)))
      : entry;
    const whole = side === 1 ? peak - origin : origin - peak;
    const left = side === 1 ? peak - entry : entry - peak;
    const capture = whole > 0.01 ? Math.max(0, left) / whole : null;
    const preRun = side === 1 ? entry - origin : origin - entry;

    trades.push({
      time: b.time, side, spot: entry,
      exitTime: m1[exit.idx].time, exitSpot: exit.price, reason: exit.reason,
      pts: (exit.price - entry) * side,
      mfe, mae, bars: exit.idx - i, capture, preRun, mae3, barsToPeak,
    });
    recent.push(b.time);

    const corr = m1.find((x) => x.time > m1[exit.idx].time && dirOf(x) === -side);
    blockedUntil = corr ? corr.time : Infinity;
  }
  return trades;
}

// ── Rapor ─────────────────────────────────────────────────────────

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** 0DTE ATM yaklaşığı: prim ≈ SPY puanı × 0.5 × 100, gidiş-dönüş spread $5 */
const DELTA = 0.5, CONTRACT = 100, RT_COST = 5;
const toDollars = (pts: number) => pts * DELTA * CONTRACT - RT_COST;

function report(label: string, trades: Trade[], days: number) {
  if (!trades.length) { console.log(label.padEnd(32), "  0 işlem"); return; }
  const pts = trades.map((t) => t.pts);
  const wins = pts.filter((p) => p > 0).length;
  const dollars = pts.map(toDollars);
  const caps = trades.map((t) => t.capture).filter((c): c is number => c != null);
  console.log(
    label.padEnd(32),
    String(trades.length).padStart(4),
    (trades.length / days).toFixed(1).padStart(6),
    `${((wins / trades.length) * 100).toFixed(0)}%`.padStart(6),
    avg(pts).toFixed(3).padStart(8),
    (avg(dollars)).toFixed(1).padStart(8),
    (dollars.reduce((a, b) => a + b, 0)).toFixed(0).padStart(8),
    avg(trades.map((t) => t.mfe)).toFixed(3).padStart(7),
    avg(trades.map((t) => t.mae)).toFixed(3).padStart(7),
    `${(avg(caps) * 100).toFixed(0)}%`.padStart(7),
    avg(trades.map((t) => t.preRun)).toFixed(3).padStart(8),
    avg(trades.map((t) => t.mae3)).toFixed(3).padStart(7),
    avg(trades.map((t) => t.bars)).toFixed(0).padStart(6),
    avg(trades.map((t) => t.barsToPeak)).toFixed(0).padStart(6),
  );
}

const HEAD = "varyant".padEnd(32) + "  n" + "  gün/iş" + " isabet"
  + "   ortPuan" + "     ort$" + "  toplam$" + "  ortMFE" + "  ortMAE"
  + " yakala" + "   önKoşu" + " ilk3MAE" + "  ortMum" + " zirve";

async function main() {
  console.log("Veri yükleniyor (SPY 1m/5m + QQQ 1m, 4×7 gün)…");
  const [spy1, spy5, qqq1arr] = await Promise.all([
    cached("spy1", () => loadHistory("SPY", "1m")),
    cached("spy5", () => loadHistory("SPY", "5m")),
    cached("qqq1", () => loadHistory("QQQ", "1m")),
  ]);
  const qqq1 = new Map(qqq1arr.map((b) => [b.time, b]));

  const days = [...new Set(spy1.map((b) => nyParts(b.time).ymd))].sort()
    .filter((d) => barsOfSessionDay(spy1, d).length > 200);
  console.log(`seans: ${days.length} · ${days[0]} → ${days[days.length - 1]}`);
  console.log(`SPY 1m bar: ${spy1.length} · QQQ 1m bar: ${qqq1arr.length}\n`);

  const ctxByDay = new Map<string, Ctx>();
  for (const d of days) {
    const m1 = barsOfSessionDay(spy1, d);
    ctxByDay.set(d, buildCtx(m1, spy5, qqq1, d));
  }

  const variants: Variant[] = [
    { name: "P  ÜRETİM (2mum+5m teyit)", ...BASE },
    { name: "S  SPEC = P + 5m RSI>50/<50", ...BASE, m5RsiLevel: true },
    { name: "S3 SPEC + 3 mum seri", ...BASE, m5RsiLevel: true, streak: 3 },
    { name: "A  P − 5m mum kapısı", ...BASE, m5Candle: false },
    { name: "B  P − 5m'in tamamı", ...BASE, m5Candle: false, m5Rsi: false },
    { name: "C  B + VWAP tarafı", ...BASE, m5Candle: false, m5Rsi: false, vwapSide: true },
    { name: "D  C + 5m EMA9 eğimi", ...BASE, m5Candle: false, m5Rsi: false, vwapSide: true, m5EmaSlope: true },
    { name: "E  C + QQQ mum teyidi", ...BASE, m5Candle: false, m5Rsi: false, vwapSide: true, qqqConfirm: true },
    { name: "F  C + QQQ VWAP tarafı", ...BASE, m5Candle: false, m5Rsi: false, vwapSide: true, qqqVwap: true },
    { name: "G  TEK MUM + VWAP (en erken)", ...BASE, streak: 1, bodyMin: 0.6, closeMin: 0.65, volMult: 1.2, m5Candle: false, m5Rsi: false, vwapSide: true },
    { name: "H  G + QQQ VWAP", ...BASE, streak: 1, bodyMin: 0.6, closeMin: 0.65, volMult: 1.2, m5Candle: false, m5Rsi: false, vwapSide: true, qqqVwap: true },
    { name: "I  ORB kır-retest-devam", ...BASE, m5Candle: false, m5Rsi: false, vwapSide: true, orb: true },
  ];

  console.log("═══ GİRİŞ VARYANTLARI · çıkış hepsinde ÜRETİM kuralı (2 ters mum + tam onay) ═══");
  console.log(HEAD);
  const results = new Map<string, Trade[]>();
  for (const v of variants) {
    let all: Trade[] = [];
    for (const d of days) all = all.concat(runSession(ctxByDay.get(d)!, d, v, EXIT_PROD));
    results.set(v.name, all);
    report(v.name, all, days.length);
  }

  console.log("\nyakala% = (zirve − giriş) / (zirve − hareketin doğduğu nokta) · %100 = hareketin başında girmişiz");
  console.log("önKoşu  = giriş anına kadar verilen puan · ilk3MAE = girişten sonraki 3 mumun en kötüsü");
  console.log("ort$    = YAKLAŞIK (delta 0.5 · 100 çarpan · $5 gidiş-dönüş spread) — gerçek prim değil\n");

  // ── MFE dağılımı: hedefi nereye koymalı ───────────────────────────
  // Çıkış kuralından BAĞIMSIZ olarak, giriş sonrası 40 mum içinde fiyat
  // lehimize en fazla ne kadar gitmiş? TP seviyesi buradan seçilir,
  // "iyi görünen bir sayıdan" değil.
  const FOCUS = ["P  ÜRETİM (2mum+5m teyit)", "B  P − 5m'in tamamı", "G  TEK MUM + VWAP (en erken)"];

  console.log("═══ MFE DAĞILIMI · girişten sonraki 40 mum · çıkış kuralı devre dışı ═══");
  console.log("giriş".padEnd(32) + "   n" + "  medMFE" + "   ≥.15" + "   ≥.25" + "   ≥.35" + "   ≥.50" + "   ≥.75" + "  medMAE" + "  MAE≤-.25");
  for (const vName of FOCUS) {
    const v = variants.find((x) => x.name === vName)!;
    const mfes: number[] = [], maes: number[] = [];
    for (const d of days) {
      const ctx = ctxByDay.get(d)!;
      const idxByTime = new Map(ctx.m1.map((b, k) => [b.time, k]));
      for (const t of runSession(ctx, d, v, EXIT_PROD)) {
        const i = idxByTime.get(t.time);
        if (i == null) continue;
        let mfe = 0, mae = 0;
        for (let k = i + 1; k < Math.min(ctx.m1.length, i + 41); k++) {
          const fav = t.side === 1 ? ctx.m1[k].high - t.spot : t.spot - ctx.m1[k].low;
          const adv = t.side === 1 ? ctx.m1[k].low - t.spot : t.spot - ctx.m1[k].high;
          mfe = Math.max(mfe, fav); mae = Math.min(mae, adv);
        }
        mfes.push(mfe); maes.push(mae);
      }
    }
    const pct = (xs: number[], f: (x: number) => boolean) =>
      xs.length ? `${((xs.filter(f).length / xs.length) * 100).toFixed(0)}%` : "—";
    console.log(
      vName.padEnd(32), String(mfes.length).padStart(4),
      med(mfes).toFixed(3).padStart(8),
      pct(mfes, (x) => x >= 0.15).padStart(7),
      pct(mfes, (x) => x >= 0.25).padStart(7),
      pct(mfes, (x) => x >= 0.35).padStart(7),
      pct(mfes, (x) => x >= 0.50).padStart(7),
      pct(mfes, (x) => x >= 0.75).padStart(7),
      med(maes).toFixed(3).padStart(8),
      pct(maes, (x) => x <= -0.25).padStart(10),
    );
  }

  // ── Çıkış taraması ────────────────────────────────────────────────
  const exits: { name: string; cfg: ExitCfg }[] = [
    { name: "X0 ÜRETİM 2ters+tamOnay", cfg: EXIT_PROD },
    { name: "X1 2 ters mum (onaysız)", cfg: { ...EXIT_PROD, fullConfirm: false } },
    { name: "X2 1 ters mum", cfg: { ...EXIT_PROD, fullConfirm: false, reversal: 1 } },
    { name: "X3 TP.25 SL.25 +2ters", cfg: { ...EXIT_PROD, fullConfirm: false, tpPoints: 0.25, slPoints: 0.25 } },
    { name: "X4 TP.35 SL.30 +2ters", cfg: { ...EXIT_PROD, fullConfirm: false, tpPoints: 0.35, slPoints: 0.30 } },
    { name: "X5 TP.50 SL.35 +2ters", cfg: { ...EXIT_PROD, fullConfirm: false, tpPoints: 0.50, slPoints: 0.35 } },
    { name: "X6 TP.35 SL.30 +tamOnay", cfg: { ...EXIT_PROD, tpPoints: 0.35, slPoints: 0.30 } },
    { name: "X7 trail .25→.12", cfg: { ...EXIT_PROD, fullConfirm: false, trailAfter: 0.25, trailBy: 0.12 } },
    { name: "X8 trail .35→.18", cfg: { ...EXIT_PROD, fullConfirm: false, trailAfter: 0.35, trailBy: 0.18 } },
    { name: "X9 SL.30 trail .30→.15", cfg: { ...EXIT_PROD, fullConfirm: false, slPoints: 0.30, trailAfter: 0.30, trailBy: 0.15 } },
    { name: "XA 2ters + süre 15 mum", cfg: { ...EXIT_PROD, fullConfirm: false, maxBars: 15 } },
    { name: "XB TP.35 SL.30 süre15", cfg: { ...EXIT_PROD, fullConfirm: false, tpPoints: 0.35, slPoints: 0.30, maxBars: 15 } },
    { name: "XC TP.30 SL.25 süre20", cfg: { ...EXIT_PROD, fullConfirm: false, tpPoints: 0.30, slPoints: 0.25, maxBars: 20 } },
  ];

  for (const vName of FOCUS) {
    const v = variants.find((x) => x.name === vName)!;
    console.log("");
    console.log(`═══ ÇIKIŞ TARAMASI · giriş = ${vName} ═══`);
    console.log(HEAD);
    for (const ex of exits) {
      let all: Trade[] = [];
      for (const d of days) all = all.concat(runSession(ctxByDay.get(d)!, d, v, ex.cfg));
      report(ex.name, all, days.length);
    }
  }
  console.log("");
  console.log("Not: aynı mumda hem TP hem SL değerse SL varsayılıyor (kötümser).");

  // ── FAZ 3: "NO TRADE" rejimi ──────────────────────────────────────
  // Kullanıcının kendi tezi: "NO TRADE sinyali CALL/PUT kadar değerlidir."
  // Sistematik karşılığı Kaufman Verimlilik Oranı (ER): son N mumun NET
  // hareketi / aynı mumların TOPLAM mutlak hareketi. 1'e yakın = temiz trend,
  // 0'a yakın = testere. Yalnızca geçmiş mumları kullanır (nedensel).
  const erOf = (m1: Bar[], i: number, n = 20): number | null => {
    if (i - n < 0) return null;
    const net = Math.abs(m1[i].close - m1[i - n].close);
    let sum = 0;
    for (let k = i - n + 1; k <= i; k++) sum += Math.abs(m1[k].close - m1[k - 1].close);
    return sum > 0 ? net / sum : null;
  };

  const bestEntry = variants.find((x) => x.name === "G  TEK MUM + VWAP (en erken)")!;
  const bestExit: ExitCfg = { ...EXIT_PROD, fullConfirm: false, tpPoints: 0.35, slPoints: 0.30 };

  // Saat dilimi kırılımı — hangi saatlerde sinyal işe yarıyor
  console.log("");
  console.log("═══ SAAT DİLİMİ · giriş G · çıkış TP.35/SL.30 ═══");
  console.log("saat (ET)".padEnd(14) + "   n" + " isabet" + "   ortPuan" + "   toplamPuan" + "  ortMFE");
  {
    const byHour = new Map<number, Trade[]>();
    for (const d of days) {
      for (const t of runSession(ctxByDay.get(d)!, d, bestEntry, bestExit)) {
        const h = Math.floor(nyParts(t.time).minutes / 60);
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h)!.push(t);
      }
    }
    for (const h of [...byHour.keys()].sort((a, b) => a - b)) {
      const ts = byHour.get(h)!;
      const pts = ts.map((t) => t.pts);
      const wins = pts.filter((p) => p > 0).length;
      console.log(
        `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`.padEnd(14),
        String(ts.length).padStart(4),
        `${((wins / ts.length) * 100).toFixed(0)}%`.padStart(7),
        avg(pts).toFixed(3).padStart(10),
        pts.reduce((a, b) => a + b, 0).toFixed(2).padStart(13),
        avg(ts.map((t) => t.mfe)).toFixed(3).padStart(9),
      );
    }
  }

  // ER rejim kırılımı — testere saatlerini elemek işe yarıyor mu
  console.log("");
  console.log("═══ REJİM (ER20) · giriş G · çıkış TP.35/SL.30 ═══");
  console.log("ER aralığı".padEnd(14) + "   n" + " isabet" + "   ortPuan" + "   toplamPuan" + "  ortMFE" + "  ortMAE");
  {
    const buckets: { lo: number; hi: number; ts: Trade[] }[] = [
      { lo: 0, hi: 0.15, ts: [] }, { lo: 0.15, hi: 0.25, ts: [] },
      { lo: 0.25, hi: 0.40, ts: [] }, { lo: 0.40, hi: 0.60, ts: [] }, { lo: 0.60, hi: 1.01, ts: [] },
    ];
    for (const d of days) {
      const ctx = ctxByDay.get(d)!;
      const idxByTime = new Map(ctx.m1.map((b, k) => [b.time, k]));
      for (const t of runSession(ctx, d, bestEntry, bestExit)) {
        const i = idxByTime.get(t.time);
        if (i == null) continue;
        const er = erOf(ctx.m1, i, 20);
        if (er == null) continue;
        const b = buckets.find((x) => er >= x.lo && er < x.hi);
        b?.ts.push(t);
      }
    }
    for (const b of buckets) {
      if (!b.ts.length) { console.log(`${b.lo.toFixed(2)}–${b.hi.toFixed(2)}`.padEnd(14), "   0"); continue; }
      const pts = b.ts.map((t) => t.pts);
      const wins = pts.filter((p) => p > 0).length;
      console.log(
        `${b.lo.toFixed(2)}–${b.hi.toFixed(2)}`.padEnd(14),
        String(b.ts.length).padStart(4),
        `${((wins / b.ts.length) * 100).toFixed(0)}%`.padStart(7),
        avg(pts).toFixed(3).padStart(10),
        pts.reduce((a, b2) => a + b2, 0).toFixed(2).padStart(13),
        avg(b.ts.map((t) => t.mfe)).toFixed(3).padStart(9),
        avg(b.ts.map((t) => t.mae)).toFixed(3).padStart(8),
      );
    }
  }

  // Günlük dağılım — sonuç birkaç güne mi yaslanıyor
  console.log("");
  // ── FAZ 4: son eleme ──────────────────────────────────────────────
  // Faz 3'ün tek net bulgusu: 14:00 ET sonrası sinyalin getirisi sıfıra
  // düşüyor (monotonik azalış, tek bir kovaya yaslanmıyor). Burada bunu
  // ve "zirveden sonra bayatlama" çıkışını resmî olarak ölçüyoruz.
  console.log("");
  console.log("═══ FAZ 4 · giriş penceresi kesimi ═══");
  console.log(HEAD);
  {
    const cutoffs: { name: string; end: number }[] = [
      { name: "K0 pencere 15:40 (üretim)", end: 15 * 60 + 40 },
      { name: "K1 pencere 15:00", end: 15 * 60 },
      { name: "K2 pencere 14:00", end: 14 * 60 },
      { name: "K3 pencere 13:00", end: 13 * 60 },
    ];
    for (const c of cutoffs) {
      let all: Trade[] = [];
      for (const d of days) {
        all = all.concat(
          runSession(ctxByDay.get(d)!, d, bestEntry, bestExit).filter(
            (t) => nyParts(t.time).minutes < c.end,
          ),
        );
      }
      report(c.name, all, days.length);
    }
  }

  // "Bayatlama" çıkışı: K mum boyunca yeni lehte uç yapılmadıysa çık.
  // Sabit hedef değil — hareket durduğu an bırakır, trend uzarsa taşır.
  const scanStale = (ctx: Ctx, entryIdx: number, side: 1 | -1, eod: number, stale: number, sl: number | null) => {
    const entry = ctx.m1[entryIdx].close;
    let best = 0, lastNew = entryIdx;
    for (let i = entryIdx + 1; i < ctx.m1.length; i++) {
      const b = ctx.m1[i];
      if (b.time >= eod) return { idx: i, price: b.close, reason: "EOD" };
      const fav = side === 1 ? b.high - entry : entry - b.low;
      const adv = side === 1 ? b.low - entry : entry - b.high;
      if (sl != null && adv <= -sl) {
        return { idx: i, price: side === 1 ? entry - sl : entry + sl, reason: "SL" };
      }
      if (fav > best + 0.005) { best = fav; lastNew = i; }
      if (i - lastNew >= stale) return { idx: i, price: b.close, reason: "STALE" };
    }
    const last = ctx.m1[ctx.m1.length - 1];
    return { idx: ctx.m1.length - 1, price: last.close, reason: "SON" };
  };

  console.log("");
  console.log("═══ FAZ 4 · 'bayatlama' çıkışı (K mum yeni zirve yoksa çık) · giriş G · pencere 14:00 ═══");
  console.log(HEAD);
  for (const [stale, sl] of [[4, null], [6, null], [8, null], [6, 0.3], [8, 0.3], [10, 0.35]] as [number, number | null][]) {
    const all: Trade[] = [];
    for (const d of days) {
      const ctx = ctxByDay.get(d)!;
      const eod = nyDateTimeToEpoch(d, EOD_FORCE_MIN);
      const idxByTime = new Map(ctx.m1.map((b, k) => [b.time, k]));
      // Girişleri üretmek için çıkışı devre dışı bırakmadan yeniden oynatmak
      // yerine, aynı giriş listesini alıp kendi çıkışımızı uyguluyoruz.
      let blockedUntil = -Infinity;
      for (const t of runSession(ctx, d, bestEntry, { ...EXIT_PROD, fullConfirm: false, reversal: 1 })) {
        if (t.time < blockedUntil) continue;
        if (nyParts(t.time).minutes >= 14 * 60) continue;
        const i = idxByTime.get(t.time);
        if (i == null) continue;
        const ex = scanStale(ctx, i, t.side, eod, stale, sl);
        const entry = ctx.m1[i].close;
        let mfe = 0, mae = 0, mae3 = 0, peak = 0;
        for (let k = i + 1; k <= ex.idx; k++) {
          const fav = t.side === 1 ? ctx.m1[k].high - entry : entry - ctx.m1[k].low;
          const adv = t.side === 1 ? ctx.m1[k].low - entry : entry - ctx.m1[k].high;
          if (fav > mfe) { mfe = fav; peak = k - i; }
          mae = Math.min(mae, adv);
          if (k - i <= 3) mae3 = Math.min(mae3, adv);
        }
        all.push({
          ...t, exitTime: ctx.m1[ex.idx].time, exitSpot: ex.price, reason: ex.reason,
          pts: (ex.price - entry) * t.side, mfe, mae, mae3, bars: ex.idx - i, barsToPeak: peak,
        });
        blockedUntil = ctx.m1[ex.idx].time + 60;
      }
    }
    report(`Y bayat${stale}${sl ? ` SL${sl}` : ""}`, all, days.length);
  }

  console.log("═══ GÜNLÜK · giriş G · çıkış TP.35/SL.30 ═══");
  console.log("gün".padEnd(12) + "   n" + "  günPuan" + "   kümülatif");
  {
    let cum = 0;
    for (const d of days) {
      const ts = runSession(ctxByDay.get(d)!, d, bestEntry, bestExit);
      const sum = ts.reduce((a, t) => a + t.pts, 0);
      cum += sum;
      console.log(d.padEnd(12), String(ts.length).padStart(4), sum.toFixed(2).padStart(9), cum.toFixed(2).padStart(12));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
