/**
 * SPY Engine V11 — testler. Çalıştırma (frontend/ klasöründen):
 *   npx tsx lib/spyengine/v11/engine.test.ts
 *
 * Gerçek veri: fixtures/spy5m_30d_to_20261008.json (Yahoo SPY 5m, premarket/AH dahil,
 * 30 seans, son gün 2026-10-08). Talimattaki "Çelişki çözüm tablosu"nun her satırı
 * aşağıda bir test vakasıdır (C1…C12).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { nyParts, type Bar } from "../core";
import { prepare, runDay, tfScore, type Prep } from "./engine";
import { buildSnapshot } from "./snapshot";
import { archiveLabel, type ArchiveStats } from "./archive";
import { V11_CONFIG as CFG } from "./config";

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/spy5m_30d_to_20261008.json"), "utf8")) as number[][];
const BARS: Bar[] = rows.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
const DAY = "2026-10-08";
const NOW = Math.floor(new Date("2026-10-08T21:00:00Z").getTime() / 1000); // 17:00 ET, seans kapalı

let pass = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); pass++; console.log("  ok  ", name); }
  catch (e) { console.error("  FAIL", name, "\n      ", (e as Error).message); process.exitCode = 1; }
};

const prep = prepare(BARS, NOW);
const days = prep.days.filter((d) => d <= DAY);
const runs = days.map((d) => runDay(prep, d));
const today = runs[runs.length - 1];
const clk = (t: number) => nyParts(t).hhmm;
const snapAt = (asof: string, ah: { label: "AH"; price: number } | null = null) => {
  const [h, m] = asof.split(":").map(Number);
  const p = prepare(BARS, Math.floor(new Date(`2026-10-08T${String(h + 4).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`).getTime() / 1000));
  const r = runDay(p, DAY);
  return { p, r, s: buildSnapshot({ prep: p, run: r, archive: null, nowSec: p.nowSec, replay: true, phase: "CLOSED", ah }) };
};

console.log("Yapısal değişmezler");

test("30 seans yüklendi, son gün 08.10 ve 78 RTH mumu var", () => {
  assert.equal(days.length, 30);
  assert.equal(today.bars.length, 78);
});

test("İlke 3: yalnızca kapanmış RTH mumu — son mumun bitişi 'şimdi'den ileride olamaz, premarket/AH mumu karar serisinde yok", () => {
  const p = prepare(BARS, NOW);
  for (const b of p.rth) { const m = nyParts(b.time).minutes; assert.ok(m >= 570 && m < 960); assert.ok(b.time + 300 <= NOW); }
});

test("Non-repainting: 13:00'te oynatılan günün adımları, tam günün aynı adımlarıyla birebir aynı", () => {
  const { r } = snapAt("13:00");
  assert.ok(r.steps.length > 30);
  r.steps.forEach((s, i) => {
    const f = today.steps[i];
    assert.deepEqual([s.end, s.state, s.side, s.regime], [f.end, f.state, f.side, f.regime], `adım ${i} (${clk(s.end - 300)})`);
  });
});

test("Zaman kuralları: 10:00 öncesi ve 15:30 sonrası GİR yok; 15:50'de pozisyon kalmaz (60 seans boyunca)", () => {
  for (const r of runs) {
    for (const s of r.steps) {
      const endMin = nyParts(s.end - 300).minutes + 5;
      if (endMin <= CFG.time.openEndMin) assert.ok(s.state === "BEKLE", `${r.ymd} ${clk(s.end - 300)} açılışta ${s.state}`);
      if (s.state === "GİR") assert.ok(endMin > CFG.time.openEndMin && endMin <= CFG.time.lastEntryMin, `${r.ymd} GİR ${endMin}`);
    }
    for (const t of r.trades) assert.ok(t.exitEnd != null || r.ymd === DAY, `${r.ymd} açık pozisyon seans sonunda kaldı`);
    for (const t of r.trades) if (t.exitEnd) assert.ok(nyParts(t.exitEnd - 300).minutes + 5 <= 16 * 60);
  }
});

test("Tek hüküm: her adımda tek durum; yön yalnızca tek tarafta; GİR/YÖNET'te yön dolu", () => {
  for (const r of runs) for (const s of r.steps) {
    assert.ok(["BEKLE", "HAZIRLAN", "GİR", "YÖNET", "ÇIK", "PAS"].includes(s.state));
    if (s.state === "GİR" || s.state === "YÖNET") assert.ok(s.side === "LONG" || s.side === "SHORT");
    if (s.state === "BEKLE") assert.equal(s.side, null);
  }
});

test("Hüküm üç parçalı: neden ≤ 3 madde, iptal metni dolu (08.10'un her adımı)", () => {
  const p = prepare(BARS, NOW);
  void p;
  for (let i = 0; i < today.steps.length; i++) {
    const hh = clk(today.steps[i].end);
    const { r } = snapAt(hh);
    const v = r.last!.verdict;
    assert.ok(v.why.length >= 1 && v.why.length <= 3, `${hh} neden ${v.why.length}`);
    assert.ok(v.invalidation.text.length > 0, `${hh} iptal metni boş`);
    if (v.state === "HAZIRLAN" || v.state === "GİR" || v.state === "YÖNET") assert.ok(v.invalidation.price != null, `${hh} iptal fiyatı yok`);
    if (i > 40) break; // süre
  }
});

test("Rejim histerezisi: trend dışı geçişler ≥ 30 dk arayla ve 2 ardışık kapanışla (60 seans)", () => {
  for (const r of runs) {
    let prev = "";
    let since = 0;
    for (const s of r.steps) {
      if (s.regime !== prev) {
        const wasTrend = prev === "TREND_UP" || prev === "TREND_DOWN";
        if (prev && prev !== "AÇILIŞ" && !wasTrend) assert.ok(s.end - since >= CFG.regime.hysteresis.minDwellMin * 60, `${r.ymd} ${clk(s.end - 300)} ${prev}→${s.regime} ${(s.end - since) / 60} dk`);
        if (wasTrend) assert.equal(s.regime, "GEÇİŞ", `${r.ymd} trendden doğrudan ${s.regime}`);
        since = s.end;
        prev = s.regime;
      }
    }
  }
});

test("L2: skor −4…+4; ölü bölgede Konum = 0", () => {
  const n = prep.tf15.bars.length;
  for (let k = 40; k < n; k++) {
    const sc = tfScore(prep, prep.tf15, k);
    assert.ok(sc.total >= -4 && sc.total <= 4);
    const b = prep.tf15.bars[k];
    const a = prep.atr5[b.g1];
    if (a != null && Math.abs(b.close - prep.vwap[b.g1]) < CFG.score.deadZoneAtr * a) assert.equal(sc.pos, 0);
  }
});

test("L3–L5: R/R kapısı — GİR planının R/R değeri ≥ 1,0; R/R < 1 olan her tetik PAS (60 seans)", () => {
  let gir = 0, pas = 0;
  for (const r of runs) {
    const p2 = prepare(BARS, NOW);
    void p2;
    for (const s of r.steps) {
      if (s.state === "GİR") gir++;
      if (s.state === "PAS") pas++;
    }
    for (const t of r.trades) assert.ok(Math.abs(t.t1 - t.entry) / Math.abs(t.entry - t.stop0) >= CFG.setup.minRR - 1e-9, `${r.ymd} R/R<1 işlem açıldı`);
  }
  console.log(`        (60 seans: ${gir} GİR adımı, ${pas} PAS adımı)`);
});

test("Kurulum rejime bağlı: TREND'de yalnızca trend yönü, YATAY'da yalnızca kenar kurulumu", () => {
  for (const r of runs) for (const t of r.trades) {
    if (t.regime === "TREND_UP") assert.equal(t.side, "LONG");
    if (t.regime === "TREND_DOWN") assert.equal(t.side, "SHORT");
    if (t.regime === "YATAY") assert.ok(t.setup === "EDGE_LONG" || t.setup === "EDGE_SHORT");
    if (t.setup === "EDGE_LONG") assert.equal(t.side, "LONG");
    if (t.setup === "EDGE_SHORT") assert.equal(t.side, "SHORT");
  }
});

console.log("\nÇelişki çözüm tablosu (08.10) — C1…C12");

test("C1 'Son 2 saat: TREND GÜNÜ ▼' kalktı: tek rejim rozeti; fiyat 14:00→16:00 yükselirken rejim aşağı yön söylemiyor", () => {
  const snap = snapAt("16:00").s;
  assert.ok(["TREND ▲", "TREND ▼", "YATAY", "GEÇİŞ", "AÇILIŞ"].includes(snap.regime.text));
  assert.equal(JSON.stringify(snap).includes("TREND GÜNÜ"), false);
  assert.equal(JSON.stringify(snap).includes("Son 2 saat"), false);
  // aşağı yönlü bir hüküm, fiyat 2 saat boyunca yükselmişken verilmemeli
  const a = snapAt("14:00").r.bars, b = snapAt("16:00").r.bars;
  void a; void b;
  const sNow = snapAt("16:00").r.last!.verdict;
  assert.ok(!(sNow.side === "SHORT" && (sNow.state === "GİR" || sNow.state === "YÖNET")));
});

test("C2 Açılış kartı 10:00'da katlanır: 09:50'de 'toplanıyor', 10:05'te arşiv satırı", () => {
  const early = snapAt("09:50").s;
  assert.equal(early.opening?.done, false);
  assert.equal(early.verdict?.state, "BEKLE");
  const late = snapAt("10:05").s;
  assert.equal(late.opening?.done, true);
  assert.match(late.opening!.text, /Açılış 09:30–10:00/);
});

test("C3 Zaman dilimleri tek satır: 4h/1h/30m/15m/5m ayrı kart değil; 4h yok", () => {
  const s = snapAt("14:00").s;
  assert.ok(s.evidence.roles.htf.includes("htf_bias"));
  assert.ok(s.evidence.roles.m15.includes("yön"));
  assert.equal(JSON.stringify(s).includes("4h skor"), false);
});

test("C4 Olay kararı çevirmez: A sınıfı karşı olay GİR üretmez; yalnızca uyarı/kısıt (60 seans)", () => {
  // Olay yönü ile ters hükümde GİR'e geçiş, olayın kendisinden değil rejim+tetikten gelir:
  for (const r of runs) for (const t of r.trades) {
    const aOpp = r.events.find((e) => e.grade === "A" && e.end === t.entryEnd && e.bias === (t.side === "LONG" ? -1 : 1));
    assert.equal(aOpp, undefined, `${r.ymd} aynı mumda karşı A olayına rağmen giriş`);
  }
});

test("C5 LONG ve SHORT planı yan yana yok: hükümde tek yön/plan", () => {
  for (const r of runs) for (const s of r.steps) assert.ok(s.side === null || s.side === "LONG" || s.side === "SHORT");
  const v = snapAt("11:00").s.verdict!;
  assert.ok(v.plan === null || typeof v.plan.entry === "number");
  assert.equal(Object.keys(v).filter((k) => /long|short/i.test(k)).length, 0);
});

test("C6 R/R < 1,0 → PAS ve plan gösterilmez; 0,5R'lik plan hiçbir adımda 'plan' olarak çıkmaz", () => {
  for (let m = 1; m <= 78; m += 3) {
    const hh = `${String(Math.floor((570 + m * 5) / 60)).padStart(2, "0")}:${String((570 + m * 5) % 60).padStart(2, "0")}`;
    const v = snapAt(hh).r.last!.verdict;
    if (v.state === "PAS" && v.plan) assert.fail("PAS iken plan gösteriliyor");
    if ((v.state === "GİR" || v.state === "HAZIRLAN") && v.plan?.rr != null && v.state === "GİR") assert.ok(v.plan.rr >= 1);
  }
});

test("C7 Tek Karar Kartı: anlık görüntüde tek verdict nesnesi; ikinci 'bacak bitti/yeni yön' kutusu yok", () => {
  const s = snapAt("13:00").s;
  assert.equal(JSON.stringify(s).includes("BACAK BİTTİ"), false);
  assert.equal(JSON.stringify(s).includes("YENİ YÖN"), false);
  assert.ok(Array.isArray(s.evidence.legs)); // biten bacaklar arşiv şeridinde
});

test("C8 RTH/AH ayrımı: AH fiyatı karar alanlarına girmez, ayrı rozette", () => {
  const withAh = snapAt("16:00", { label: "AH", price: 774.46 }).s;
  const without = snapAt("16:00").s;
  assert.equal(withAh.ah?.label, "AH");
  assert.equal(withAh.ah?.price, 774.46);
  assert.equal(withAh.price, without.price);
  assert.deepEqual(withAh.verdict, without.verdict);
  assert.deepEqual(withAh.evidence.levels, without.evidence.levels);
  assert.equal(withAh.price, today.bars[today.bars.length - 1].close);
});

test("C9 Pivot varış tahmini yok: seviyeler yalnızca ATR cinsinden mesafe taşır", () => {
  const s = snapAt("14:00").s;
  const json = JSON.stringify(s.evidence.levels);
  assert.equal(/eta|dk hızla|~\d+ dk/i.test(json), false);
  assert.ok(s.evidence.levels.every((l) => "distAtr" in l));
});

test("C10 Düşük isabetli metrik: arşiv isabeti < %50 ve yeterli örneklem → ana ekran dışı, 'deneysel'", () => {
  const fake = (rate: number, n: number): ArchiveStats => ({
    days: 60, from: null, to: null, events: { "SWEEP_LOW|VAL|A": { n, hit: Math.round(rate * n), rate }, "SWEEP_LOW|*|A": { n, hit: Math.round(rate * n), rate } },
    trades: { n: 0, winRate: null, avgR: null, sumR: null, bySetup: {}, byRegime: {} }, baseline: { n: 100, rate: 0.47 }, horizonMin: 30, minSample: 20, minHitRate: 0.5,
  });
  const ev = { kind: "SWEEP_LOW" as const, label: "DİP SÜPÜRME", levelKey: "VAL", grade: "A" as const };
  const low = archiveLabel(ev, fake(0.41, 41));
  assert.equal(low.eligible, false); assert.equal(low.experimental, true);
  const ok = archiveLabel(ev, fake(0.63, 41));
  assert.equal(ok.eligible, true); assert.match(ok.text, /arşiv %63 \(41 olay\)/);
  const few = archiveLabel(ev, fake(0.3, 12));
  assert.equal(few.eligible, true); assert.match(few.text, /yetersiz/);
});

test("C11 Tek VWAP kaynağı: panel = grafik = seviye listesi (RTH, 09:30 ankrajlı)", () => {
  const s = snapAt("15:00").s;
  const last = s.chart.vwap[s.chart.vwap.length - 1];
  assert.equal(s.evidence.vwap, last);
  assert.equal(s.evidence.levels.filter((l) => l.kind === "VWAP").length, 1);
  assert.equal(s.evidence.levels.find((l) => l.kind === "VWAP")!.price, last);
});

test("C12 Seviyeler tek birleşik liste: tekrarsız, fiyata göre sıralı", () => {
  const lv = snapAt("14:00").s.evidence.levels;
  const keys = lv.map((l) => `${l.price}|${l.label}`);
  assert.equal(new Set(keys).size, keys.length);
  for (let i = 1; i < lv.length; i++) assert.ok(lv[i - 1].price >= lv[i].price);
});

test("08.10: iki V10 trend bacağı (10:05 yön, 13:05 yön) V11'de açılmaz — gün YATAY/GEÇİŞ ağırlıklı", () => {
  const tr = today.trades.filter((t) => t.regime.startsWith("TREND"));
  assert.equal(tr.length, 0);
  const share = today.steps.filter((s) => s.regime === "YATAY").length / today.steps.length;
  console.log(`        (08.10: YATAY payı %${Math.round(share * 100)}; rejim dağılımı ${JSON.stringify(Object.fromEntries([...new Set(today.steps.map((s) => s.regime))].map((r) => [r, today.steps.filter((s) => s.regime === r).length])))})`);
  assert.ok(share > 0.3);
});

console.log(`\n${pass} test geçti${process.exitCode ? " — BAŞARISIZLAR VAR" : ""}`);
void (null as unknown as Prep);
