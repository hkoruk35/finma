/**
 * SPY Engine — Senaryo Takibi (saf). Günün İLK senaryosunu (açılış kararı,
 * 09:55/10:00) bir kez sabitler ("çapa") ve gün boyu o senaryoyu TAKİP eder;
 * her dakika yeniden üretmez. Trend sürdükçe "yeni giriş" değil "taşı" der,
 * trend değişecekse koşulları seviyeleriyle önceden bildirir.
 *
 * Çapa deterministiktir (kapanmış mumlardan yeniden hesaplanabilir) —
 * sayfa seansın ortasında açılsa da aynı çapa çıkar.
 *
 * Kurallar 59 seans (SPY 5m, 10:00 çapa, taşıma kapanışa kadar) ile ölçüldü:
 *   Çapa yönünde 10:30'da TREND teyidi (kapanışların ≥%80'i yön tarafında VWAP'ta,
 *   ≤2 VWAP kesişimi) olan 26 gün : taşıma ort. +0,97 puan, %62 kazanç
 *   Teyit olmayan 33 gün           : taşıma ort. −0,38 puan, %42 kazanç
 *   "Trend değişti" (15m kapanış son 15m dip/zirvenin ötesinde) çıkışı en kötü
 *   günü −6,96 → −3,09 puana indirdi (teyitli günlerde −5,5 → −2,4), ortalama korundu.
 * Yön tek başına kâr kaynağı değildir: teyit yoksa taşıma değil T1'de kâr al.
 */

import type { Bar } from "./core";
import { nyClock, nyParts, r2 } from "./core";
import type { DaySeries, EmaMap } from "./openingMap";
import { bsPrice } from "./scenario";

export type Dir = "UP" | "DOWN";

export interface Target {
  price: number;
  label: string;
}

export interface Anchor {
  date: string;
  dir: Dir;
  /** Karar anı (unix sn) — çapa mumunun kapanışı */
  t0: number;
  clock: string;
  entry: number;
  decidedAt: string;
  /** AÇILIŞ = 09:55/10:00 çapası · GÜN İÇİ = sonradan oluşan yeni bacak (katalizör / dönüş) */
  kind?: "AÇILIŞ" | "GÜN İÇİ";
  /** Gün içindeki sıra (1 = ilk bacak) */
  legNo?: number;
  /** Gün içi bacakta ilk stop seviyesi (5m kapanış bunun ötesine geçerse) — yoksa VWAP */
  initStop?: number | null;
  /** Açılış kararının gün geneli güveni (openingRegime.dayHold) — yalnız açılış bacağında */
  dayHold?: { level: "YÜKSEK" | "ORTA" | "DÜŞÜK"; text: string } | null;
  strength: string | null;
  weak: boolean;
  targets: Target[];
  /** Önerilen opsiyon: yön + strike (SPY seviyesine göre; prim çekilmez) */
  option: { side: "CALL" | "PUT"; strike: number };
  /** Model IV'si (VIX/100) — yalnız opsiyon katı tahmini için */
  iv: number;
}

export type TrackStatus = "ONAY BEKLENİYOR" | "TREND ONAYLI" | "ONAYSIZ" | "ZAYIFLIYOR" | "DEĞİŞTİ";

export interface ChangeRule {
  label: string;
  /** Eşik seviyesi (15m kapanış bu seviyenin ötesine geçerse) */
  level: number | null;
  /** SPY şu an bu seviyeden ne kadar uzakta (puan, >0 = güvenli tarafta) */
  cushion: number | null;
  state: "ok" | "yakın" | "tetiklendi";
  detail: string;
}

export interface TrackState {
  status: TrackStatus;
  anchor: Anchor;
  price: number;
  /** Çapa yönünde kâr/zarar (puan, %) */
  pnl: number;
  pnlPct: number;
  mfe: number;
  mfeClock: string | null;
  targets: { price: number; label: string; hitClock: string | null }[];
  confirmedClock: string | null;
  exit: { clock: string; price: number; pnl: number; why: string } | null;
  rules: ChangeRule[];
  title: string;
  lines: string[];
  watch: string[];
  /** Girmediysen: kovalama yok, geri çekilmede giriş bölgesi (yalnızca TREND ONAYLI) */
  ifNotIn: string | null;
  /** Model tahmini opsiyon katı (BS; prim çekilmez) */
  optionMultiple: number | null;
  /** VWAP'tan uzaklık (puan, çapa yönünde +) ve ortalama gün aralığının (ADR) oranı */
  extensionPts: number | null;
  extensionADR: number | null;
  /** Güncel sıradaki seviye (sabit hedeflerden bağımsız) */
  nextLevel: { price: number; label: string } | null;
  /** Ters bacak hazırlanıyor: son 2×5m kapanış EMA20(5m)'nin ters tarafında (erken uyarı) */
  counterWarn: string | null;
}

const d = (dir: Dir) => (dir === "UP" ? 1 : -1);

/** Hedefler: çapa yönündeki ilk 3 ölçülmüş seviye (≥1 puan uzak, birbirinden ≥0,8) */
export function pickTargets(
  dir: Dir, entry: number,
  supports: { price: number; label: string }[], resistances: { price: number; label: string }[],
): Target[] {
  const ahead = (dir === "UP" ? resistances : supports)
    .filter((l) => !l.label.includes("yuvarlak") && d(dir) * (l.price - entry) >= 1)
    .sort((a, b) => d(dir) * (a.price - b.price));
  const out: Target[] = [];
  for (const l of ahead) {
    if (out.some((t) => Math.abs(t.price - l.price) < 0.8)) continue;
    out.push({ price: r2(l.price), label: l.label });
    if (out.length >= 3) break;
  }
  return out;
}

export function optionFor(dir: Dir, entry: number): Anchor["option"] {
  return dir === "UP" ? { side: "CALL", strike: Math.floor(entry) } : { side: "PUT", strike: Math.ceil(entry) };
}

/** Son TEYİTLİ 15m dip (UP) / zirve (DOWN): kendinden önceki ve sonraki mumdan daha uç olan mum */
function lastSwing(bars: Bar[], dir: Dir, upto: number, from = 1): number | null {
  for (let x = upto - 1; x >= Math.max(1, from); x--) {
    const a = bars[x - 1], b = bars[x], c = bars[x + 1];
    if (!c) continue;
    if (dir === "UP" ? b.low < a.low && b.low < c.low : b.high > a.high && b.high > c.high) return dir === "UP" ? b.low : b.high;
  }
  return null;
}

export function trackScenario(input: {
  anchor: Anchor;
  /** Bugünün KAPANMIŞ 5m mumları + VWAP (09:30'dan) */
  s5: DaySeries;
  /** Bugünün KAPANMIŞ 15m mumları + VWAP */
  s15: DaySeries;
  ema15: EmaMap;
  ema5: EmaMap;
  price: number;
  atr5: number | null;
  vix: number | null;
  nowSec: number;
  /** Güncel haritadan, fiyatın çapa yönündeki sıradaki ölçülmüş seviyesi (sabit hedefler tükenince yol göstermek için) */
  nextLevel?: { price: number; label: string } | null;
  /** Önceki ≤5 günün ortalama gün aralığı (puan) — aşırı uzama uyarısı VWAP mesafesini buna oranlar */
  adrAvg?: number | null;
}): TrackState {
  const { anchor, s5, s15, ema15, ema5, price, atr5 } = input;
  const dir = d(anchor.dir);
  const bars5 = s5.bars, bars15 = s15.bars;

  // — çapadan sonraki 5m mumlar —
  const after = bars5.map((b, i) => ({ b, i })).filter((x) => x.b.time >= anchor.t0);

  // — hedefler / tepe —
  let mfe = 0, mfeTime: number | null = null;
  const hit: (string | null)[] = anchor.targets.map(() => null);
  for (const { b } of after) {
    const fav = dir * ((dir > 0 ? b.high : b.low) - anchor.entry);
    if (fav > mfe) { mfe = fav; mfeTime = b.time; }
    anchor.targets.forEach((t, k) => {
      if (hit[k] == null && (dir > 0 ? b.high >= t.price : b.low <= t.price)) hit[k] = nyClock(b.time + 300);
    });
  }

  // — trend onayı + trend değişimi: her 5m kapanışta yeniden oynatılır (yapışkan) —
  let confirmedClock: string | null = null;
  let exit: TrackState["exit"] = null;
  const last15At = (end: number) => {
    let k = -1;
    for (let x = 0; x < bars15.length; x++) if (bars15[x].time + 900 <= end) k = x;
    return k;
  };
  const intraday = anchor.kind === "GÜN İÇİ";
  const startIdx = after.length ? after[0].i : bars5.length;
  // gün içi bacakta 15m dip/zirve araması bacağın başladığı 15m mumdan bir önceki mumdan başlar
  const from15 = intraday ? Math.max(1, last15At(anchor.t0) - 1) : 1;
  for (const { b, i } of after) {
    const end = b.time + 300;
    if (intraday) {
      // gün içi bacak: ilk stop = 5m kapanış VWAP'ın ters tarafında (onaydan önce)
      const v = anchor.initStop ?? s5.vwap[i];
      if (!exit && !confirmedClock && v != null && dir * (b.close - v) < 0) {
        exit = { clock: nyClock(end), price: r2(b.close), pnl: r2(dir * (b.close - anchor.entry)), why: anchor.initStop != null ? `ilk stop: 5m kapanış tetik mumlarının ${dir > 0 ? "dibinin" : "tepesinin"} (${anchor.initStop.toFixed(2)}) ötesinde` : "ilk stop: 5m kapanış VWAP'ın ters tarafında" };
      }
      // onay: bacak başından beri ≥6 mum, kapanışların ≥%80'i VWAP'ın yön tarafında, son 15m kapanış EMA20(15m) yön tarafında
      if (!exit && !confirmedClock && i - startIdx + 1 >= 6) {
        let same = 0;
        for (let x = startIdx; x <= i; x++) { const vv = s5.vwap[x]; if (vv != null && Math.sign(bars5[x].close - vv) === dir) same++; }
        const k = last15At(end);
        const e = k >= 0 ? ema15.get(bars15[k].time) ?? null : null;
        if (same / (i - startIdx + 1) >= 0.8 && e != null && dir * (bars15[k].close - e) > 0) confirmedClock = nyClock(end);
      }
    }
    // onay: 09:30'dan bu muma kadar (≥12 mum) çapa yönü tarafında ≥%80 ve ≤2 kesişim
    if (!intraday && !confirmedClock && i + 1 >= 12) {
      let same = 0, cr = 0, pr = 0;
      for (let x = 0; x <= i; x++) {
        const v = s5.vwap[x];
        if (v == null) continue;
        const sg = Math.sign(bars5[x].close - v);
        if (sg === dir) same++;
        if (pr && sg && sg !== pr) cr++;
        if (sg) pr = sg;
      }
      if (same / (i + 1) >= 0.8 && cr <= 2) confirmedClock = nyClock(end);
    }
    // değişim: 15m kapanış son teyitli 15m dip/zirvenin ötesinde (yapışkan)
    if (!exit) {
      const k = last15At(end);
      if (k >= 1) {
        const sw = lastSwing(bars15, anchor.dir, k, from15);
        if (sw != null && dir * (bars15[k].close - sw) < 0) exit = { clock: nyClock(bars15[k].time + 900), price: r2(bars15[k].close), pnl: r2(dir * (bars15[k].close - anchor.entry)), why: `15m kapanış son 15m ${dir > 0 ? "dibinin" : "zirvesinin"} ötesine geçti → trend değişti` };
      }
    }
  }

  // — güncel seviyeler —
  const kNow = bars15.length - 1;
  const swingNow = kNow >= 1 ? lastSwing(bars15, anchor.dir, kNow, from15) : null;
  const e15Now = kNow >= 0 ? ema15.get(bars15[kNow].time) ?? null : null;
  const close15 = kNow >= 0 ? bars15[kNow].close : null;
  const v5 = bars5.length ? s5.vwap[bars5.length - 1] : null;
  // gün içi bacakta zayıflama ancak bacak onaylandıktan sonra anlamlı (tetik anında 15m EMA20 gecikmeli olabilir)
  const weakening = close15 != null && e15Now != null && dir * (close15 - e15Now) < 0 && (!intraday || !!confirmedClock);

  const cushion = (lvl: number | null) => (lvl == null ? null : r2(dir * (price - lvl)));
  const rules: ChangeRule[] = [
    {
      label: `Zayıflama: 15m kapanış EMA20(15m) ${dir > 0 ? "altında" : "üstünde"}`,
      level: e15Now != null ? r2(e15Now) : null,
      cushion: cushion(e15Now),
      state: weakening ? "tetiklendi" : e15Now != null && dir * (price - e15Now) <= 0.4 ? "yakın" : "ok",
      detail: "İlk uyarı: stopu sıkılaştır / kısmi kâr. Trend henüz bozulmadı.",
    },
    {
      label: `TREND DEĞİŞTİ: 15m kapanış son 15m ${dir > 0 ? "dibinin altında" : "zirvesinin üstünde"}`,
      level: swingNow != null ? r2(swingNow) : null,
      cushion: cushion(swingNow),
      state: exit ? "tetiklendi" : swingNow != null && dir * (price - swingNow) <= 0.5 ? "yakın" : "ok",
      detail: "Senaryo bozulur: çık, yeni giriş yok (ölçüm: en kötü günü yarıya indirdi).",
    },
  ];

  const extPts = v5 != null ? r2(dir * (price - v5)) : null;
  const extADR = extPts != null && input.adrAvg && input.adrAvg > 0 ? Math.round((extPts / input.adrAvg) * 100) / 100 : null;
  // bacak bittiyse sonuç ÇIKIŞ fiyatından (canlı fiyat bitmiş bacağın kârını/zararını değiştirmez)
  const pnl = exit ? exit.pnl : r2(dir * (price - anchor.entry));
  const targets = anchor.targets.map((t, k) => ({ ...t, hitClock: hit[k] }));
  const nHit = hit.filter(Boolean).length;
  const dirW = anchor.dir === "UP" ? "yukarı" : "aşağı";
  const side = anchor.dir === "UP" ? "LONG" : "SHORT";
  const sgn = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;

  // — durum —
  let status: TrackStatus;
  if (exit) status = "DEĞİŞTİ";
  else if (weakening) status = "ZAYIFLIYOR";
  else if (confirmedClock) status = "TREND ONAYLI";
  else if (intraday ? bars5.length - startIdx < 6 : bars5.length < 12) status = "ONAY BEKLENİYOR";
  else status = "ONAYSIZ";

  // — opsiyon (yalnız model tahmini; prim çekilmez) —
  let optionMultiple: number | null = null;
  {
    const mins = (t: number) => Math.max(0, 16 * 60 - nyParts(t).minutes);
    const T0 = mins(anchor.t0) / (252 * 390), T1 = mins(input.nowSec) / (252 * 390);
    const isCall = anchor.option.side === "CALL";
    const p0 = bsPrice(isCall, anchor.entry, anchor.option.strike, T0, anchor.iv);
    const p1 = bsPrice(isCall, price, anchor.option.strike, T1, anchor.iv);
    if (p0 > 0.05) optionMultiple = Math.round((p1 / p0) * 10) / 10;
  }

  // ters bacak hazırlanıyor: son 2×5m kapanış EMA20(5m)'nin ters tarafında
  // (ölçüm: bu uyarıda kârın bir kısmını almak, taşımaya göre ort. +0,11 vs −0,02 puan — küçük ama olumlu)
  let counterWarn: string | null = null;
  if (!exit && bars5.length >= 2 && bars5.length - startIdx >= 3) {
    const l2 = bars5.slice(-2);
    const e2 = l2.map((b) => ema5.get(b.time) ?? null);
    if (e2.every((e, k) => e != null && dir * (l2[k].close - e) < 0)) {
      const vNow = s5.vwap[bars5.length - 1];
      const vBroken = vNow != null && dir * (l2[1].close - vNow) < 0;
      counterWarn = `TERS BACAK HAZIRLANIYOR (${nyClock(l2[1].time + 300)}): son 2×5m kapanış EMA20(5m) ${dir > 0 ? "altında" : "üstünde"}${vBroken ? " ve VWAP da kırıldı" : `, VWAP (${vNow != null ? vNow.toFixed(2) : "—"}) henüz tutuyor`}. Kârdaysan bir kısmını al / stopu girişe çek; 15m kapanış ${swingNow != null ? swingNow.toFixed(2) + " " + (dir > 0 ? "altında" : "üstünde") : "VWAP'ın ters tarafında"} olursa bu bacak biter, ters bacak tetiği aranır.`;
    }
  }
  const nl = input.nextLevel ?? null;
  const tgtTxt = targets.map((t, k) => `T${k + 1} ${t.price.toFixed(2)}${t.hitClock ? ` ✓ ${t.hitClock}` : ""}`).join(" · ")
    + (nl ? `${targets.length ? " · " : ""}sıradaki seviye ${nl.price.toFixed(2)} (${nl.label})` : "");
  const lines: string[] = [];
  const watch: string[] = [];
  let title: string;
  let ifNotIn: string | null = null;

  const head = `${anchor.clock} girişi ${anchor.entry.toFixed(2)} → ${exit ? `çıkış ${exit.price.toFixed(2)} (${exit.clock})` : `şimdi ${price.toFixed(2)}`} (${sgn(pnl)} puan${mfe > 0.05 ? `, tepe +${mfe.toFixed(2)}${mfeTime ? ` ${nyClock(mfeTime)}` : ""}` : ""})`;
  const changeTxt = swingNow != null
    ? `TREND DEĞİŞİMİ: 15m kapanış ${swingNow.toFixed(2)} ${dir > 0 ? "altında" : "üstünde"} → çık.`
    : "TREND DEĞİŞİMİ seviyesi: ilk teyitli 15m dip/zirve oluşunca belirlenir (şimdilik VWAP/açılış aralığı).";
  const weakTxt = e15Now != null ? `Zayıflama uyarısı: 15m kapanış EMA20 (${e15Now.toFixed(2)}) ${dir > 0 ? "altında" : "üstünde"}.` : null;

  if (status === "DEĞİŞTİ" && exit) {
    title = `${intraday ? `${anchor.legNo ?? ""}. BACAK BİTTİ` : "SENARYO BOZULDU"} — ${side} (${anchor.clock}) artık geçerli değil`;
    lines.push(head);
    lines.push(`${exit.clock}: ${exit.why}. Çıkış ${exit.price.toFixed(2)} → ${sgn(exit.pnl)} puan.`);
    lines.push("Pozisyon varsa kapat. Yeni bacak tetiği: 2×5m kapanış VWAP + EMA20'nin aynı tarafında VE son 15m kapanış VWAP + EMA20(15m)'nin aynı tarafında.");
  } else if (status === "ZAYIFLIYOR") {
    title = `UYARI — ${side} senaryosu zayıflıyor (15m EMA20 kaybedildi)`;
    lines.push(head);
    lines.push(`15m kapanış ${close15!.toFixed(2)}, EMA20(15m) ${e15Now!.toFixed(2)} ${dir > 0 ? "altında" : "üstünde"}. Trend henüz bozulmadı ama ivme kesiliyor.`);
    lines.push(nHit ? `Hedeflerden ${nHit}'i alındı (${tgtTxt}) — kısmi kâr / stopu yükseltme zamanı.` : `Hedefler: ${tgtTxt || "—"}`);
    watch.push(changeTxt);
    watch.push(`Toparlanma: 15m tekrar EMA20 ${dir > 0 ? "üstüne" : "altına"} kapanırsa senaryo devam eder.`);
  } else if (status === "TREND ONAYLI") {
    title = intraday ? `${side} BACAĞI ONAYLI (${confirmedClock}) — hedefte kâr al, kalanı taşı` : `${side} SENARYOSUNU TAŞI — trend onaylı (${confirmedClock})`;
    lines.push(head);
    lines.push(intraday
      ? "Gün içi bacak onaylandı. Yeni giriş yok (kovalamak FOMO). 1–2 saatlik plan: hedefte kârın çoğunu al; kalanı 15m dip/zirve stopuyla taşı."
      : `Yeni giriş yok: ${dirW} trendde kovalamak FOMO riskidir. Geri çekilmeler (VWAP ${v5 != null ? v5.toFixed(2) : "—"} / EMA20) senaryonun parçasıdır; trend değişimi seviyesi bozulmadıkça elde tut.`);
    lines.push(`Hedefler: ${tgtTxt || "ölçülmüş seviye yok"}${nHit ? " — alınan hedefte kısmi kâr, kalanı taşı" : ""}.`);
    if (extADR != null && extADR >= 0.6) lines.push(`⚠ Fiyat VWAP'tan ${extPts!.toFixed(2)} puan (ortalama gün aralığının %${Math.round(extADR * 100)}'i) uzakta: aşırı uzama, ani geri çekilme riski — kısmi kâr düşün.`);
    watch.push(changeTxt);
    if (weakTxt) watch.push(weakTxt);
    watch.push(nHit ? "Hedef alındıysa koruma: stopu VWAP / son 15m dip-zirvenin arkasına çek." : "Hedefe ulaşmadan stopu gevşetme.");
    // girmediysen
    // geri çekilme bölgesi: fiyata en yakın destek (UP) / direnç (DOWN) ortalaması — 5m EMA20 ve VWAP (trendde sağlıklı geri çekilmeler EMA20'ye uğrar)
    const e5v = bars5.length ? ema5.get(bars5[bars5.length - 1].time) ?? null : null;
    const refs = [v5, e5v].filter((x): x is number => x != null && dir * (price - x) >= 0);
    const zone = refs.length ? (dir > 0 ? Math.max(...refs) : Math.min(...refs)) : null;
    const zoneDist = zone != null ? r2(dir * (price - zone)) : null;
    const near = zoneDist != null && (input.adrAvg ? zoneDist <= 0.1 * input.adrAvg : atr5 ? zoneDist <= 0.8 * atr5 : false);
    const zoneTxt = `${e5v != null ? `EMA20(5m) ${e5v.toFixed(2)}` : ""}${e5v != null && v5 != null ? " / " : ""}${v5 != null ? `VWAP ${v5.toFixed(2)}` : ""}`;
    ifNotIn = near
      ? `Henüz girmediysen: fiyat geri çekilme bölgesinde (${zoneTxt}) — küçük giriş + aynı trend değişimi stopu; hedefler yukarıdaki gibi.`
      : `Henüz girmediysen: KOVALAMA. Fiyat geri çekilme bölgesinden ${zoneDist != null ? zoneDist.toFixed(2) : "—"} puan uzakta (${zoneTxt}); oraya inerse küçük giriş, inmezse bu hareketi kaçırmış say.`;
  } else if (status === "ONAY BEKLENİYOR") {
    title = intraday ? `YENİ ${side} BACAĞI (${anchor.clock}) — tetik geldi, onay 30 dk içinde` : `${side} SENARYOSU AÇIK — trend onayı 10:30'da`;
    lines.push(head);
    lines.push(intraday
      ? `Tetik: 2×5m kapanış VWAP + EMA20 ${dir > 0 ? "üstünde" : "altında"}, 15m kapanış da aynı tarafta. İlk stop: 5m kapanış VWAP (${v5 != null ? v5.toFixed(2) : "—"}) ${dir > 0 ? "altında" : "üstünde"}. Bu bacaklar çoğu zaman kazancı geri veriyor — hedefte kâr al, taşıma.`
      : "Onay koşulu: 09:30'dan beri kapanışların ≥%80'i VWAP'ın " + (dir > 0 ? "üstünde" : "altında") + " ve ≤2 VWAP kesişimi. Onaya kadar pozisyonu küçük tut.");
    lines.push(`Hedefler: ${tgtTxt || "ölçülmüş seviye yok"}.`);
    watch.push(changeTxt);
    if (weakTxt) watch.push(weakTxt);
  } else {
    title = intraday ? `${side} BACAĞI açık ama ONAYSIZ — hedefte çık` : `${side} SENARYOSU açık ama TREND ONAYSIZ — taşıma, hedefte çık`;
    lines.push(head);
    lines.push("Fiyat VWAP etrafında gidip geliyor (trend onayı yok). Ölçümde onaysız günlerde taşımak ort. −0,38 puan kaybettirdi: ilk hedefte kâr al, uzatma.");
    lines.push(`Hedefler: ${tgtTxt || "ölçülmüş seviye yok"}.`);
    watch.push(changeTxt);
    watch.push(`Trend onayı sonradan gelirse (≥%80 ${dir > 0 ? "VWAP üstü" : "VWAP altı"}, ≤2 kesişim) taşıma moduna geçilir.`);
  }

  // açılış bacağında ilk 2–3 saat güveni DÜŞÜK/ORTA ise "taşı" yerine "hedefte kâr al"
  if (!intraday && anchor.dayHold && status !== "DEĞİŞTİ") {
    lines.splice(1, 0, `İlk 2–3 saat güveni ${anchor.dayHold.level}: ${anchor.dayHold.text}`);
    if (anchor.dayHold.level !== "YÜKSEK" && status === "TREND ONAYLI") {
      title = `${side} SENARYOSU ONAYLI ama açılış güveni ${anchor.dayHold.level} — hedefte kârın çoğunu al`;
      for (let k = lines.length - 1; k >= 0; k--) if (lines[k].includes("elde tut")) lines[k] = "Yeni giriş yok (FOMO). Açılış kararı teyitsiz olduğu için taşıma yerine hedefte kârın çoğunu al; kalanını trend değişimi stopuyla tut.";
    }
  }
  // açılış bacağının hedef ufku 2–3 saat: sonrası seans içinde yeniden yön okunur
  if (!intraday && status !== "DEĞİŞTİ" && input.nowSec - anchor.t0 >= 3 * 3600) {
    lines.splice(1, 0, "⏱ Açılış senaryosunun 2–3 saatlik ufku doldu: kalan kârı koru (stop: trend değişimi seviyesi); yeni yön kararı gün içi bacak tetiklerinden gelir.");
  }
  if (counterWarn) {
    for (let k = lines.length - 1; k >= 0; k--) if (lines[k].includes("elde tut") || lines[k].startsWith("Gün içi bacak onaylandı")) lines.splice(k, 1);
    lines.splice(1, 0, `⚠ ${counterWarn}`);
    // uyarı varken "taşı / girmediysen gir" demek çelişir
    title = `⚠ ${side} ${intraday ? "BACAĞI" : "SENARYOSU"} — TERS BACAK HAZIRLANIYOR: kârın bir kısmını al, stopu girişe çek`;
    ifNotIn = null;
  }
  return {
    status, anchor, price, pnl, pnlPct: r2((pnl / anchor.entry) * 100), mfe: r2(mfe),
    mfeClock: mfeTime ? nyClock(mfeTime) : null, targets, confirmedClock, exit, rules,
    title, lines, watch, ifNotIn, optionMultiple, extensionPts: extPts, extensionADR: extADR, nextLevel: nl, counterWarn,
  };
}

/**
 * 0DTE opsiyon katı tahmini için IV: son seansların GERÇEKLEŞEN 5m volatilitesi (+%15 prim).
 * VIX (30 günlük) bugün vadeli opsiyonu şişiriyordu: 5 Ekim'de VIX 16 ↔ gerçekleşen %5–10;
 * VIX/100 ile 770 call tahmini 1,7x, gerçekleşen ~3,6x idi. [%8, %22] aralığına sıkıştırılır.
 */
export function realizedIV(bars5: Bar[], beforeSec: number): number {
  const rth = bars5.filter((b) => b.time < beforeSec && nyParts(b.time).minutes >= 570 && nyParts(b.time).minutes < 960);
  const last = rth.slice(-78 * 3);
  if (last.length < 30) return 0.14;
  let ss = 0, n = 0;
  for (let i = 1; i < last.length; i++) {
    if (last[i].time - last[i - 1].time !== 300) continue; // gün/boşluk sınırı
    const r = Math.log(last[i].close / last[i - 1].close);
    ss += r * r;
    n++;
  }
  if (!n) return 0.14;
  const ann = Math.sqrt(ss / n) * Math.sqrt(252 * 78);
  return Math.min(0.22, Math.max(0.08, Math.round(ann * 1.15 * 1000) / 1000));
}

// ── Bacak zinciri: açılış senaryosu + gün içi yeni bacaklar (katalizör / dönüş) ──

export interface LegSummary {
  anchor: Anchor;
  /** Bacak bittiyse çıkış */
  exit: TrackState["exit"];
  status: TrackStatus;
  mfe: number;
  targetsHit: number;
}

export interface PendingTrigger {
  dir: Dir;
  /** Sağlanan / eksik tetik koşulları (seviyeleriyle) */
  have: string[];
  need: string[];
  text: string;
}

/** Aktif bacağa TERS tetik (erken uyarı — bacağı otomatik bitirmez) */
export interface CounterTrigger {
  dir: Dir;
  level: "ERKEN" | "TAM";
  clock: string;
  price: number;
  /** TAM teyit için gereken 15m kapanış seviyesi (ERKEN'de) */
  confirmLevel: number | null;
  text: string;
}

export interface LegChain {
  legs: LegSummary[];
  /** Aktif bacağa ters tetik oluştu mu (son kapanmış 5m mumda) */
  counter: CounterTrigger | null;
  /** Güncel (son) bacağın takibi — yoksa null */
  current: TrackState | null;
  /** Aktif bacak yokken (ya da bacak biterken) oluşan tetik hazırlığı */
  pending: PendingTrigger | null;
}

const LEG_START_MIN = 10 * 60; // gün içi bacak taraması 10:00 kapanışından sonra
const LEG_LAST_MIN = 15 * 60; // 15:00'ten sonra yeni bacak açılmaz (0DTE zamanı yetmez)
const SAME_DIR_GAP = 6; // aynı yönde yeni bacak için önceki çıkıştan sonra ≥30 dk

function sliceDay(s: DaySeries, upToEnd: number, tf: number): DaySeries {
  const n = s.bars.filter((b) => b.time + tf <= upToEnd).length;
  return { bars: s.bars.slice(0, n), vwap: s.vwap.slice(0, n) };
}

/** 5m tarafı: kapanış VWAP ve EMA20(5m)'nin aynı tarafındaysa ±1 */
function side5(s5: DaySeries, ema5: EmaMap, i: number): number {
  const b = s5.bars[i], v = s5.vwap[i], e = ema5.get(b.time);
  if (v == null || e == null) return 0;
  return b.close > v && b.close > e ? 1 : b.close < v && b.close < e ? -1 : 0;
}

/**
 * Günün bacaklarını KAPANMIŞ mumlardan yeniden oynatır (deterministik):
 *   1. bacak = açılış çapası (varsa).
 *   Bacak bitince (ya da sabah yön yoksa 10:00'dan sonra) yeni bacak tetiği:
 *   2×5m kapanış VWAP + EMA20(5m)'nin aynı tarafında VE son 15m kapanış VWAP + EMA20(15m)'nin aynı tarafında.
 * Ölçüm (58 seans, 5m): bu tetiklerin ort. tepesi +1,3 puan, ama hedefte çıkılmazsa ortalama ~0 —
 * bu yüzden gün içi bacaklar "hedefte kâr al" planıdır, taşıma planı değil.
 */
export function buildLegChain(input: {
  date: string;
  first: Anchor | null;
  s5: DaySeries;
  s15: DaySeries;
  ema5: EmaMap;
  ema15: EmaMap;
  price: number;
  atr5: number | null;
  vix: number | null;
  nowSec: number;
  /** Bacak hedefleri için ölçülmüş seviyeler (gün zirvesi/dibi HARİÇ — tetik anına kadarki uçlar ayrıca eklenir) */
  levels: { price: number; label: string }[];
  iv: number;
  /** "Sıradaki seviye" için güncel ölçülmüş seviyeler (gün zirvesi/dibi dahil olabilir) */
  nextLevels?: { price: number; label: string }[];
  adrAvg?: number | null;
  /** 15m teyidi: "or" = 15m kapanış VWAP VEYA EMA20(15m) yön tarafında (erken) · "and" = ikisi birden */
  trig15?: "and" | "or";
  /** Aktif bacağa TERS tam tetik gelince bacağı kapatıp ters bacağı hemen aç (dönüşü erken yakala) */
  flip?: boolean;
  /** Gün içi bacak ilk stopu: "vwap" = 5m kapanış VWAP ters · "trig" = tetik mumlarının dibi/tepesi */
  stopMode?: "vwap" | "trig";
  /** Aynı yönde yeni bacak için önceki çıkıştan sonra beklenecek 5m mum sayısı */
  sameDirGap?: number;
}): LegChain {
  const { s5, s15, ema5, ema15 } = input;
  const legs: LegSummary[] = [];
  const nextFor = (a: Anchor, price: number) => {
    const sg = a.dir === "UP" ? 1 : -1;
    return (input.nextLevels ?? []).filter((l) => sg * (l.price - price) >= 0.5).sort((x, y) => sg * (x.price - y.price))[0] ?? null;
  };
  const track = (a: Anchor, endSec: number, price: number, last: boolean): TrackState =>
    trackScenario({
      anchor: a, s5: sliceDay(s5, endSec, 300), s15: sliceDay(s15, endSec, 900), ema15, ema5,
      price, atr5: input.atr5, vix: input.vix, nowSec: endSec,
      nextLevel: last ? nextFor(a, price) : null, adrAvg: input.adrAvg ?? null,
    });

  // Varsayılanlar 58 seans ölçümünün en iyisi (tüm bacaklar T1'de çıkış +17,4):
  //   "or" 15m teyidi ~aynı (+20,4, yarılar dengesiz) · ters tetikte otomatik bacak değiştirme +6,3
  //   (açılış bacaklarını erken kesiyor) · tetik mumu stopu −1,1. Bu yüzden ters tetik yalnız UYARI.
  const trig15 = input.trig15 ?? "and";
  const flip = input.flip ?? false;
  const ok15 = (k: number, sd: number, mode: "and" | "or" = trig15) => {
    const b = s15.bars[k], v = s15.vwap[k], e = ema15.get(b.time);
    if (!b || v == null || e == null) return false;
    const a = sd * (b.close - v) > 0, c = sd * (b.close - e) > 0;
    return mode === "and" ? a && c : a || c;
  };
  /** i. 5m kapanışında tetik yönü (±1) ya da 0 */
  const triggerAt = (i: number, end: number, mode: "and" | "or" = trig15): number => {
    if (i < 1) return 0;
    const sd = side5(s5, ema5, i);
    if (!sd || side5(s5, ema5, i - 1) !== sd) return 0;
    const k = s15.bars.filter((b) => b.time + 900 <= end).length - 1;
    return k >= 0 && ok15(k, sd, mode) ? sd : 0;
  };
  let cur: Anchor | null = input.first;
  let curDone = false;
  let lastExitIdx = -99, lastExitDir = 0;
  const n = s5.bars.length;
  const firstIdx = cur ? s5.bars.findIndex((b) => b.time + 300 > cur!.t0) : -1;

  for (let i = 0; i < n; i++) {
    const end = s5.bars[i].time + 300;
    const mins = nyParts(end).minutes;
    // aktif bacak: bu mumda bitti mi?
    if (cur && !curDone) {
      if (end <= cur.t0) continue;
      const st = track(cur, end, s5.bars[i].close, false);
      const cd = cur.dir === "UP" ? 1 : -1;
      if (st.exit) {
        legs.push({ anchor: cur, exit: st.exit, status: "DEĞİŞTİ", mfe: st.mfe, targetsHit: st.targets.filter((t) => t.hitClock).length });
        curDone = true;
        lastExitIdx = i;
        lastExitDir = cd;
        continue;
      }
      // ters tam tetik: bacak 15m dip/zirve kırılımını beklemeden kapanır, ters bacak bu mumda açılır
      if (flip && mins >= LEG_START_MIN && mins <= LEG_LAST_MIN && triggerAt(i, end) === -cd) {
        const c = s5.bars[i].close;
        legs.push({
          anchor: cur, status: "DEĞİŞTİ", mfe: st.mfe, targetsHit: st.targets.filter((t) => t.hitClock).length,
          exit: { clock: nyClock(end), price: r2(c), pnl: r2(cd * (c - cur.entry)), why: "ters bacak tetiği (2×5m VWAP + EMA20 ve 15m ters tarafta) → bacak kapandı, ters bacak açıldı" },
        });
        curDone = true;
        lastExitIdx = i;
        lastExitDir = cd;
        // düşmeden aşağıdaki tetik bloğuna geç (aynı mumda ters bacak)
      } else {
        continue;
      }
    }
    // yeni bacak tetiği
    if (mins < LEG_START_MIN || mins > LEG_LAST_MIN || i < 1) continue;
    if (cur && !curDone) continue;
    if (!cur && firstIdx >= 0 && i < firstIdx) continue;
    const sd = triggerAt(i, end);
    if (!sd) continue;
    if (sd === lastExitDir && i - lastExitIdx < (input.sameDirGap ?? SAME_DIR_GAP)) continue;
    if (i === lastExitIdx && sd === lastExitDir) continue;
    if (triggerAt(i, end) !== sd) continue;
    const dir: Dir = sd > 0 ? "UP" : "DOWN";
    const entry = s5.bars[i].close;
    const sofar = s5.bars.slice(0, i + 1);
    const hi = Math.max(...sofar.map((b) => b.high)), lo = Math.min(...sofar.map((b) => b.low));
    const lv = [...input.levels, { price: hi, label: "Gün zirvesi (tetik anına kadar)" }, { price: lo, label: "Gün dibi (tetik anına kadar)" }];
    const tg = pickTargets(dir, entry, lv, lv);
    const targets = tg.length ? tg : [{ price: r2(entry + sd * 1.5), label: "+1,5 puan (ölçülmüş seviye yok)" }];
    cur = {
      date: input.date, dir, t0: end, clock: nyClock(end), entry, decidedAt: nyClock(end), strength: null, weak: false,
      kind: "GÜN İÇİ", legNo: legs.length + 1, targets, option: optionFor(dir, entry), iv: input.iv,
      initStop: (input.stopMode ?? "vwap") === "trig"
        ? r2(sd > 0 ? Math.min(s5.bars[i].low, s5.bars[i - 1].low) - 0.01 : Math.max(s5.bars[i].high, s5.bars[i - 1].high) + 0.01)
        : null,
    };
    curDone = false;
  }

  // aktif bacağa ters tetik (son kapanmış 5m mumda) — bacak 15m kuralıyla biter, bu yalnız erken uyarı
  let counter: CounterTrigger | null = null;
  if (cur && !curDone && n >= 2) {
    const i = n - 1, end = s5.bars[i].time + 300, mm = nyParts(end).minutes;
    const cd = cur.dir === "UP" ? 1 : -1;
    if (end > cur.t0 && mm >= LEG_START_MIN && mm <= LEG_LAST_MIN) {
      const full = triggerAt(i, end, "and") === -cd;
      const early = !full && triggerAt(i, end, "or") === -cd;
      if (full || early) {
        const k = s15.bars.length - 1;
        const v15 = k >= 0 ? s15.vwap[k] : null, e15 = k >= 0 ? ema15.get(s15.bars[k].time) ?? null : null;
        const conf = v15 != null && e15 != null ? r2(-cd > 0 ? Math.max(v15, e15) : Math.min(v15, e15)) : null;
        const nd: Dir = cd > 0 ? "DOWN" : "UP";
        const nw = nd === "UP" ? "LONG ▲" : "SHORT ▼";
        const c = s5.bars[i].close;
        counter = {
          dir: nd, level: full ? "TAM" : "ERKEN", clock: nyClock(end), price: r2(c), confirmLevel: full ? null : conf,
          text: full
            ? `⚡ TERS TETİK (TAM, ${nyClock(end)}): 2×5m VWAP + EMA20 ve 15m VWAP + EMA20(15m) ${nd === "UP" ? "üstünde" : "altında"} → ${nw} dönüşü. Mevcut bacakta kârı al / stopu girişe çek. Ters yönde küçük pozisyon mümkün: geçmişte bu anda girmek ilk hedefte ort. +0,14 puan, tepe +1,3 (23 olay, %39). Mevcut bacak 15m dip/zirve kırılınca resmen biter.`
            : `⚡ TERS TETİK (ERKEN, ${nyClock(end)}): 2×5m VWAP + EMA20 ${nd === "UP" ? "üstünde" : "altında"}, 15m yalnız kısmen teyitli → ${nw} dönüşü başlıyor olabilir. Mevcut bacakta kârı koru (stop girişe). Ters yönde giriş için ERKEN: geçmişte bu anda girmek ort. ~0 (34 olay, %29). Teyit: 15m kapanış ${conf != null ? conf.toFixed(2) : "VWAP + EMA20(15m)"} ${nd === "UP" ? "üstünde" : "altında"}.`,
        };
      }
    }
  }

  // güncel bacak
  let current: TrackState | null = null;
  if (cur && !curDone) {
    current = track(cur, input.nowSec, input.price, true);
    legs.push({ anchor: cur, exit: current.exit, status: current.status, mfe: current.mfe, targetsHit: current.targets.filter((t) => t.hitClock).length });
  } else if (cur && curDone) {
    current = track(cur, input.nowSec, input.price, true);
  }

  // tetik hazırlığı: aktif bacak yokken (ya da biterken) son 5m'ler
  let pending: PendingTrigger | null = null;
  const nowMin = n ? nyParts(s5.bars[n - 1].time + 300).minutes : 0;
  const noActive = !cur || curDone;
  const activeDir = cur && !curDone ? (cur.dir === "UP" ? 1 : -1) : 0;
  if (n >= 2 && nowMin >= 9 * 60 + 45 && nowMin <= LEG_LAST_MIN) {
    const last = s5.bars[n - 1], v = s5.vwap[n - 1], e = ema5.get(last.time) ?? null;
    if (v != null && e != null) {
      const cand = last.close > e ? 1 : last.close < e ? -1 : 0;
      if (cand && (noActive || cand === -activeDir)) {
        const w = cand > 0 ? "üstünde" : "altında";
        const have: string[] = [], need: string[] = [];
        const prev = s5.bars[n - 2], pe = ema5.get(prev.time) ?? null, pv = s5.vwap[n - 2];
        const both = (b: Bar, vv: number | null, ee: number | null) => vv != null && ee != null && cand * (b.close - vv) > 0 && cand * (b.close - ee) > 0;
        const c1 = both(last, v, e), c0 = both(prev, pv, pe);
        (c1 && c0 ? have : need).push(`2×5m kapanış VWAP (${v.toFixed(2)}) + EMA20 (${e.toFixed(2)}) ${w}${c1 && !c0 ? " — 1/2 tamam, bir kapanış daha" : ""}`);
        const k = s15.bars.length - 1;
        if (k >= 0) {
          const b15 = s15.bars[k], v15 = s15.vwap[k], e15 = ema15.get(b15.time) ?? null;
          const lvl = v15 != null && e15 != null ? (cand > 0 ? Math.max(v15, e15) : Math.min(v15, e15)) : null;
          const lvlOr = v15 != null && e15 != null ? (cand > 0 ? Math.min(v15, e15) : Math.max(v15, e15)) : null;
          (ok15(k, cand) ? have : need).push(trig15 === "or"
            ? `15m kapanış VWAP ya da EMA20(15m) ${w}${lvlOr != null ? ` (${lvlOr.toFixed(2)})` : ""}`
            : `15m kapanış VWAP + EMA20(15m) ${w}${lvl != null ? ` (${lvl.toFixed(2)})` : ""}`);
        }
        if (need.length && (c1 || ok15(Math.max(0, s15.bars.length - 1), cand))) {
          const dirW = cand > 0 ? "LONG (yukarı)" : "SHORT (aşağı)";
          pending = {
            dir: cand > 0 ? "UP" : "DOWN", have, need,
            text: `${activeDir ? "TERS " : ""}${dirW} BACAK TETİĞİ HAZIRLANIYOR — eksik: ${need.join(" · ")}.`,
          };
        }
      }
    }
  }
  return { legs, current, pending, counter };
}
