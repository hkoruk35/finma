/* SPX motoru için sentetik veri testi (ağ erişimi olmadan) */
const { buildSession } = require("/tmp/spxbuild/snapshot.js");
const { buildContext } = require("/tmp/spxbuild/context.js");
const { simulateRunners, buildChain, priceOption, minutesToClose } = require("/tmp/spxbuild/options.js");
const { nyParts, sessionDates } = require("/tmp/spxbuild/yahoo.js");

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ok   " + name);
  else { failures++; console.log("  FAIL " + name + (extra ? "  -> " + JSON.stringify(extra) : "")); }
}

// ── ET zaman damgası üretici ───────────────────────────────────
// 2026-08-13 (Perşembe) ve 2026-08-14 (Cuma) seansları
function etTimestamp(dateStr, minutesEt) {
  // ET = UTC-4 (yaz saati)
  const base = Date.parse(dateStr + "T00:00:00Z") / 1000;
  return base + (minutesEt + 240) * 60;
}

function mkSeries(dateStr, startMin, count, startPrice, shape) {
  const bars = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const drift = shape(i);
    const close = open + drift;
    bars.push({
      time: etTimestamp(dateStr, startMin + i),
      open: +open.toFixed(2),
      high: +(Math.max(open, close) + 0.6).toFixed(2),
      low: +(Math.min(open, close) - 0.6).toFixed(2),
      close: +close.toFixed(2),
      volume: 4000 + ((i * 37) % 3000),
    });
    price = close;
  }
  return bars;
}

// Önceki gün: yatay; bugün: ilk 40 dk yatay, sonra güçlü yükseliş
const prevDay = "2026-08-13";
const day = "2026-08-14";

const spxPrev = mkSeries(prevDay, 570, 390, 6300, (i) => Math.sin(i / 25) * 0.5);
const spxToday = mkSeries(day, 570, 390, 6305, (i) => (i < 40 ? Math.sin(i / 8) * 0.4 : 0.35));

const esPrevOn = mkSeries(prevDay, 1080, 360, 6320, (i) => Math.sin(i / 40) * 0.4); // 18:00 -> 00:00
const esNightEarly = mkSeries(day, 0, 570, 6322, (i) => Math.sin(i / 60) * 0.35); // 00:00 -> 09:30
const esPrev = mkSeries(prevDay, 570, 390, 6318, (i) => Math.sin(i / 25) * 0.5);
const esToday = mkSeries(day, 570, 390, 6323, (i) => (i < 40 ? Math.sin(i / 8) * 0.4 : 0.36));

const nqToday = mkSeries(day, 570, 390, 23000, (i) => (i < 40 ? 0 : 1.5));
const vixToday = mkSeries(day, 570, 390, 15.2, (i) => (i < 40 ? 0 : -0.004));

const data = {
  es1m: [...esPrev, ...esPrevOn, ...esNightEarly, ...esToday].sort((a, b) => a.time - b.time),
  spx1m: [...spxPrev, ...spxToday],
  nq1m: nqToday,
  vix1m: vixToday,
  spxDaily: Array.from({ length: 300 }, (_, i) => {
    const t = Date.parse("2025-06-02T13:30:00Z") / 1000 + i * 86400;
    const base = 5800 + i * 2 + Math.sin(i / 9) * 30;
    return {
      time: t,
      open: +base.toFixed(2),
      high: +(base + 18).toFixed(2),
      low: +(base - 15).toFixed(2),
      close: +(base + Math.sin(i / 4) * 12).toFixed(2),
      volume: 1e9,
    };
  }),
  vixDaily: Array.from({ length: 60 }, (_, i) => {
    const t = Date.parse("2026-05-20T20:00:00Z") / 1000 + i * 86400;
    const v = 16 - i * 0.02;
    return { time: t, open: v, high: v + 0.5, low: v - 0.5, close: v, volume: 0 };
  }),
  errors: [],
};

console.log("\n[1] Seans tarihleri");
const dates = sessionDates(data.spx1m);
check("iki seans bulundu", dates.length === 2, dates);
check("son seans " + day, dates[dates.length - 1] === day, dates);

console.log("\n[2] Seans kurgusu");
const session = buildSession(data, day);
check("seans üretildi", !!session);
check("390 kare", session.frames.length === 390, session.frames.length);

const f0 = session.frames[0];
const fLast = session.frames[session.frames.length - 1];
check("ilk kare 09:30", f0.timeLabel === "09:30", f0.timeLabel);
check("son kare 15:59", fLast.timeLabel === "15:59", fLast.timeLabel);

console.log("\n[3] Seviyeler");
const L = session.levels;
check("ORH hesaplandı", L.spx.orh > 0, L.spx.orh);
check("ORL hesaplandı", L.spx.orl > 0, L.spx.orl);
check("ORH > ORL", L.spx.orh > L.spx.orl, [L.spx.orh, L.spx.orl]);
check("OR genişliği makul (<5 puan)", L.spx.orSize > 0 && L.spx.orSize < 5, L.spx.orSize);
check("gece ONH/ONL var", L.es.onh > 0 && L.es.onl > 0, [L.es.onh, L.es.onl]);
check("ONH > ONL", L.es.onh > L.es.onl);
check("önceki gün PDC var", L.es.pdc > 0, L.es.pdc);
check("VWAP hesaplandı", L.es.vwap > 6000, L.es.vwap);
check("yükseliş sonrası fiyat OR üstünde", L.spx.vsOr === "ABOVE", L.spx.vsOr);

console.log("\n[4] İlk 4 dakikada OR tanımsız olmalı");
check("kare 0-3 OR yok", session.frames.slice(0, 4).every((f) => f.trigger === 0 || f.state === "NEUTRAL"),
  session.frames.slice(0, 4).map((f) => f.state));

console.log("\n[5] Durum geçişleri");
const states = [...new Set(session.frames.map((f) => f.state))];
console.log("  görülen durumlar:", states.join(", "));
check("birden fazla durum oluştu", states.length > 1, states);
check("yükseliş sonrası long durumu var", states.some((s) => s.includes("LONG")), states);
check("son kare long yönlü", fLast.state.includes("LONG"), fLast.state);
check("net skor pozitif", fLast.netScore > 0, fLast.netScore);
check("net skor = long - short", Math.abs(fLast.netScore - (fLast.longScore - fLast.shortScore)) < 0.05,
  [fLast.netScore, fLast.longScore, fLast.shortScore]);

console.log("\n[6] Faktörler ve karar");
const full = session.frames[300];
check("faktör listesi dolu", full.factors.length >= 8, full.factors.length);
check("her faktörün ağırlığı sayı", full.factors.every((x) => Number.isFinite(x.weight)));
check("karar metni dolu", !!full.decision.action && !!full.decision.confirmation && !!full.decision.invalidation);
check("tetik seviyesi sayısal", Number.isFinite(full.trigger) && full.trigger > 0, full.trigger);
check("yapı alanları dolu", !!full.structure.es15m && !!full.structure.spx1m, full.structure);

console.log("\n[7] Bağlam motoru");
const ctx = buildContext({
  sessionDate: day,
  prevDate: prevDay,
  spx1m: data.spx1m,
  spxDaily: data.spxDaily,
  vixDaily: data.vixDaily,
  esOvernight: session.esOvernight,
  esRthFirst: session.esRthFirst,
  esPdc: L.es.pdc,
  onMid: L.es.onMid,
  nqChangePct: session.nqChangePct,
  esChangePct: session.esChangePct,
  spotPrice: fLast.spxPrice,
  state: fLast.state,
});
check("parmak izi üretildi", ctx.fingerprint.includes("AY="), ctx.fingerprint);
check("mevsimsellik günü doğru (Cuma)", ctx.seasonality.weekday === "Cuma", ctx.seasonality.weekday);
check("VIX seviyesi hesaplandı", ctx.volatility.vix > 0, ctx.volatility.vix);
check("önceki seans yapısı var", ctx.previousSession.structureType !== "VERİ YOK", ctx.previousSession);
check("gece boşluğu hesaplandı", ctx.overnight.gapType !== "VERİ YOK", ctx.overnight);
check("tarihsel örneklem bulundu", ctx.analog.sampleSize > 0, ctx.analog.sampleSize);
check("örneklem yüzdeleri tutarlı",
  ctx.analog.bullishCount + ctx.analog.bearishCount + ctx.analog.chopCount === ctx.analog.sampleSize,
  ctx.analog);
check("uyum değerlendirmesi var", ["CONFIRMED", "CONTRADICTED", "PENDING"].includes(ctx.liveAgreement), ctx.liveAgreement);

console.log("\n[8] Opsiyon fiyatlama");
const atmCall = priceOption(6400, 6400, 180, 0.2, true);
const itmCall = priceOption(6400, 6350, 180, 0.2, true);
const otmCall = priceOption(6400, 6450, 180, 0.2, true);
check("ATM delta ~0.5", Math.abs(atmCall.delta - 0.5) < 0.08, atmCall.delta);
check("ITM prim > ATM prim", itmCall.price > atmCall.price, [itmCall.price, atmCall.price]);
check("ATM prim > OTM prim", atmCall.price > otmCall.price, [atmCall.price, otmCall.price]);
check("theta negatif", atmCall.theta < 0, atmCall.theta);
const putP = priceOption(6400, 6400, 180, 0.2, false);
check("put-call paritesi (r=0)", Math.abs(atmCall.price - putP.price) < 0.5, [atmCall.price, putP.price]);
check("uzun vade primi daha yüksek", priceOption(6400, 6400, 360, 0.2, true).price > atmCall.price);

console.log("\n[9] Zincir");
const chain = buildChain({ spot: fLast.spxPrice, vix: 15, minutesLeft: 120, type: "CALL", targetPrice: fLast.spxPrice + 20 });
check("7 grev", chain.length === 7, chain.length);
check("primler azalan sırada", chain.every((c, i) => i === 0 || c.premium <= chain[i - 1].premium),
  chain.map((c) => c.premium));
check("hedefte prim daha yüksek", chain.every((c) => c.premiumAtTarget >= c.premium));
check("başa baş > strike (call)", chain.every((c) => c.breakeven > c.strike));

console.log("\n[10] Runner simülasyonu");
const runners = simulateRunners({ frames: session.frames, vix: 15 });
check("simülasyon çalıştı", runners.available === true, runners.reason);
check("5 model", runners.models.length === 5, runners.models.length);
check("yön LONG", runners.direction === "LONG", runners.direction);
check("tüm K/Z sayısal", runners.models.every((m) => Number.isFinite(m.pnl)), runners.models.map((m) => m.pnl));
check("zirve kâr >= K/Z", runners.models.every((m) => m.maxPnl >= m.pnl - 0.01),
  runners.models.map((m) => [m.id, m.pnl, m.maxPnl]));
check("en iyi model işaretli", !!runners.bestId, runners.bestId);
console.log("  modeller:", runners.models.map((m) => `${m.id}:${m.pnl.toFixed(0)}$`).join("  "));

console.log("\n[11] Kısmi (yeniden oynatma) simülasyonu ilerliyor");
const partial = simulateRunners({ frames: session.frames.slice(0, runners.entryIndex + 30), vix: 15 });
check("kısmi simülasyon çalıştı", partial.available === true);
check("kısmi K/Z sayısal", Number.isFinite(partial.models[0].pnl), partial.models[0].pnl);

console.log("\n[12] Düşüş senaryosu (short) ayrı üretiliyor");
const spxDown = mkSeries(day, 570, 390, 6305, (i) => (i < 40 ? Math.sin(i / 8) * 0.4 : -0.35));
const esDown = mkSeries(day, 570, 390, 6323, (i) => (i < 40 ? Math.sin(i / 8) * 0.4 : -0.36));
const dataDown = {
  ...data,
  spx1m: [...spxPrev, ...spxDown],
  es1m: [...esPrev, ...esPrevOn, ...esNightEarly, ...esDown].sort((a, b) => a.time - b.time),
  nq1m: mkSeries(day, 570, 390, 23000, (i) => (i < 40 ? 0 : -1.5)),
  vix1m: mkSeries(day, 570, 390, 15.2, (i) => (i < 40 ? 0 : 0.006)),
};
const sDown = buildSession(dataDown, day);
const dLast = sDown.frames[sDown.frames.length - 1];
check("düşüşte short durumu", dLast.state.includes("SHORT"), dLast.state);
check("eski tuzak kırılıma takılıp kalmadı", dLast.state !== "FAILED_LONG", dLast.state);
check("düşüşte net skor negatif", dLast.netScore < 0, dLast.netScore);
check("fiyat OR altında", sDown.levels.spx.vsOr === "BELOW", sDown.levels.spx.vsOr);
const rDown = simulateRunners({ frames: sDown.frames, vix: 15 });
check("short runner çalıştı", rDown.available && rDown.direction === "SHORT", rDown.direction);

console.log("\n[13] Yatay senaryo sinyal üretmemeli");
const flat = (i) => Math.sin(i / 6) * 0.35;
const dataFlat = {
  ...data,
  spx1m: [...spxPrev, ...mkSeries(day, 570, 390, 6305, flat)],
  es1m: [...esPrev, ...esPrevOn, ...esNightEarly, ...mkSeries(day, 570, 390, 6323, flat)].sort((a, b) => a.time - b.time),
};
const sFlat = buildSession(dataFlat, day);
const flatStates = new Set(sFlat.frames.map((f) => f.state));
console.log("  yatay durumlar:", [...flatStates].join(", "));
check("yatay seansta güçlü trend yok",
  ![...flatStates].some((s) => s === "STRONG_LONG" || s === "STRONG_SHORT"), [...flatStates]);

console.log("\n[13b] Tuzak kırılım tazeliği");
{
  const sd = sDown.frames;
  const failedIdx = sd.findIndex((f) => f.state === "FAILED_LONG");
  if (failedIdx >= 0) {
    console.log("  FAILED_LONG ilk görülme: kare " + failedIdx + " (" + sd[failedIdx].timeLabel + ")");
    const stillFailed = sd.slice(failedIdx + 40).filter((f) => f.state === "FAILED_LONG").length;
    check("tuzak kırılım 40 dakika sonra sürmüyor", stillFailed === 0, stillFailed + " kare");
  } else {
    console.log("  bu senaryoda FAILED_LONG oluşmadı");
  }
}

console.log("\n[14] Performans");
const t0 = Date.now();
buildSession(data, day);
const ms = Date.now() - t0;
check("seans kurgusu < 3 sn", ms < 3000, ms + " ms");
console.log("  süre: " + ms + " ms");

console.log("\n" + (failures === 0 ? "TÜM TESTLER GEÇTİ" : failures + " TEST BAŞARISIZ"));
process.exit(failures ? 1 : 0);
