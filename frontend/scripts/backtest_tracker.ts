/**
 * Takip Sistemi geriye dönük testi (spec §13.4) — canlı motorla BİREBİR aynı fonksiyon (lib/spyengine/tracker.ts · trackerRead).
 *
 *   npx jiti scripts/backtest_tracker.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out results/] [--day YYYY-MM-DD]
 *
 * Girdi: Yahoo SPY 5m (60 gün, premarket dahil). 1m geçmişi 7 günle sınırlı olduğundan 5m kullanılır;
 * 15m/30m/1h/4h 5m'den türetilir. Opsiyon akışı tarihsel yok → "flow=off" (opt_cp = 0); alıcı/satıcı payı
 * 5m mum kapanış konumundan (canlıyla aynı). Geleceğe bakış yok: her gün `nowSec` = 16:05 ile oynatılır ve motor
 * yalnız kapanmış mumları, her kararda yalnız o ana kadarki mumları kullanır.
 * Çıktı: summary_by_tag.csv · funnel.csv · by_context.csv · daily.csv · alerts_eval.csv · predictions.csv
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeBars, snapToInterval, dropBadPrints, isRthBar, nyParts, nyDateTimeToEpoch, type Bar } from "../lib/spyengine/core";
import { chart } from "../lib/spyengine/openForecastFetch";
import { rvolBaseline } from "../lib/spyengine/ladder";
import { trackerRead, summarizeTrades, type TrackRead, type TrackTrade } from "../lib/spyengine/tracker";

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const raw = await chart("SPY", "60d");
  const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(raw), 300)).bars;
  const dates = Array.from(new Set(m5.filter(isRthBar).map((b) => nyParts(b.time).ymd))).sort();
  const from = arg("from") ?? dates[Math.min(15, dates.length - 1)];
  const to = arg("to") ?? dates[dates.length - 1];
  const out = arg("out") ?? "results";
  const one = arg("day");
  const run = dates.filter((d) => d >= from && d <= to && (!one || d === one));
  const reads: TrackRead[] = [];
  for (const date of run) {
    const nowSec = nyDateTimeToEpoch(date, 16 * 60 + 5);
    const r = trackerRead({ date, m5, nowSec, rvol: rvolBaseline(m5, date) });
    reads.push(r);
  }

  if (one) {
    const r = reads[0];
    console.log(`${r.date} · bias ${r.k0.bias} (${r.k0.score}) · gap ${r.gap.pts} ${r.gap.type} · ATRd ${r.atrDaily} · OR15 ${r.or15?.low}-${r.or15?.high} · ${r.dayClass}`);
    for (const s of r.steps) {
      console.log(`${s.clock} ${s.phase.padEnd(8)} ${String(s.score).padStart(5)} ${s.headline.padEnd(26)} | ${s.trend.padEnd(26)} | ${s.action.slice(0, 120)} | ${s.fc.dir ? (s.fc.dir > 0 ? "▲" : "▼") : "◆"} ${s.out ? `${s.out.move >= 0 ? "+" : ""}${s.out.move} ${s.out.hit == null ? "" : s.out.hit ? "✓" : "✗"}${s.out.targetHit ? " H" : ""}` : ""}${s.events.length ? " · " + s.events.join(" / ") : ""}`);
    }
    for (const t of r.trades) console.log(t.entryClock, t.side, t.tag, t.entry, t.stop, t.h1, t.h2, "→", t.exitClock, t.exitReason, t.resultR);
    return;
  }

  const trades: (TrackTrade & { date: string })[] = reads.flatMap((r) => r.trades.map((t) => ({ ...t, date: r.date })));
  mkdirSync(out, { recursive: true });
  const csv = (rows: (string | number | boolean | null)[][]) => rows.map((r) => r.map((x) => (x == null ? "" : String(x))).join(",")).join("\n") + "\n";

  const sum = summarizeTrades(trades);
  writeFileSync(join(out, "summary_by_tag.csv"), csv([["tag", "n", "win_rate", "avg_r", "median_r", "expectancy_r", "profit_factor", "avg_mfe_r", "avg_mae_r", "max_consec_loss", "total_r", "status"], ...sum.map((s) => [s.tag, s.n, s.win, s.avgR, s.medR, s.avgR, s.pf, s.avgMfe, s.avgMae, s.maxConsecLoss, s.totalR, s.status])]));

  // huni: 15m yön teyidi olan adımlar → HAZIR → giriş
  const funnel = [["15m teyitli adım", reads.reduce((a, r) => a + r.steps.filter((x) => !x.pre && x.side15 !== 0 && x.phase !== "KAPANIŞ").length, 0)],
    ["HAZIR", reads.reduce((a, r) => a + r.steps.filter((x) => x.setup?.status === "ARMED").length, 0)],
    ["giriş", trades.length]] as (string | number)[][];
  writeFileSync(join(out, "funnel.csv"), csv([["stage", "count"], ...funnel]));

  // bağlam
  const ctxRows: (string | number)[][] = [];
  const ctx = (name: string, f: (t: TrackTrade) => string) => {
    const g = new Map<string, number[]>();
    for (const t of trades) if (t.resultR != null) { const k = `${t.tag}|${f(t)}`; (g.get(k) ?? g.set(k, []).get(k)!).push(t.resultR); }
    for (const [k, rs] of g) ctxRows.push([name, ...k.split("|"), rs.length, +(rs.reduce((a, x) => a + x, 0) / rs.length).toFixed(2)]);
  };
  ctx("bias", (t) => (t.bias === "NÖTR" ? "neutral" : t.bias === t.side ? "aligned" : "against"));
  ctx("gap_type", (t) => t.gapType);
  ctx("day_class", (t) => t.dayClass ?? "-");
  ctx("confirm_10", (t) => String(t.confirm10));
  writeFileSync(join(out, "by_context.csv"), csv([["context", "tag", "value", "n", "avg_r"], ...ctxRows]));

  // günlük
  writeFileSync(join(out, "daily.csv"), csv([["date", "trades", "total_r", "first_tag", "bias", "day_class", "dir_score_0945", "dir_score_1000", "pred_n", "pred_hit"],
    ...reads.map((r) => [r.date, r.trades.length, r.realizedR, r.trades[0]?.tag ?? "", r.k0.bias, r.dayClass ?? "", r.steps.find((s) => s.clock === "09:45")?.score ?? "", r.steps.find((s) => s.clock === "10:00")?.score ?? "", r.pred.n, r.pred.hit])]));

  // uyarılar
  const al = reads.flatMap((r) => r.alerts);
  const lv = ["TETİK", "İPTAL", "YÖNET", "ÇIKIŞ", "KADEME"];
  writeFileSync(join(out, "alerts_eval.csv"), csv([["level", "n"], ...lv.map((l) => [l, al.filter((a) => a.level === l).length])]));

  // tahminler (saat ve güce göre)
  const preds = reads.flatMap((r) => r.steps.filter((s) => !s.pre && s.fc.dir && s.out?.done).map((s) => ({ date: r.date, s })));
  const grp = (f: (x: (typeof preds)[number]) => string) => {
    const g = new Map<string, { n: number; hit: number; t: number; mv: number }>();
    for (const p of preds) { const k = f(p); const o = g.get(k) ?? { n: 0, hit: 0, t: 0, mv: 0 }; o.n++; if (p.s.out?.hit) o.hit++; if (p.s.out?.targetHit) o.t++; o.mv += p.s.fc.dir * (p.s.out?.move ?? 0); g.set(k, o); }
    return [...g.entries()].sort();
  };
  const pr: (string | number)[][] = [];
  for (const [k, o] of grp((p) => `güç ${p.s.strength}`)) pr.push([k, o.n, Math.round((100 * o.hit) / o.n), Math.round((100 * o.t) / o.n), +(o.mv / o.n).toFixed(3)]);
  for (const [k, o] of grp((p) => `saat ${p.s.clock.slice(0, 2)}`)) pr.push([k, o.n, Math.round((100 * o.hit) / o.n), Math.round((100 * o.t) / o.n), +(o.mv / o.n).toFixed(3)]);
  for (const [k, o] of grp((p) => `kural ${p.s.fc.rule ?? "-"}`)) pr.push([k, o.n, Math.round((100 * o.hit) / o.n), Math.round((100 * o.t) / o.n), +(o.mv / o.n).toFixed(3)]);
  writeFileSync(join(out, "predictions.csv"), csv([["group", "n", "dir_hit_pct", "target_hit_pct", "avg_signed_move"], ...pr]));

  const half = Math.floor(run.length / 2);
  const tot = (xs: typeof trades) => +xs.reduce((a, t) => a + (t.resultR ?? 0), 0).toFixed(2);
  console.log(`günler ${run[0]} → ${run[run.length - 1]} (${run.length}) · flow=off`);
  console.log(`işlem ${trades.length} · toplam ${tot(trades)}R · ilk yarı ${tot(trades.filter((t) => t.date < run[half]))}R · ikinci yarı ${tot(trades.filter((t) => t.date >= run[half]))}R`);
  for (const s of sum) console.log(`  ${s.tag.padEnd(14)} n=${s.n} win=%${s.win} avg=${s.avgR}R total=${s.totalR}R pf=${s.pf} ${s.status}`);
  console.log(`tahmin ${preds.length} · yön %${Math.round((100 * preds.filter((p) => p.s.out?.hit).length) / Math.max(1, preds.length))} · hedef %${Math.round((100 * preds.filter((p) => p.s.out?.targetHit).length) / Math.max(1, preds.length))}`);
  for (const r of pr) console.log("  ", r.join(" · "));
  console.log(`huni: ${funnel.map((f) => f.join(" ")).join(" → ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
