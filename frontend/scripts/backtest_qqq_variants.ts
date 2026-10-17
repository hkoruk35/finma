/**
 * QQQ Takip Sistemi varyant ölçümü — SPY kurallarını (TRACK_CFG) değiştirmeden QQQ'ya özel ayar adayları.
 *   npx jiti scripts/backtest_qqq_variants.ts
 * SPY ve QQQ 5m (Yahoo 60d) çekilir; her varyant 45 seansta toplam R, kazanç oranı ve 3 dönemle raporlanır.
 * SPY referans 15m yönü = SPY trackerRead adımlarının side15'i (aynı 5m mum zamanında, yalnız kapanmış mumlar).
 */
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, nyDateTimeToEpoch, type Bar } from "../lib/spyengine/core";
import { chart } from "../lib/spyengine/openForecastFetch";
import { rvolBaseline } from "../lib/spyengine/ladder";
import { trackerRead, TRACK_CFG, type TrackCfg, type D } from "../lib/spyengine/tracker";

const load = async (sym: string) => dropBadPrints(snapToInterval(normalizeBars(await chart(sym, "60d")), 300)).bars as Bar[];

async function main() {
  const [spy, qqq] = await Promise.all([load("SPY"), load("QQQ")]);
  const datesOf = (m5: Bar[]) => Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
  const sd = datesOf(spy), qd = datesOf(qqq);
  const all = qd.filter((d) => sd.includes(d));
  const run = all.slice(Math.min(15, all.length - 1));
  const n3 = Math.ceil(run.length / 3);
  const blocks = [run.slice(0, n3), run.slice(n3, 2 * n3), run.slice(2 * n3)];
  console.log(`seans ${run[0]} → ${run[run.length - 1]} (${run.length}) · dönemler ${blocks.map((b) => `${b[0]}…${b[b.length - 1]} (${b.length})`).join(" | ")}`);

  const rvS = new Map(run.map((d) => [d, rvolBaseline(spy, d)]));
  const rvQ = new Map(run.map((d) => [d, rvolBaseline(qqq, d)]));
  const nowOf = (d: string) => nyDateTimeToEpoch(d, 16 * 60 + 5);

  // SPY referans yönü + SPY taban sonucu
  const spyRef = new Map<string, Map<number, D>>();
  const spyTrades: number[] = []; const spyByDay = new Map<string, number>(); let spyN = 0, spyW = 0;
  for (const d of run) {
    const r = trackerRead({ date: d, m5: spy, nowSec: nowOf(d), rvol: rvS.get(d) });
    spyRef.set(d, new Map(r.steps.filter((s) => !s.pre).map((s) => [s.t, s.side15])));
    for (const t of r.trades) { spyN++; if ((t.resultR ?? 0) > 0) spyW++; spyTrades.push(t.resultR ?? 0); }
    spyByDay.set(d, r.trades.reduce((a, t) => a + (t.resultR ?? 0), 0));
  }
  const sum = (xs: number[]) => +xs.reduce((a, x) => a + x, 0).toFixed(1);
  const blk = (byDay: Map<string, number>) => blocks.map((b) => sum(b.map((d) => byDay.get(d) ?? 0)));
  console.log(`SPY taban (TRACK_CFG): ${spyN} işlem · %${Math.round((100 * spyW) / spyN)} · ${sum(spyTrades)}R · dönemler ${blk(spyByDay).join(" / ")}`);

  type V = { name: string; cfg: Partial<TrackCfg>; ref?: boolean };
  const vs: V[] = [
    { name: "taban (SPY kuralları)", cfg: {} },
    { name: "SPY 15m aynı yön", cfg: { refAlign15: "same" }, ref: true },
    { name: "SPY 15m ters değil", cfg: { refAlign15: "notAgainst" }, ref: true },
    ...[0, 60, 65, 75, 80].map((x) => ({ name: `kapanış konumu ${x}`, cfg: { entryClosePos: x } })),
    ...[0, 0.05, 0.15, 0.2, 0.3].map((x) => ({ name: `net15Atr ${x}`, cfg: { net15Atr: x } })),
    ...[0, 2, 3, 6, 8].map((x) => ({ name: `freshBreakBars ${x}`, cfg: { freshBreakBars: x } })),
    ...[60, 80].map((x) => ({ name: `SPY aynı + kapanış ${x}`, cfg: { refAlign15: "same" as const, entryClosePos: x }, ref: true })),
    ...[0.2, 0.3].map((x) => ({ name: `SPY aynı + net15Atr ${x}`, cfg: { refAlign15: "same" as const, net15Atr: x }, ref: true })),
    ...[0, 3, 6].map((x) => ({ name: `SPY aynı + freshBreak ${x}`, cfg: { refAlign15: "same" as const, freshBreakBars: x }, ref: true })),
    { name: "SPY aynı + kapanış 75", cfg: { refAlign15: "same", entryClosePos: 75 }, ref: true },
  ];

  for (const v of vs) {
    const cfg = { ...TRACK_CFG, ...v.cfg } as TrackCfg;
    const rs: number[] = []; const byDay = new Map<string, number>();
    for (const d of run) {
      const r = trackerRead({ date: d, m5: qqq, nowSec: nowOf(d), rvol: rvQ.get(d), cfg, refSide15: v.ref ? spyRef.get(d) : null });
      for (const t of r.trades) rs.push(t.resultR ?? 0);
      byDay.set(d, r.trades.reduce((a, t) => a + (t.resultR ?? 0), 0));
    }
    const b = blk(byDay);
    const line = `${v.name.padEnd(26)} n=${String(rs.length).padStart(3)} win=%${Math.round((100 * rs.filter((x) => x > 0).length) / Math.max(1, rs.length))} R=${sum(rs)} dönem ${b.join(" / ")} enKötü ${Math.min(...b)}`;
    console.log(line);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
