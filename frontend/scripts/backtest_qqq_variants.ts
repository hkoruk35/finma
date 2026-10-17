/**
 * QQQ Takip Sistemi ayar ölçümü — SPY kurallarını (TRACK_CFG) değiştirmeden QQQ_TRACK_CFG ve tek tek etkileri.
 *   npx jiti scripts/backtest_qqq_variants.ts ['{"anahtar":değer}' ek varyant]
 * Yahoo 5m 60 gün (ilk 15 gün ısınma); her varyant toplam R, kazanç oranı, 3 dönem ve tek/çift günlerle raporlanır.
 * Seçim ölçütü: en kötü dönem (rejime dayanıklılık), sonra toplam.
 */
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, nyDateTimeToEpoch, type Bar } from "../lib/spyengine/core";
import { chart } from "../lib/spyengine/openForecastFetch";
import { rvolBaseline } from "../lib/spyengine/ladder";
import { trackerRead, TRACK_CFG, type TrackCfg } from "../lib/spyengine/tracker";
import { QQQ_TRACK_CFG } from "../lib/qqqengine/config";

const load = async (sym: string) => dropBadPrints(snapToInterval(normalizeBars(await chart(sym, "60d")), 300)).bars as Bar[];

async function main() {
  const [spy, qqq] = await Promise.all([load("SPY"), load("QQQ")]);
  const datesOf = (m5: Bar[]) => Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort().slice(15);
  const nowOf = (d: string) => nyDateTimeToEpoch(d, 16 * 60 + 5);
  const sum = (xs: number[]) => +xs.reduce((a, x) => a + x, 0).toFixed(1);

  const evalSym = (m5: Bar[], cfg: TrackCfg) => {
    const run = datesOf(m5);
    const n3 = Math.ceil(run.length / 3);
    const blocks = [run.slice(0, n3), run.slice(n3, 2 * n3), run.slice(2 * n3)];
    const rs: number[] = []; const byDay = new Map<string, number>();
    for (const d of run) {
      const t = trackerRead({ date: d, m5, nowSec: nowOf(d), rvol: rvolBaseline(m5, d), cfg }).trades;
      rs.push(...t.map((x) => x.resultR ?? 0));
      byDay.set(d, t.reduce((a, x) => a + (x.resultR ?? 0), 0));
    }
    const b = blocks.map((bl) => sum(bl.map((d) => byDay.get(d) ?? 0)));
    const odd = sum(run.filter((_, i) => i % 2).map((d) => byDay.get(d) ?? 0)), even = sum(run.filter((_, i) => !(i % 2)).map((d) => byDay.get(d) ?? 0));
    return { run, blocks, line: `n=${String(rs.length).padStart(3)} win=%${Math.round((100 * rs.filter((x) => x > 0).length) / Math.max(1, rs.length))} R=${sum(rs)} dönem ${b.join(" / ")} enKötü ${Math.min(...b)} tek/çift ${odd}/${even} son gün ${sum([byDay.get(run[run.length - 1]) ?? 0])}` };
  };

  const s = evalSym(spy, TRACK_CFG);
  console.log(`SPY (TRACK_CFG) ${s.run[0]} → ${s.run[s.run.length - 1]} (${s.run.length}): ${s.line}`);
  const q0 = evalSym(qqq, TRACK_CFG);
  console.log(`QQQ ${q0.run[0]} → ${q0.run[q0.run.length - 1]} (${q0.run.length}) · dönemler ${q0.blocks.map((b) => `${b[0]}…${b[b.length - 1]}`).join(" | ")}`);
  console.log(`${"SPY kuralları".padEnd(30)} ${q0.line}`);
  console.log(`${"QQQ_TRACK_CFG".padEnd(30)} ${evalSym(qqq, QQQ_TRACK_CFG).line}`);
  // her farkı tek başına geri al (katkısı)
  const diff = (Object.keys(QQQ_TRACK_CFG) as (keyof TrackCfg)[]).filter((k) => JSON.stringify(QQQ_TRACK_CFG[k]) !== JSON.stringify(TRACK_CFG[k]));
  for (const k of diff) console.log(`${`  − ${k}`.padEnd(30)} ${evalSym(qqq, { ...QQQ_TRACK_CFG, [k]: TRACK_CFG[k] } as TrackCfg).line}`);
  if (process.argv[2]) console.log(`${"  + ek varyant".padEnd(30)} ${evalSym(qqq, { ...QQQ_TRACK_CFG, ...JSON.parse(process.argv[2]) } as TrackCfg).line}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
