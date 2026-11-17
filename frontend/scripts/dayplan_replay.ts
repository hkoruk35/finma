/**
 * Günlük Plan replay + doğrulama testi (FAZ 3).
 *
 *   npx jiti scripts/dayplan_replay.ts [--date 2026-11-17] [--time 06:51] [--symbol SPY] [--json]
 *
 * 1) Verilen anın snapshot'ını Yahoo verisiyle yeniden üretir ve beklenen değerlerle (±0,10) karşılaştırır (yalnız 17 Kas SPY).
 * 2) Eksik VIX testi: EM kartı null, EM'e bağlı seviye yok.
 * 3) Determinizm testi: aynı girdi → aynı payload.
 * Ağ: Yahoo + ForexFactory. GEX/straddle bu betikte yok (geçmiş zincir verisi tutulmuyor) → "veri yok".
 */

import { buildDayPlan, type DayPlanInput } from "../lib/spyengine/dayPlan";
import { bars5Extended, dailyBars, dailyRawBars, ivAt, macroEvents, megaEarnings, relSymbolsFor } from "../lib/spyengine/dayPlanFetch";
import { nyDateTimeToEpoch } from "../lib/spyengine/core";

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const symbol = (arg("symbol") ?? "SPY").toUpperCase();
  const date = arg("date") ?? "2026-11-17";
  const [h, m] = (arg("time") ?? "06:51").split(":").map(Number);
  const asOf = nyDateTimeToEpoch(date, h * 60 + m);
  const rels = relSymbolsFor(symbol);
  const [bars5, daily, dailyRaw, iv, macro, earn, ...relBars] = await Promise.all([
    bars5Extended(symbol), dailyBars(symbol), dailyRawBars(symbol), ivAt(symbol, asOf), macroEvents(), megaEarnings(), ...rels.map((s) => bars5Extended(s)),
  ]);
  const inp: DayPlanInput = { symbol, asOf, bars5, daily, dailyRaw, iv, rel: rels.map((s, i) => ({ symbol: s, bars5: relBars[i] })), macroEvents: macro, earnings: earn, walls: null, straddle: null };
  const t0 = Date.now();
  const p = buildDayPlan(inp);
  const ms = Date.now() - t0;
  if (!p) { console.log("PLAN ÜRETİLEMEDİ"); process.exit(1); }
  if (process.argv.includes("--json")) { console.log(JSON.stringify(p, null, 1)); return; }

  let fail = 0, info = 0;
  /** hard=false: beklenen değer farklı veri kaynağından (Robinhood 24/5); Yahoo'da farklıysa bilgi olarak raporlanır */
  const chk = (name: string, got: number | null | undefined, exp: number, tol = 0.1, hard = true) => {
    const ok = got != null && Math.abs(got - exp) <= tol;
    if (!ok) { if (hard) fail++; else info++; }
    console.log(`${ok ? "OK  " : hard ? "HATA" : "KAYN"} ${name.padEnd(22)} beklenen ${exp}  bulunan ${got ?? "—"}`);
  };
  console.log(`\n${symbol} ${p.meta.date} asof ${p.meta.asof_et} ET · spot ${p.meta.spot} (${p.meta.spot_et}) · ${ms} ms · hash ${p.meta.inputs_hash}`);
  if (symbol === "SPY" && date === "2026-11-17") {
    const c = p.cards;
    chk("Önceki kapanış", p.meta.prev_close, 739.95);
    chk("PDH", c.prev?.high, 747.01, 0.1, false); chk("PDL", c.prev?.low, 738.07);
    chk("ON high", c.on_range?.high, 741.75, 0.1, false);
    chk("PM low", c.pm_range?.low, 735.7); chk("PM high", c.pm_range?.high, 741.49);
    console.log(`     PM low saati ${c.pm_range?.lowAt} (beklenen 04:25) · PM high saati ${c.pm_range?.highAt} (beklenen 06:40)`);
    chk("VIX (son değer)", c.em?.iv, 22.91, 0.05, false);
    if (c.em) {
      const exp = (p.meta.prev_close! * c.em.iv) / 100 / Math.sqrt(252);
      chk("EM formülü", c.em.value, Math.round(exp * 100) / 100, 0.011);
      chk("EM alt = kapanış−EM", c.em.low, Math.round((p.meta.prev_close! - exp) * 100) / 100, 0.011);
    }
    // VIX 22.91 ile (beklenen değerlerin girdisi) EM bandı
    const p22 = buildDayPlan({ ...inp, iv: { value: 22.91, label: "VIX" } });
    chk("EM @VIX 22.91", p22?.cards.em?.value, 10.7); chk("EM alt @22.91", p22?.cards.em?.low, 729.3); chk("EM üst @22.91", p22?.cards.em?.high, 750.6);
    chk("Yarım EM alt @22.91", p22?.cards.em?.halfLow, 734.6); chk("Yarım EM üst @22.91", p22?.cards.em?.halfHigh, 745.3);
    const g = c.gaps.find((x) => Math.abs(x.low - 736.47) < 0.15);
    console.log(`${g?.filledToday ? "OK  " : "KAYN"} Gap 736.47→751.69 bugün doldu: ${g ? JSON.stringify(g) : "Yahoo günlük/5m verisinde bu gap yok (736.47 kapanışı bulunmuyor)"}`);
    if (!g?.filledToday) info++;
    console.log(`     bulunan gap'ler: ${c.gaps.map((x) => `${x.from} ${x.dir} ${x.low}–${x.high}${x.filled ? " (doldu)" : ""}`).join(" · ")}`);
    chk("200 SMA", c.tech.sma200, 729.6, 0.2);
    chk("4s RSI", c.tech.rsi4h, 36.1, 1, false); chk("4s MACD", c.tech.macd4h, -2.55, 0.3, false); chk("4s sinyal", c.tech.signal4h, -0.82, 0.3, false); chk("4s ATR", c.tech.atr4h, 4.95, 0.3, false);
    chk("Hacim oranı", c.tech.volRatio, 1.9, 0.15, false);
    console.log(`${p.bias.dir === "BEAR" ? "OK  " : "HATA"} Bias ${p.bias.dir} · çizgi ${p.bias.line?.join("–")} · iptal ${p.bias.invalidation} · hedefler ${p.bias.targets.join(", ")}`);
    if (p.bias.dir !== "BEAR") fail++;
    // tavan = bias çizgisi bölgesi: PM tepesini içerir, ≥2 direnç reti, iptal = üst sınır + 0,25
    const tav = p.levels.find((z) => p.bias.line && z.low === p.bias.line[0] && z.high === p.bias.line[1]);
    const okT = !!tav && tav.low <= 741.49 && tav.high >= 741.4 && tav.rejR >= 2 && Math.abs((p.bias.invalidation ?? 0) - (tav.high + 0.25)) < 0.011;
    console.log(`${okT ? "OK  " : "HATA"} Tavan (bias çizgisi) ${tav ? `${tav.low}–${tav.high} ret ${tav.rejR} (${tav.label}) · iptal ${p.bias.invalidation}` : "yok"}`);
    if (!okT) fail++;
    chk("Tavan üst (md 741.75)", tav?.high, 741.75, 0.1, false);
    chk("İptal (md 742.0)", p.bias.invalidation, 742.0, 0.1, false);
  }
  console.log(`\nSkor ${p.score.value}/10 (ham ${p.score.raw}) · ${p.score.components.map((x) => `${x.key} ${x.value ?? "yok"}`).join(" · ")}`);
  console.log("Seviyeler:"); for (const z of p.levels) console.log(`  ${z.type} ${z.low}–${z.high} ret R${z.rejR}/S${z.rejS} (gece ${z.rejOn}) konf ${z.confluence} · ${z.label}`);
  console.log("Senaryolar:"); for (const s of p.scenarios) console.log(`  ${s.key} ${s.label}: ${s.points.filter((q) => q.m % 30 === 0).map((q) => `${q.t} ${q.p}`).join(" → ")}`);
  console.log("Plan:"); for (const r of p.plan) console.log(`  ${r.setup} | ${r.entry} | ${r.targets.join("/")} | stop ${r.stop} | R:R ${r.rr.join("–")}`);
  console.log("Uyarı:", p.texts.warning.join(" | ")); console.log("Senaryo:", p.texts.scenario);
  console.log("15 dk:", JSON.stringify(p.next15)); console.log("Günler:", JSON.stringify({ ...p.nextDays, mc: p.nextDays.mc ? { ...p.nextDays.mc, zoneTouch: p.nextDays.mc.zoneTouch.length } : null }));
  console.log("Olaylar:", JSON.stringify(p.cards.events), "· eksik:", p.missing.join(", "));

  // determinizm
  const p2 = buildDayPlan(inp);
  const same = JSON.stringify(p) === JSON.stringify(p2);
  console.log(`\n${same ? "OK  " : "HATA"} Determinizm: iki çalıştırma ${same ? "aynı" : "FARKLI"}`);
  if (!same) fail++;
  // eksik VIX
  const nv = buildDayPlan({ ...inp, iv: null });
  const noEm = !!nv && nv.cards.em == null && !nv.levels.some((z) => z.sources.some((s) => s.includes("EM"))) && nv.missing.includes("vix");
  console.log(`${noEm ? "OK  " : "HATA"} Eksik VIX: EM kartı ${nv?.cards.em == null ? "veri yok" : "DOLU"}, EM seviyesi ${nv?.levels.some((z) => z.sources.some((s) => s.includes("EM"))) ? "VAR" : "yok"}`);
  if (!noEm) fail++;
  console.log(`\nSonuç: ${fail ? `${fail} HATA` : "sert kontrollerin tümü geçti"} · ${info} kaynak farkı (bilgi)`);
  process.exit(fail && !process.argv.includes("--soft") ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
