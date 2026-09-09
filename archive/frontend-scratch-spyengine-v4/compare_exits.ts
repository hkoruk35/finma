/**
 * V3 (sabit SL/TP + 45dk) ile V3.1 (sinyal tabanlı çıkış) modellerini
 * AYNI girişler ve AYNI gerçek 0DTE prim mumları üzerinde karşılaştırır.
 * Tek amacı teşhis — kalıcı kod değil.
 */
import {
  generateCandidates, findExitSignal, filterOverlapping,
  buildOptionSymbol, atmStrike,
  type EntryCandidate,
} from "../lib/spyengine/strategy";
import { normalizeBars, snapToInterval, dropBadPrints, barsOfSessionDay, nyParts, nyDateTimeToEpoch, RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar } from "../lib/spyengine/core";

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json", Referer: "https://finance.yahoo.com/",
};
const SPAN: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900 };

async function chart(symbol: string, interval: string, range: string): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true`;
  const res = await fetch(url, { headers: H });
  const raw = await res.json();
  const r = raw?.chart?.result?.[0];
  if (!r) return [];
  const ts: number[] = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open?.[i] == null || q.close?.[i] == null) continue;
    bars.push({ time: ts[i], open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] ?? 0 });
  }
  const s = SPAN[interval] ?? 0;
  const aligned = s ? snapToInterval(normalizeBars(bars), s) : normalizeBars(bars);
  return dropBadPrints(aligned).bars;
}

const hm = (t: number) => nyParts(t).hhmm;

// ── Eski model: sabit SL/TP + 45 dk ────────────────────────────────
const OLD: Record<"A" | "B", { stop: number; target: number }> = {
  A: { stop: 0.70, target: 1.60 },
  B: { stop: 0.60, target: 2.00 },
};

function runOld(c: EntryCandidate, prem: Bar[], eod: number) {
  const i0 = prem.findIndex((b) => b.time >= c.time);
  if (i0 < 0) return null;
  const entry = prem[i0].close;
  const rules = OLD[c.contractType];
  const stop = entry * rules.stop, target = entry * rules.target;
  const forceExit = c.time + 45 * 60;
  for (let i = i0; i < prem.length; i++) {
    const b = prem[i];
    if (b.time >= eod) return { entry, exit: b.open, pnl: (b.open - entry) * 100, reason: "EOD", time: b.time };
    if (b.time >= forceExit) return { entry, exit: b.open, pnl: (b.open - entry) * 100, reason: "SURE", time: b.time };
    if (b.low <= stop) return { entry, exit: stop, pnl: (stop - entry) * 100, reason: "STOP", time: b.time };
    if (b.high >= target) return { entry, exit: target, pnl: (target - entry) * 100, reason: "HEDEF", time: b.time };
  }
  const last = prem[prem.length - 1];
  return { entry, exit: last.close, pnl: (last.close - entry) * 100, reason: "ACIK", time: last.time };
}

async function main() {
  const date = process.argv[2];
  if (!date) throw new Error("kullanim: tsx compare_exits.ts YYYY-MM-DD");

  const [m1All, m5All, m15All] = await Promise.all([
    chart("SPY", "1m", "5d"), chart("SPY", "5m", "5d"), chart("SPY", "15m", "1mo"),
  ]);
  const m1 = barsOfSessionDay(m1All, date);
  if (!m1.length) throw new Error(`${date} icin 1m mum yok`);

  const session = {
    date, phase: "CLOSED" as const, isLive: false, note: null,
    rthOpen: nyDateTimeToEpoch(date, RTH_OPEN_MIN),
    rthClose: nyDateTimeToEpoch(date, RTH_CLOSE_MIN),
  };
  const evalNow = session.rthClose + 4 * 3600;
  const eod = session.rthOpen + (15 * 60 + 45 - RTH_OPEN_MIN) * 60;

  const gen = generateCandidates({ m1, m5: m5All, m15: m15All, session, nowSec: evalNow });
  console.log(`${date} — toplam aday: ${gen.candidates.length}`);

  // V3.1 kabul edilen pozisyonlar (sinyal cikisi + re-arm)
  const tracked = gen.candidates.slice(-40);
  const scans = tracked.map((c) =>
    findExitSignal({ m1, m5: m5All, entryTime: c.time, side: c.side, entrySpot: c.spot, session, nowSec: evalNow })
  );
  const fakePositions = tracked.map((c, i) => ({
    entryTime: c.time, side: c.side, contractType: c.contractType,
    exitTime: scans[i].signal?.time ?? null,
    strike: atmStrike(c.spot),
  })) as never[];
  const { accepted: acceptedNew } = filterOverlapping(tracked, fakePositions, m1);

  console.log(`V3.1 kabul edilen: ${acceptedNew.length}\n`);

  let oldTot = 0, newTot = 0, oldWins = 0, newWins = 0, n = 0, missing = 0;
  const rows: string[] = [];

  for (const c of acceptedNew) {
    const strike = atmStrike(c.spot);
    const sym = buildOptionSymbol("SPY", date, c.side === "LONG", strike);
    const prem = await chart(sym, "1m", "5d");
    if (!prem.length) { missing++; continue; }

    const scan = findExitSignal({ m1, m5: m5All, entryTime: c.time, side: c.side, entrySpot: c.spot, session, nowSec: evalNow });
    const i0 = prem.findIndex((b) => b.time >= c.time);
    if (i0 < 0) { missing++; continue; }
    const entry = prem[i0].close;

    let newExit = prem[prem.length - 1].close, newReason = "ACIK", newTime = prem[prem.length - 1].time;
    if (scan.signal) {
      const ei = prem.findIndex((b) => b.time >= scan.signal!.time);
      if (ei >= 0) { newExit = prem[ei].close; newTime = prem[ei].time; }
      newReason = scan.signal.reason.replace("_EXIT", "");
    }
    const newPnl = (newExit - entry) * 100;
    const old = runOld(c, prem, eod);
    if (!old) { missing++; continue; }

    n++; oldTot += old.pnl; newTot += newPnl;
    if (old.pnl > 0) oldWins++;
    if (newPnl > 0) newWins++;

    // Pozisyon boyunca prim zirvesi — eski TP'nin neyi yakaladigini gormek icin
    const ei = prem.findIndex((b) => b.time >= (scan.signal?.time ?? Infinity));
    const slice = prem.slice(i0, ei >= 0 ? ei + 1 : undefined);
    const peak = Math.max(...slice.map((b) => b.high));
    const peakPct = ((peak - entry) / entry) * 100;

    rows.push(
      `${hm(c.time)} ${c.side.padEnd(5)} ${c.contractType} | giris ${entry.toFixed(2)} zirve +%${peakPct.toFixed(0).padStart(3)} | ` +
      `ESKI ${old.reason.padEnd(5)} ${hm(old.time)} ${old.pnl >= 0 ? "+" : ""}${old.pnl.toFixed(0).padStart(4)}$ | ` +
      `YENI ${newReason.padEnd(12)} ${hm(newTime)} ${newPnl >= 0 ? "+" : ""}${newPnl.toFixed(0).padStart(4)}$`
    );
  }

  rows.forEach((r) => console.log("  " + r));
  console.log(`\n  islem: ${n}   (prim verisi olmayan: ${missing})`);
  console.log(`  ESKI (SL/TP+45dk): ${oldTot >= 0 ? "+" : ""}$${oldTot.toFixed(0)}  ·  kazanan ${oldWins}/${n}`);
  console.log(`  YENI (sinyal)    : ${newTot >= 0 ? "+" : ""}$${newTot.toFixed(0)}  ·  kazanan ${newWins}/${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
