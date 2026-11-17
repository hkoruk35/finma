/** v3.11 (kapanmış 15m) vs v3.13 (canlı 15m) — 60 gün, motor başına. npx jiti scripts/cmp_live15.ts SPY QQQ ... */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, nyDateTimeToEpoch, type Bar } from "../lib/spyengine/core";
import { chart } from "../lib/spyengine/openForecastFetch";
import { rvolBaseline } from "../lib/spyengine/ladder";
import { trackerRead, type TrackCfg } from "../lib/spyengine/tracker";
import { ENGINES } from "../lib/spyengine/engines";

async function load(sym: string): Promise<Bar[]> {
  const f = `${process.env.CACHE_DIR}/m5_${sym}.json`;
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  const raw = await chart(sym, "60d");
  const m5 = dropBadPrints(snapToInterval(normalizeBars(raw), 300)).bars;
  writeFileSync(f, JSON.stringify(m5));
  return m5;
}

function run(m5: Bar[], cfg: TrackCfg, dates: string[]) {
  let fast = 0; let R = 0, n = 0, win = 0, peak = 0, dd = 0, lagSum = 0, chaseSum = 0, chaseN = 0;
  const half = Math.floor(dates.length / 2); let R1 = 0;
  const perDay: Record<string, number> = {};
  for (const [di, date] of dates.entries()) {
    const r = trackerRead({ date, m5, nowSec: nyDateTimeToEpoch(date, 16 * 60 + 5), rvol: rvolBaseline(m5, date), cfg });
    const steps = r.steps.filter((s) => !s.pre);
    for (const t of r.trades) {
      if (t.resultR == null) continue;
      n++; R += t.resultR; if (t.resultR > 0) win++; if (di < half) R1 += t.resultR;
      peak = Math.max(peak, R); dd = Math.min(dd, R - peak);
      const d = t.side === "CALL" ? 1 : -1;
      // giriş gecikmesi: girişten geriye 5m VWAP+EMA20 aynı taraf olan ardışık mum sayısı (hizanın başladığı mumdan girişe)
      const k = steps.findIndex((s) => s.t + 300 === t.entryTime || s.t === t.entryTime);
      let j = k; while (j > 0 && steps[j - 1].side5 === d) j--;
      if (k >= 0) {
        lagSum += (k - j) * 5; if ((k - j) * 5 <= 10) fast++;
        const a = steps[k].atr5; if (a) { chaseSum += (d * (t.entry - steps[j].price)) / a; chaseN++; }
      }
    }
    perDay[date] = r.realizedR;
  }
  return { n, R: +R.toFixed(2), win: n ? Math.round((win / n) * 100) : 0, dd: +dd.toFixed(2), lag: n ? +(lagSum / n).toFixed(1) : 0, chase: chaseN ? +(chaseSum / chaseN).toFixed(2) : 0, R1: +R1.toFixed(2), R2: +(R - R1).toFixed(2), fast: n ? Math.round((fast / n) * 100) : 0 };
}

(async () => {
  const syms = process.argv.slice(2).length ? process.argv.slice(2) : ["SPY", "QQQ", "IWM"];
  console.log("sym      variant        n    R      win  maxDD  yarılar        gecikme(dk)  kovalama(ATR5)");
  for (const sym of syms) {
    const m5 = await load(sym);
    const dates = Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort().slice(15, -1);
    const base = (ENGINES as Record<string, { cfg: TrackCfg }>)[sym].cfg;
    for (const [name, cfg] of [["v3.11", { ...base, live15: false, live15Exit: false }], ["v3.13 yayın", base]] as const) {
      const x = run(m5, cfg as TrackCfg, dates);
      console.log(`${sym.padEnd(8)} ${name.padEnd(14)} ${String(x.n).padStart(3)} ${String(x.R).padStart(6)}  %${String(x.win).padStart(2)}  ${String(x.dd).padStart(6)}  ${String(x.R1).padStart(6)}/${String(x.R2).padEnd(6)}  ${String(x.lag).padStart(6)}       ${x.chase}   ≤10dk %${x.fast}`);
    }
    console.log(`         (${dates.length} seans: ${dates[0]} → ${dates[dates.length - 1]})`);
  }
})();
