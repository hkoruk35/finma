/**
 * Takip Sistemi motorları — sembol başına ayar ölçümü (lib/spyengine/engines.ts).
 *   npx jiti scripts/backtest_engines.ts [SEMBOL ...] ['{"anahtar":değer}' ek varyant]
 * Her sembol için: TRACK_CFG (SPY kuralları) · o sembolün ayarı · her farkı tek tek geri alınca.
 * Yahoo 5m 60 gün (ilk 15 gün ısınma); toplam R, kazanç oranı, üç dönem ve tek/çift günler. Seçim ölçütü: en kötü dönem, sonra toplam.
 */
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, nyDateTimeToEpoch, type Bar } from "../lib/spyengine/core";
import { chart } from "../lib/spyengine/openForecastFetch";
import { rvolBaseline } from "../lib/spyengine/ladder";
import { trackerRead, TRACK_CFG, type TrackCfg } from "../lib/spyengine/tracker";
import { ENGINES, ENGINE_SYMBOLS, isEngineSymbol } from "../lib/spyengine/engines";

const sum = (xs: number[]) => +xs.reduce((a, x) => a + x, 0).toFixed(1);

function evaluate(m5: Bar[], cfg: TrackCfg): string {
  const run = Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort().slice(15);
  const n3 = Math.ceil(run.length / 3);
  const blocks = [run.slice(0, n3), run.slice(n3, 2 * n3), run.slice(2 * n3)];
  const rs: number[] = []; const byDay = new Map<string, number>();
  for (const d of run) {
    const t = trackerRead({ date: d, m5, nowSec: nyDateTimeToEpoch(d, 16 * 60 + 5), rvol: rvolBaseline(m5, d), cfg }).trades;
    rs.push(...t.map((x) => x.resultR ?? 0));
    byDay.set(d, t.reduce((a, x) => a + (x.resultR ?? 0), 0));
  }
  const b = blocks.map((bl) => sum(bl.map((d) => byDay.get(d) ?? 0)));
  const odd = sum(run.filter((_, i) => i % 2).map((d) => byDay.get(d) ?? 0)), even = sum(run.filter((_, i) => !(i % 2)).map((d) => byDay.get(d) ?? 0));
  return `${run[0]}→${run[run.length - 1]} (${run.length}) n=${String(rs.length).padStart(3)} win=%${Math.round((100 * rs.filter((x) => x > 0).length) / Math.max(1, rs.length))} R=${sum(rs)} dönem ${b.join(" / ")} enKötü ${Math.min(...b)} tek/çift ${odd}/${even}`;
}

async function main() {
  const args = process.argv.slice(2);
  const extra = args.find((a) => a.startsWith("{"));
  const syms = args.filter((a) => !a.startsWith("{")).map((a) => a.toUpperCase()).filter(isEngineSymbol);
  for (const sym of syms.length ? syms : ENGINE_SYMBOLS) {
    const m5 = dropBadPrints(snapToInterval(normalizeBars(await chart(sym, "60d")), 300)).bars as Bar[];
    const own = ENGINES[sym].cfg;
    console.log(`── ${sym} (${ENGINES[sym].name}) · sürüm ${ENGINES[sym].version}`);
    console.log(`${"  SPY kuralları (TRACK_CFG)".padEnd(32)} ${evaluate(m5, TRACK_CFG)}`);
    console.log(`${`  ${sym} ayarı`.padEnd(32)} ${evaluate(m5, own)}`);
    const diff = (Object.keys(own) as (keyof TrackCfg)[]).filter((k) => JSON.stringify(own[k]) !== JSON.stringify(TRACK_CFG[k]) && k !== "optLabel" && k !== "strikeStep" && k !== "riskUsd");
    for (const k of diff) console.log(`${`    − ${k}`.padEnd(32)} ${evaluate(m5, { ...own, [k]: TRACK_CFG[k] } as TrackCfg)}`);
    if (extra) console.log(`${"    + ek varyant".padEnd(32)} ${evaluate(m5, { ...own, ...JSON.parse(extra) } as TrackCfg)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
