/**
 * G12 giriş kapısı sabit tutularak ÇIKIŞ kurallarının karşılaştırması.
 *   · 5 seans: "MFE yakalama oranı" (zirvenin ne kadarını elde tuttuk) —
 *     prim gerektirmez, çok günde ölçülebilir.
 *   · 2026-08-31: gerçek 0DTE primiyle $ sonuç + gerçekçi spread maliyeti.
 */
import {
  normalizeBars, snapToInterval, dropBadPrints, barsOfSessionDay,
  nyParts, nyDateTimeToEpoch, rsi, sma,
  RTH_OPEN_MIN, ENTRY_START_MIN, ENTRY_END_MIN, type Bar,
} from "../lib/spyengine/core";
import { buildOptionSymbol, atmStrike } from "../lib/spyengine/strategy";

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json", Referer: "https://finance.yahoo.com/",
};
const SPAN: Record<string, number> = { "1m": 60, "5m": 300 };
/** Gerçekçi gidiş-dönüş işlem maliyeti (bid-ask), kontrat başına $ */
const ROUND_TRIP_COST = 2;

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

interface Ctx { m1: Bar[]; m5: Bar[]; r1: (number | null)[]; r5: (number | null)[]; vAvg: (number | null)[] }
const buildCtx = (m1: Bar[], m5: Bar[]): Ctx => ({
  m1, m5,
  r1: rsi(m1.map((b) => b.close), 14),
  r5: rsi(m5.map((b) => b.close), 14),
  vAvg: sma(m1.map((b) => b.volume || 0), 15),
});

/** G12 kapısı: 3 mum + hacim + 1m RSI yönü + 5m mum yönü + 5m RSI yönü */
function gateOk(ctx: Ctx, i: number, c5: number, side: 1 | -1): boolean {
  const b = ctx.m1[i];
  const va = ctx.vAvg[i - 1];
  if (va != null && va > 0 && (b.volume || 0) < va) return false;
  const r = ctx.r1[i], rp = ctx.r1[i - 1];
  if (r == null || rp == null || (side === 1 ? r <= rp : r >= rp)) return false;
  if (c5 < 1) return false;
  if (dirOf(ctx.m5[c5]) !== side) return false;
  const r5 = ctx.r5[c5], r5p = ctx.r5[c5 - 1];
  if (r5 == null || r5p == null || (side === 1 ? r5 < r5p : r5 > r5p)) return false;
  return true;
}

export interface ExitCfg {
  name: string;
  reversal: number;
  rsiConfirm: boolean;   // ters seriye ek olarak 1m RSI de dönmüş olmalı
  flip5m: boolean;       // 5m dönüşü TEK BAŞINA çıkış tetikler
  flip5mFast: boolean;   // 5m dönüşü varsa gereken ters mum sayısı 1 azalır
  trail: number | null;  // prim zirvesinden bu orana düşerse çık
  trailArm: number;      // trailing yalnızca prim bu kata ulaşınca devreye girer
  /** SPY vekili: MFE'nin bu oranı geri verilirse çık (çok günlü ölçüm için) */
  spyGiveback: number | null;
  /** SPY vekili: trailing yalnızca MFE bu $ seviyesini aşınca devreye girer */
  spyArm: number;
}

interface Res { entryIdx: number; exitIdx: number; reason: string }

function scanExit(ctx: Ctx, i0: number, side: 1 | -1, eod: number, ex: ExitCfg, prem: Bar[] | null): Res {
  let against = 0, c5 = -1, peak = 0, armed = false;
  let spyMfe = 0;
  const entrySpot = ctx.m1[i0].close;
  const entryPrem = prem ? prem.find((b) => b.time >= ctx.m1[i0].time)?.close ?? null : null;
  if (entryPrem != null) peak = entryPrem;

  for (let i = i0 + 1; i < ctx.m1.length; i++) {
    const b = ctx.m1[i];
    while (c5 + 1 < ctx.m5.length && ctx.m5[c5 + 1].time + 300 <= b.time + 60) c5++;
    if (b.time >= eod) return { entryIdx: i0, exitIdx: i, reason: "EOD" };

    // SPY vekil trailing (yalnızca prim yokken; prim varsa gerçek trailing kullanılır)
    if (ex.spyGiveback != null && !prem) {
      spyMfe = Math.max(spyMfe, side === 1 ? b.high - entrySpot : entrySpot - b.low);
      if (spyMfe >= ex.spyArm) {
        const level = spyMfe * (1 - ex.spyGiveback);
        const cur = side === 1 ? b.low - entrySpot : entrySpot - b.high;
        if (cur <= level) return { entryIdx: i0, exitIdx: i, reason: "TRAIL" };
      }
    }

    // Prim trailing — kârı koruyan tek mekanizma, SPY sinyallerinden önce bakılır
    if (ex.trail != null && prem && entryPrem != null) {
      const pb = prem.find((x) => x.time >= b.time);
      if (pb) {
        peak = Math.max(peak, pb.high);
        if (peak >= entryPrem * ex.trailArm) armed = true;
        if (armed && pb.low <= peak * ex.trail) return { entryIdx: i0, exitIdx: i, reason: "TRAIL" };
      }
    }

    const d = dirOf(b);
    if (d === -side) against++;
    else if (d === side) against = 0;

    // 5m mum yönü + 5m RSI yönü birlikte dönmüşse çıkış eşiği bir mum düşer:
    // üst zaman dilimi teyit ediyorsa tam kırılımı beklemeye gerek yok.
    let need = ex.reversal;
    if (ex.flip5mFast && c5 >= 1) {
      const r = ctx.r5[c5], rp = ctx.r5[c5 - 1];
      if (r != null && rp != null && dirOf(ctx.m5[c5]) === -side && (side === 1 ? r < rp : r > rp)) {
        need = Math.max(2, ex.reversal - 1);
      }
    }
    if (against >= need) {
      if (!ex.rsiConfirm) return { entryIdx: i0, exitIdx: i, reason: "REV" };
      const r = ctx.r1[i], rp = ctx.r1[i - 1];
      if (r != null && rp != null && (side === 1 ? r < rp : r > rp)) return { entryIdx: i0, exitIdx: i, reason: "REV" };
    }
    if (ex.flip5m && c5 >= 1) {
      const r = ctx.r5[c5], rp = ctx.r5[c5 - 1];
      if (r != null && rp != null && dirOf(ctx.m5[c5]) === -side && (side === 1 ? r < rp : r > rp)) {
        return { entryIdx: i0, exitIdx: i, reason: "M5FLIP" };
      }
    }
  }
  return { entryIdx: i0, exitIdx: ctx.m1.length - 1, reason: "SON" };
}

function runSession(m1: Bar[], m5: Bar[], date: string, ex: ExitCfg, premOf?: Map<number, Bar[]>) {
  const ctx = buildCtx(m1, m5);
  const eod = nyDateTimeToEpoch(date, RTH_OPEN_MIN) + (15 * 60 + 45 - RTH_OPEN_MIN) * 60;
  const out: { side: 1 | -1; i0: number; res: Res; mfe: number }[] = [];
  let sd = 0, sl = 0, c5 = -1, blocked = -Infinity;
  const recent: number[] = [];

  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    while (c5 + 1 < m5.length && m5[c5 + 1].time + 300 <= b.time + 60) c5++;
    const d = dirOf(b);
    if (d === 0) { sd = 0; sl = 0; continue; }
    if (d === sd) sl++; else { sd = d; sl = 1; }
    if (b.time < blocked || sl !== 3) continue;
    const p = nyParts(b.time);
    if (p.ymd !== date || p.minutes < ENTRY_START_MIN || p.minutes >= ENTRY_END_MIN) continue;
    const side = sd as 1 | -1;
    if (!gateOk(ctx, i, c5, side)) continue;
    while (recent.length && b.time - recent[0] > 3600) recent.shift();
    if (recent.length >= 3) continue;

    const res = scanExit(ctx, i, side, eod, ex, premOf?.get(b.time) ?? null);
    let mfe = 0;
    for (let k = i + 1; k <= res.exitIdx; k++) mfe = Math.max(mfe, side === 1 ? m1[k].high - b.close : b.close - m1[k].low);
    out.push({ side, i0: i, res, mfe });
    recent.push(b.time);
    const corr = m1.find((x) => x.time > m1[res.exitIdx].time && dirOf(x) === -side);
    blocked = corr ? corr.time : Infinity;
  }
  return { ctx, trades: out };
}

async function main() {
  const [m1All, m5All] = await Promise.all([chart("SPY", "1m", "5d"), chart("SPY", "5m", "5d")]);
  const days = [...new Set(m1All.map((b) => nyParts(b.time).ymd))].sort();
  const today = days[days.length - 1];

  const cfgs: ExitCfg[] = [
    { name: "E1  3 ters mum + 1m RSI",             reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: false, trail: null, trailArm: 1,    spyGiveback: null, spyArm: 0 },
    { name: "E6  E1 + 5m hızlandırıcı",            reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: true,  trail: null, trailArm: 1,    spyGiveback: null, spyArm: 0 },
    { name: "H1  E6 + trail arm 0.50$ geri %30",   reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: true,  trail: 0.70, trailArm: 1.60, spyGiveback: 0.30, spyArm: 0.50 },
    { name: "H2  E6 + trail arm 0.70$ geri %30",   reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: true,  trail: 0.70, trailArm: 1.80, spyGiveback: 0.30, spyArm: 0.70 },
    { name: "H3  E6 + trail arm 1.00$ geri %30",   reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: true,  trail: 0.70, trailArm: 2.20, spyGiveback: 0.30, spyArm: 1.00 },
    { name: "H4  E6 + trail arm 0.70$ geri %40",   reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: true,  trail: 0.60, trailArm: 1.80, spyGiveback: 0.40, spyArm: 0.70 },
    { name: "H5  E1 + trail arm 0.70$ geri %30",   reversal: 3, rsiConfirm: true, flip5m: false, flip5mFast: false, trail: 0.70, trailArm: 1.80, spyGiveback: 0.30, spyArm: 0.70 },
  ];



  console.log("=== 5 SEANS · MFE yakalama (prim gerekmez) ===");
  console.log("çıkış".padEnd(34), "işlem", " isabet", "  ort.$", " MFE%tut", " ortMum", " NET$SPY");
  for (const ex of cfgs) {
    let n = 0, wins = 0, sum = 0, cap = 0, bars = 0;
    for (const d of days) {
      const m1 = barsOfSessionDay(m1All, d);
      if (m1.length < 100) continue;
      const { ctx, trades } = runSession(m1, m5All, d, ex);
      for (const t of trades) {
        const pnl = (ctx.m1[t.res.exitIdx].close - ctx.m1[t.i0].close) * t.side;
        n++; sum += pnl; if (pnl > 0) wins++;
        if (t.mfe > 0 && pnl > 0) cap += pnl / t.mfe;
        bars += t.res.exitIdx - t.i0;
      }
    }
    const netEdge = sum - n * 0.04; // ~$2 spread ≈ $0.04 SPY (delta 0.5)
    console.log(ex.name.padEnd(34), String(n).padStart(4), `${((wins / n) * 100).toFixed(0)}%`.padStart(7),
      (sum / n).toFixed(3).padStart(8), `${((cap / n) * 100).toFixed(0)}%`.padStart(8), (bars / n).toFixed(0).padStart(7),
      netEdge.toFixed(2).padStart(9));
  }

  // ── $ ölçümü: bugünün gerçek primleriyle ──
  console.log(`\n=== ${today} · GERÇEK 0DTE PRİMİ (gidiş-dönüş maliyet $${ROUND_TRIP_COST}) ===`);
  const m1 = barsOfSessionDay(m1All, today);
  const base = runSession(m1, m5All, today, cfgs[0]);
  const premOf = new Map<number, Bar[]>();
  for (const t of base.trades) {
    const b = m1[t.i0];
    premOf.set(b.time, await chart(buildOptionSymbol("SPY", today, t.side === 1, atmStrike(b.close)), "1m", "5d"));
  }

  console.log("çıkış".padEnd(34), "işlem", " kazanan", "  brüt$", "   net$");
  let bestName = "", bestNet = -Infinity, bestDetail: string[] = [];
  for (const ex of cfgs) {
    const { ctx, trades } = runSession(m1, m5All, today, ex, premOf);
    let gross = 0, n = 0, wins = 0;
    const detail: string[] = [];
    for (const t of trades) {
      const prem = premOf.get(ctx.m1[t.i0].time);
      if (!prem?.length) continue;
      const e = prem.find((b) => b.time >= ctx.m1[t.i0].time)?.close;
      const x = prem.find((b) => b.time >= ctx.m1[t.res.exitIdx].time)?.close ?? prem[prem.length - 1].close;
      if (e == null) continue;
      const pnl = (x - e) * 100;
      gross += pnl; n++; if (pnl > 0) wins++;
      detail.push(`  ${hm(ctx.m1[t.i0].time)} ${t.side === 1 ? "LONG " : "SHORT"} giriş ${e.toFixed(2)} → ${hm(ctx.m1[t.res.exitIdx].time)} ${x.toFixed(2)} ${t.res.reason.padEnd(6)} ${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}$`);
    }
    const net = gross - n * ROUND_TRIP_COST;
    console.log(ex.name.padEnd(34), String(n).padStart(4), `${wins}/${n}`.padStart(8),
      `${gross >= 0 ? "+" : ""}${gross.toFixed(0)}`.padStart(8), `${net >= 0 ? "+" : ""}${net.toFixed(0)}`.padStart(7));
    if (net > bestNet) { bestNet = net; bestName = ex.name; bestDetail = detail; }
  }
  console.log(`\n--- en iyi: ${bestName} ---`);
  bestDetail.forEach((d) => console.log(d));
}

main().catch((e) => { console.error(e); process.exit(1); });
