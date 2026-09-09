/**
 * Giriş kapısı + çıkış kuralı taraması.
 *
 * İki ayrı ölçüm — bilinçli olarak ayrı, çünkü elimizdeki veri farklı:
 *   1) GİRİŞ KALİTESİ: 5 seans boyunca SPY spot ileri getirisi. Yahoo 1m
 *      geçmişi ~5 gün tuttuğu için giriş filtresini çok günde ölçebiliyoruz.
 *      Tek günde tune etmek curve-fitting olurdu.
 *   2) $ SONUÇ: gerçek 0DTE primleriyle. DÜZELTME (2026-09-02): "Yahoo
 *      süresi dolmuş 0DTE primini siliyor" iddiası YANLIŞTI — v8/chart,
 *      OCC sembolüyle ve range=5d (ya da 8 günlük 1m sınırının içinde
 *      period1/period2) istendiğinde vade sonrası da prim veriyor.
 *      bkz. lib/spyengine/market.ts → fetchOptionSeries.
 */
import {
  normalizeBars, snapToInterval, dropBadPrints, barsOfSessionDay,
  nyParts, nyDateTimeToEpoch, rsi, sma,
  RTH_OPEN_MIN, RTH_CLOSE_MIN, ENTRY_START_MIN, ENTRY_END_MIN, type Bar,
} from "../lib/spyengine/core";

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json", Referer: "https://finance.yahoo.com/",
};
const SPAN: Record<string, number> = { "1m": 60, "5m": 300 };

async function chart(symbol: string, interval: string, range: string): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true`;
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
  const s = SPAN[interval] ?? 0;
  return dropBadPrints(s ? snapToInterval(normalizeBars(out), s) : normalizeBars(out)).bars;
}

const hm = (t: number) => nyParts(t).hhmm;
const dirOf = (b: Bar) => (b.close > b.open ? 1 : b.close < b.open ? -1 : 0);

/** off = kapalı · dir = yalnızca yön (RSI artıyor/azalıyor) · level = yön + 50 çizgisi */
export type RsiMode = "off" | "dir" | "level";

export interface Gate {
  name: string;
  streak: number;          // kaç ardışık aynı yönlü 1m mum
  volume: boolean;         // hacim > son 15 mum ortalaması (ZORUNLU)
  rsi1m: RsiMode;          // 1m RSI kontrolü
  candle5m: boolean;       // son kapalı 5m mum yönü uyumlu
  rsi5m: RsiMode;          // 5m RSI kontrolü
  perHour: number | null;  // saatte azami giriş
}

interface Ctx { m1: Bar[]; m5: Bar[]; r1: (number | null)[]; r5: (number | null)[]; vAvg: (number | null)[] }

function buildCtx(m1: Bar[], m5: Bar[]): Ctx {
  return {
    m1, m5,
    r1: rsi(m1.map((b) => b.close), 14),
    r5: rsi(m5.map((b) => b.close), 14),
    vAvg: sma(m1.map((b) => b.volume || 0), 15),
  };
}

/** Bir 1m mumunda giriş şartları sağlanıyor mu */
function entryOk(ctx: Ctx, i: number, m5Cursor: number, side: 1 | -1, g: Gate): boolean {
  const b = ctx.m1[i];

  if (g.volume) {
    const va = ctx.vAvg[i - 1]; // önceki muma kadarki ortalama — sızıntı yok
    if (va != null && va > 0 && (b.volume || 0) < va) return false;
  }
  if (g.rsi1m !== "off") {
    const r = ctx.r1[i], rp = ctx.r1[i - 1];
    if (r == null || rp == null) return false;
    const rising = side === 1 ? r > rp : r < rp;
    if (!rising) return false;
    if (g.rsi1m === "level" && (side === 1 ? r <= 50 : r >= 50)) return false;
  }
  if (g.candle5m) {
    if (m5Cursor < 0) return false;
    if (dirOf(ctx.m5[m5Cursor]) !== side) return false;
  }
  if (g.rsi5m !== "off") {
    if (m5Cursor < 1) return false;
    const r = ctx.r5[m5Cursor], rp = ctx.r5[m5Cursor - 1];
    if (r == null || rp == null) return false;
    const rising = side === 1 ? r >= rp : r <= rp;
    if (!rising) return false;
    if (g.rsi5m === "level" && (side === 1 ? r <= 50 : r >= 50)) return false;
  }
  return true;
}

export interface Trade { time: number; side: 1 | -1; spot: number; exitTime: number; exitSpot: number; reason: string; mfe: number; mae: number; bars: number }

export interface ExitCfg {
  reversal: number;        // ardışık ters 1m mum
  needRsiConfirm: boolean; // ters seriye ek olarak 1m RSI de dönmüş olmalı
  flip5m: boolean;         // 5m mum + 5m RSI birlikte dönerse çık
}

function scanExit(ctx: Ctx, entryIdx: number, side: 1 | -1, eod: number, ex: ExitCfg) {
  let against = 0, m5Cursor = -1;
  for (let i = entryIdx + 1; i < ctx.m1.length; i++) {
    const b = ctx.m1[i];
    while (m5Cursor + 1 < ctx.m5.length && ctx.m5[m5Cursor + 1].time + 300 <= b.time + 60) m5Cursor++;
    if (b.time >= eod) return { idx: i, reason: "EOD" };

    const d = dirOf(b);
    if (d === -side) against++;
    else if (d === side) against = 0;

    if (against >= ex.reversal) {
      if (!ex.needRsiConfirm) return { idx: i, reason: "REV" };
      const r = ctx.r1[i], rp = ctx.r1[i - 1];
      if (r != null && rp != null && (side === 1 ? r < rp : r > rp)) return { idx: i, reason: "REV" };
    }
    if (ex.flip5m && m5Cursor >= 1) {
      const r = ctx.r5[m5Cursor], rp = ctx.r5[m5Cursor - 1];
      const cd = dirOf(ctx.m5[m5Cursor]);
      if (r != null && rp != null && cd === -side && (side === 1 ? r < rp && r < 50 : r > rp && r > 50)) {
        return { idx: i, reason: "M5FLIP" };
      }
    }
  }
  return { idx: ctx.m1.length - 1, reason: "SON" };
}

/** Bir seansı baştan sona oynatır: giriş kapısı + tek pozisyon + saatlik kota */
export function runSession(m1: Bar[], m5: Bar[], date: string, g: Gate, ex: ExitCfg): Trade[] {
  const ctx = buildCtx(m1, m5);
  const rthOpen = nyDateTimeToEpoch(date, RTH_OPEN_MIN);
  const eod = rthOpen + (15 * 60 + 45 - RTH_OPEN_MIN) * 60;

  const trades: Trade[] = [];
  let streakDir = 0, streakLen = 0, m5Cursor = -1;
  let blockedUntil = -Infinity;
  const recent: number[] = []; // son 1 saatteki giriş zamanları

  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= b.time + 60) m5Cursor++;

    const d = dirOf(b);
    if (d === 0) { streakDir = 0; streakLen = 0; continue; }
    if (d === streakDir) streakLen++;
    else { streakDir = d; streakLen = 1; }

    if (b.time < blockedUntil) continue;
    if (streakLen !== g.streak) continue;

    const p = nyParts(b.time);
    if (p.ymd !== date || p.minutes < ENTRY_START_MIN || p.minutes >= ENTRY_END_MIN) continue;

    const side = streakDir as 1 | -1;
    if (!entryOk(ctx, i, m5Cursor, side, g)) continue;

    if (g.perHour != null) {
      while (recent.length && b.time - recent[0] > 3600) recent.shift();
      if (recent.length >= g.perHour) continue;
    }

    const exit = scanExit(ctx, i, side, eod, ex);
    let mfe = 0, mae = 0;
    for (let k = i + 1; k <= exit.idx; k++) {
      mfe = Math.max(mfe, (side === 1 ? m1[k].high - b.close : b.close - m1[k].low));
      mae = Math.min(mae, (side === 1 ? m1[k].low - b.close : b.close - m1[k].high));
    }
    trades.push({
      time: b.time, side, spot: b.close,
      exitTime: m1[exit.idx].time, exitSpot: m1[exit.idx].close, reason: exit.reason,
      mfe, mae, bars: exit.idx - i,
    });
    recent.push(b.time);

    // Tek pozisyon + düzeltme mumu bekle
    const corr = m1.find((x) => x.time > m1[exit.idx].time && dirOf(x) === -side);
    blockedUntil = corr ? corr.time : Infinity;
  }
  return trades;
}

// ── Ana ───────────────────────────────────────────────────────────

async function main() {
  const [m1All, m5All] = await Promise.all([chart("SPY", "1m", "5d"), chart("SPY", "5m", "5d")]);
  const days = [...new Set(m1All.map((b) => nyParts(b.time).ymd))].sort();
  console.log("seanslar:", days.join(" "), "\n");

  const gates: Gate[] = [
    { name: "G0  mevcut üretim (kapı yok, 2 mum)", streak: 2, volume: false, rsi1m: "off",   candle5m: false, rsi5m: "off",   perHour: null },
    { name: "G8  3mum+hacim+5mMum",                streak: 3, volume: true,  rsi1m: "off",   candle5m: true,  rsi5m: "off",   perHour: 3 },
    { name: "G12 G8 + RSI YÖNÜ (1m+5m)",           streak: 3, volume: true,  rsi1m: "dir",   candle5m: true,  rsi5m: "dir",   perHour: 3 },
    { name: "G13 G8 + 5m RSI yönü",                streak: 3, volume: true,  rsi1m: "off",   candle5m: true,  rsi5m: "dir",   perHour: 3 },
    { name: "G14 G8 + 1m RSI yönü",                streak: 3, volume: true,  rsi1m: "dir",   candle5m: true,  rsi5m: "off",   perHour: 3 },
    { name: "G15 RSI SEVİYE (50 çizgisi) 1m+5m",   streak: 3, volume: true,  rsi1m: "level", candle5m: true,  rsi5m: "level", perHour: 3 },
    { name: "G16 G12 + saatte 2 kota",             streak: 3, volume: true,  rsi1m: "dir",   candle5m: true,  rsi5m: "dir",   perHour: 2 },
    { name: "G17 G12 + 2 mum seri",                streak: 2, volume: true,  rsi1m: "dir",   candle5m: true,  rsi5m: "dir",   perHour: 3 },
    { name: "G18 G12 + 4 mum seri",                streak: 4, volume: true,  rsi1m: "dir",   candle5m: true,  rsi5m: "dir",   perHour: 3 },
  ];

  const ex: ExitCfg = { reversal: 3, needRsiConfirm: false, flip5m: false };

  console.log("=== GİRİŞ KAPISI · 5 seans · SPY spot yön isabeti ===");
  console.log("kapı".padEnd(34), "işlem", "  saat/iş", " isabet", "  ort.$", "  ortMFE", " ortMAE", " ortMum");
  for (const g of gates) {
    let all: Trade[] = [];
    for (const d of days) {
      const m1 = barsOfSessionDay(m1All, d);
      if (m1.length < 100) continue;
      all = all.concat(runSession(m1, m5All, d, g, ex));
    }
    if (!all.length) { console.log(g.name.padEnd(34), "0"); continue; }
    const pts = all.map((t) => (t.exitSpot - t.spot) * t.side);
    const wins = pts.filter((p) => p > 0).length;
    const tot = pts.reduce((a, b) => a + b, 0);
    const perHour = all.length / (days.length * 6.1);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(
      g.name.padEnd(34),
      String(all.length).padStart(4),
      perHour.toFixed(1).padStart(9),
      `${((wins / all.length) * 100).toFixed(0)}%`.padStart(7),
      (tot / all.length).toFixed(3).padStart(8),
      avg(all.map((t) => t.mfe)).toFixed(3).padStart(8),
      avg(all.map((t) => t.mae)).toFixed(3).padStart(8),
      avg(all.map((t) => t.bars)).toFixed(0).padStart(7)
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
