/**
 * SPY Engine — TEK KARAR MERDİVENİ (saf, izomorfik — DOM/ağ yok).
 *
 * Sayfadaki tek yön/durum kaynağı budur. Diğer kartlar (VWAP, EMA20, hacim,
 * akış, pivot, açılış aşamaları) yalnızca GEREKÇE gösterir, karar vermez.
 *
 * Ölçümle seçilen yapı (60 günlük 5m arşiv, 3 ayrı dönemde de pozitif — bkz. CALIBRATION):
 *   1) İZİN = SEANS PLANI (gün içi akışın en tutarlı ölçülen kısmı)
 *      · AÇILIŞ  (10:00–14:00): 09:55/10:00 NET açılış yönü — açılış aralığının karşı ucu kapanışla kırılırsa biter
 *      · ÖĞLEN   (10:30–14:00, açılış yönü yoksa/bittiyse): VWAP'tan ≥ k×ATR5 uzaklaşan fiyatta VWAP'a dönüş
 *      · KAPANIŞ (14:00–15:30): fiyat VWAP ve POC'un aynı tarafındaysa o yön
 *   2) ERKEN UYARI (5m): izin yönünde geri çekilme VWAP/EMA20'ye geldi ya da öğlen uzaması doldu — emri hazırla
 *   3) TETİK (5m kapanmış mum): gövdeli mum (gövde ≥ %30, kapanış iyi tarafta) + hacim ≥ önceki 3 mumun ortalaması
 *      · trend modlarında kapanış VWAP ve EMA20'nin doğru tarafında · öğlen modunda kapanış VWAP'a doğru dönmüş
 *   4) RİSK: stop = son 3 mumun ucu ± 0,1 ATR (≤ 2 ATR) · hedef 2R (öğlende VWAP) · günde ≤ 4 deneme · 15:30 sonrası yok
 *
 * Ekran durumu her an şu merdivenden biridir:
 *   İŞLEM YOK · İZLE · ERKEN UYARI · TETİK · TERS UYARI · İPTAL
 *
 * Yalnızca KAPANMIŞ mumlar kullanılır; gün her çağrıda baştan oynatılır
 * (deterministik — sayfa gün ortasında açılsa da aynı sonuç).
 *
 * CALIBRATION (2026-10-09, SPY 5m, 59 seans 07-17 → 10-08, spot fiyat, opsiyon spread'i hariç):
 *   600 rastgele ayar ilk 39 günde tarandı; seçilen ayar son 20 günde (görülmemiş) +12,4R.
 *   Tüm dönem: 125 işlem (2,1/gün), %43 kazanç, ort. +0,29R, toplam +36R.
 *   Üç dönem ayrı ayrı: +12,7R / +10,0R / +13,4R. Mod bazında: AÇILIŞ +12,5R (37), ÖĞLEN +24,6R (48),
 *   KAPANIŞ −1,0R (40 — kenar yok, bilgi için açık bırakıldı). Komşu ayarların hepsi pozitif (+25…+45R).
 */

import { nyParts, nyClock, r2, type Bar } from "./core";
import { openingRegime, type DaySeries, type EmaMap, type CandleComment, type Tone, type OpeningRegime } from "./openingMap";
import { volumeProfile } from "./flow";
import { detectCandlePatterns } from "./candlePatterns";

// ── Eşikler (kalibre edilmiş) ────────────────────────────────────────

export const LADDER_CFG = {
  rvolDays: 20,
  plan: {
    /** açılış yönünün geçerli olduğu son dakika (14:00) */
    openEnd: 14 * 60,
    /** öğlen VWAP'a dönüş penceresi */
    fadeStart: 10 * 60 + 30,
    fadeEnd: 14 * 60,
    /** öğlen: |fiyat − VWAP| ≥ k × ATR5 */
    fadeK: 1.0,
    /** kapanış modu başlangıcı */
    closeStart: 14 * 60,
    /** açılış aralığı (kırılma kontrolü): ilk N adet 5m */
    orBars: 3,
  },
  trig: {
    minBodyFrac: 0.3,
    /** kapanış mumun iyi tarafında (CALL: aralığın ≥ %55'inde) */
    closeTop: 0.55,
    /** hacim ≥ önceki 3 mumun ortalaması × */
    volRatio: 1.0,
  },
  warn: {
    /** trend modlarında geri çekilme VWAP/EMA20'ye bu kadar ATR5 yaklaşınca */
    nearAtr: 0.5,
    /** öğlende uzama eşiğinin bu oranına gelince */
    fadePre: 0.75,
  },
  reverse: {
    crossRvol: 1.5,
    sweepAtr: 0.1,
    sweepWithinBars: 2,
    exhaustRvol: 3.0,
    lifeBars: 2,
  },
  risk: {
    stopPadAtr: 0.1,
    minStopPts: 0.15,
    maxStopAtr: 2.0,
    rr: 2.0,
    /** öğlen modunda hedef VWAP (en az 0,8R uzakta olmalı) */
    fadeMinR: 0.8,
    maxAttempts: 4,
    cooldownBars: 3,
    firstEntryMin: 10 * 60,
    lastEntryMin: 15 * 60 + 30,
    exitMin: 15 * 60 + 50,
  },
};

const C = LADDER_CFG;
const OPEN_MIN = 9 * 60 + 30;

// ── RVOL tabanı ──────────────────────────────────────────────────────

export interface RvolBase {
  /** 09:30'dan itibaren 78 dilim: aynı saatteki 5m mumların ortalama hacmi */
  slot: number[];
  /** aynı saate kadar ortalama TOPLAM hacim (dilim sonunda) */
  cum: number[];
  days: number;
}

/** `date`'ten ÖNCEKİ son `days` tam RTH seansından aynı-saat hacim ortalamaları */
export function rvolBaseline(bars5: Bar[], date: string, days = C.rvolDays): RvolBase | null {
  const byDay = new Map<string, number[]>();
  for (const b of bars5) {
    const p = nyParts(b.time);
    if (p.ymd >= date || p.weekday === 0 || p.weekday === 6) continue;
    if (p.minutes < OPEN_MIN || p.minutes >= 16 * 60) continue;
    const k = (p.minutes - OPEN_MIN) / 5;
    if (!Number.isInteger(k)) continue;
    const arr = byDay.get(p.ymd) ?? new Array(78).fill(NaN);
    arr[k] = b.volume || 0;
    byDay.set(p.ymd, arr);
  }
  const full = Array.from(byDay.entries())
    .filter(([, a]) => a.filter((v) => Number.isFinite(v)).length >= 70)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([, a]) => a);
  if (full.length < 5) return null;
  const slot = new Array(78).fill(0).map((_, k) => {
    const xs = full.map((a) => a[k]).filter((v) => Number.isFinite(v));
    return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
  });
  const cumDays = full.map((a) => {
    let s = 0;
    return a.map((v) => (s += Number.isFinite(v) ? v : 0));
  });
  const cum = new Array(78).fill(0).map((_, k) => cumDays.reduce((s, a) => s + a[k], 0) / cumDays.length);
  return { slot, cum, days: full.length };
}

const slotOf = (t: number) => Math.round((nyParts(t).minutes - OPEN_MIN) / 5);

export function rvolText(r: number | null): string {
  if (r == null) return "RVOL verisi yok";
  if (r < 0.8) return "zayıf ilgi — hareket kolay geri döner";
  if (r < 1.2) return "normal — tek başına bir şey söylemez";
  if (r < 1.5) return "hacim hareketi destekliyor";
  if (r <= 3) return "güçlü ilgi — kurumsal katılım olasılığı yüksek";
  return "aşırı — haber ya da tükenme olabilir, dikkat";
}

// ── Tipler ───────────────────────────────────────────────────────────

export type Permission = "CALL" | "PUT" | "NÖTR";
export type PlanMode = "AÇILIŞ TOPLANIYOR" | "AÇILIŞ YÖNÜ" | "ÖĞLEN DÖNÜŞ" | "KAPANIŞ YÖNÜ" | "BEKLE";
export type LadderStatus = "İŞLEM YOK" | "İZLE" | "ERKEN UYARI" | "TETİK" | "TERS UYARI" | "İPTAL";

export interface Cond {
  key: string;
  label: string;
  ok: boolean;
  value: string;
  required: boolean;
}

export interface RegimeRead {
  permission: Permission;
  mode: PlanMode;
  /** Modun tek cümlelik gerekçesi */
  modeText: string;
  /** Seans planının koşulları (kanıt) */
  conds: Cond[];
  vwap: number | null;
  poc: number | null;
  atr5: number | null;
  /** fiyat − VWAP, ATR5 cinsinden */
  devAtr: number | null;
  /** öğlen dönüş eşikleri (VWAP ± k×ATR5) */
  fadeUp: number | null;
  fadeDn: number | null;
  opening: { label: string; side: string | null; net: boolean; decidedAt: string | null; orHigh: number | null; orLow: number | null; broken: boolean } | null;
  crosses: number;
  dayRvol: number | null;
}

export interface Plan {
  side: "CALL" | "PUT";
  entry: number;
  stop: number;
  target: number;
  targetLabel: string;
  stopAtr: number;
  setup: string;
}

export interface Attempt {
  side: "CALL" | "PUT";
  mode: PlanMode;
  setup: string;
  clock: string;
  time: number;
  entry: number;
  stop: number;
  target: number;
  exitClock: string | null;
  exit: number | null;
  result: "KÂR" | "ZARAR" | "ZAMAN" | null;
  r: number | null;
  mfe: number;
}

export interface LadderStep {
  time: number;
  clock: string;
  status: LadderStatus;
  side: "CALL" | "PUT" | null;
  message: string;
  change: string;
  regime: RegimeRead;
  warnSigns: Cond[] | null;
  trigConds: Cond[] | null;
  reverse: string[];
  plan: Plan | null;
  rvol: number | null;
  dayRvol: number | null;
  localRatio: number | null;
}

export interface LadderRead {
  date: string;
  steps: LadderStep[];
  current: LadderStep | null;
  attempts: Attempt[];
  base: RvolBase | null;
  or: { high: number; low: number } | null;
  opening: OpeningRegime | null;
}

export interface LadderInput {
  date: string;
  /** Bugünün kapanmış RTH 5m / 15m / 30m mumları + 09:30 ankrajlı VWAP */
  s5: DaySeries;
  s15: DaySeries;
  s30: DaySeries;
  ema5: EmaMap;
  ema15: EmaMap;
  atr5: Map<number, number>;
  atr15: Map<number, number>;
  rvol: RvolBase | null;
  prevClose: number | null;
  staticLevels: { price: number; label: string }[];
}

// ── Yardımcılar ──────────────────────────────────────────────────────

const f2 = (n: number) => n.toFixed(2);
const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const word = (d: 1 | -1) => (d > 0 ? "CALL" : "PUT");
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function cut(s: DaySeries, endSec: number, span: number): DaySeries {
  const idx = s.bars.findIndex((b) => b.time + span > endSec);
  const n = idx < 0 ? s.bars.length : idx;
  return { bars: s.bars.slice(0, n), vwap: s.vwap.slice(0, n) };
}

function crossesIn(s5: DaySeries, from: number, to: number): number {
  let prev = 0, c = 0;
  for (let j = Math.max(0, from); j <= to; j++) {
    const v = s5.vwap[j];
    if (v == null) continue;
    const s = Math.sign(s5.bars[j].close - v);
    if (s && prev && s !== prev) c++;
    if (s) prev = s;
  }
  return c;
}

// ── Ana oynatma ──────────────────────────────────────────────────────

export function ladderRead(inp: LadderInput): LadderRead {
  const { s5, ema5, atr5, rvol, date } = inp;
  const bars = s5.bars;
  const n = bars.length;
  const steps: LadderStep[] = [];
  const attempts: Attempt[] = [];

  const orN = C.plan.orBars;
  const orHi = n >= orN ? Math.max(...bars.slice(0, orN).map((b) => b.high)) : null;
  const orLo = n >= orN ? Math.min(...bars.slice(0, orN).map((b) => b.low)) : null;
  const or30 = n >= 6 ? { high: Math.max(...bars.slice(0, 6).map((b) => b.high)), low: Math.min(...bars.slice(0, 6).map((b) => b.low)) } : null;

  let opening: OpeningRegime | null = null;
  let openingProvisional: OpeningRegime | null = null;
  let broken = false;
  let pos: { att: Attempt; d: 1 | -1; stop: number; target: number; risk: number } | null = null;
  let cooldownUntil = -1;
  let reverseUntil = -1;
  let reverseWhy: string[] = [];
  const sweptFlag = new Set<number>();
  let cum = 0;

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const end = b.time + 300;
    const endMin = nyParts(b.time).minutes + 5;
    const clock = nyClock(end);
    const vw = s5.vwap[i] ?? b.close;
    const A5 = atr5.get(b.time) ?? null;
    const e5 = ema5.get(b.time) ?? null;
    const slot = slotOf(b.time);
    cum += b.volume || 0;
    const rv = rvol && rvol.slot[slot] > 0 ? (b.volume || 0) / rvol.slot[slot] : null;
    const dayRv = rvol && rvol.cum[slot] > 0 ? cum / rvol.cum[slot] : null;
    const prevVols = bars.slice(Math.max(0, i - 3), i).map((x) => x.volume || 0);
    const pv = prevVols.length ? mean(prevVols) : 0;
    const local = pv > 0 ? (b.volume || 0) / pv : null;
    const rg = b.high - b.low;
    const body = Math.abs(b.close - b.open);
    const closePos = rg > 0 ? (b.close - b.low) / rg : 0.5;
    const prof = volumeProfile(bars.slice(0, i + 1));
    const poc = prof?.poc ?? null;
    const crosses = crossesIn(s5, i - 23, i);

    // ── açılış okuması (09:55 / 10:00 kilidi) ──
    if (endMin <= 10 * 60) {
      const op = openingRegime(cut(s5, end, 300), cut(inp.s15, end, 900), ema5, cut(inp.s30, end, 1800), null, inp.prevClose);
      openingProvisional = op;
      if (endMin === 10 * 60) opening = op;
    }

    // ── seans planı: izin ──
    let permission: Permission = "NÖTR";
    let mode: PlanMode = "BEKLE";
    let modeText = "";
    const conds: Cond[] = [];
    const opD: 1 | -1 | 0 = opening && opening.net && (opening.side === "UP" || opening.side === "DOWN") ? (opening.side === "UP" ? 1 : -1) : 0;
    if (opD && orHi != null && orLo != null && !broken && (opD > 0 ? b.close < orLo : b.close > orHi)) broken = true;
    const dev = b.close - vw;
    const devAtr = A5 ? dev / A5 : null;

    if (endMin < 10 * 60) {
      mode = "AÇILIŞ TOPLANIYOR";
      const op = openingProvisional;
      modeText = op ? `Açılış okuması: ${op.label} — karar 09:55 / 10:00'da` : "09:30–10:00 açılış aşamaları toplanıyor";
    } else if (opD && endMin < C.plan.openEnd && !broken) {
      permission = word(opD);
      mode = "AÇILIŞ YÖNÜ";
      modeText = `${opening!.decidedAt} NET açılış yönü ${opD > 0 ? "yukarı" : "aşağı"} — açılış aralığı ${opD > 0 ? `dibi ${f2(orLo!)}` : `tepesi ${f2(orHi!)}`} kapanışla kırılana kadar (en geç 14:00)`;
    } else if (endMin >= C.plan.fadeStart && endMin < C.plan.fadeEnd && devAtr != null && Math.abs(devAtr) >= C.plan.fadeK) {
      permission = dev > 0 ? "PUT" : "CALL";
      mode = "ÖĞLEN DÖNÜŞ";
      modeText = `Öğlen: fiyat VWAP'tan ${sgn(devAtr)} ATR uzakta (eşik ±${C.plan.fadeK}) — VWAP ${f2(vw)}'a dönüş`;
    } else if (endMin >= C.plan.closeStart && poc != null && Math.sign(b.close - vw) === Math.sign(b.close - poc) && b.close !== vw) {
      permission = b.close > vw ? "CALL" : "PUT";
      mode = "KAPANIŞ YÖNÜ";
      modeText = `Kapanış saatleri: fiyat VWAP (${f2(vw)}) ve POC'un (${f2(poc)}) ${b.close > vw ? "üstünde" : "altında"}`;
    } else {
      modeText = endMin < C.plan.fadeStart
        ? (opening && !opening.net ? `Açılış NET değil (${opening.label}) — 10:30'dan sonra öğlen dönüşü aranır` : broken ? "Açılış yönü açılış aralığının karşı ucunun kırılmasıyla bitti — 10:30'dan sonra öğlen dönüşü aranır" : "Açılış kararı bekleniyor")
        : endMin < C.plan.fadeEnd
          ? `Öğlen: fiyat VWAP'a yakın (${devAtr != null ? sgn(devAtr) : "—"} ATR, eşik ±${C.plan.fadeK}) — dönüş için uzama yok`
          : `Kapanış saatleri: fiyat VWAP ile POC arasında (${f2(vw)} / ${poc != null ? f2(poc) : "—"}) — yön yok`;
    }
    conds.push(
      { key: "p1", required: false, label: "09:55/10:00 NET açılış yönü (ilk 2–3 saat)", ok: mode === "AÇILIŞ YÖNÜ", value: opening ? `${opening.label}${opening.net ? " · NET" : " · net değil"}${broken ? " · aralık kırıldı (bitti)" : ""}` : openingProvisional ? `ön okuma: ${openingProvisional.label}` : "—" },
      { key: "p2", required: false, label: `Öğlen (10:30–14:00): VWAP'tan ≥ ${C.plan.fadeK} ATR uzama → VWAP'a dönüş`, ok: mode === "ÖĞLEN DÖNÜŞ", value: devAtr != null ? `${sgn(dev)} (${sgn(devAtr)} ATR)` : "—" },
      { key: "p3", required: false, label: "14:00 sonrası: VWAP ve POC aynı tarafta", ok: mode === "KAPANIŞ YÖNÜ", value: `VWAP ${f2(vw)} · POC ${poc != null ? f2(poc) : "—"}` },
    );
    const regime: RegimeRead = {
      permission, mode, modeText, conds, vwap: r2(vw), poc, atr5: A5, devAtr: devAtr != null ? r2(devAtr) : null,
      fadeUp: A5 ? r2(vw + C.plan.fadeK * A5) : null, fadeDn: A5 ? r2(vw - C.plan.fadeK * A5) : null,
      opening: opening || openingProvisional ? {
        label: (opening ?? openingProvisional)!.label, side: (opening ?? openingProvisional)!.side, net: !!opening?.net,
        decidedAt: opening?.decidedAt ?? null, orHigh: orHi, orLow: orLo, broken,
      } : null,
      crosses, dayRvol: dayRv != null ? r2(dayRv) : null,
    };
    const d: 1 | -1 | 0 = permission === "CALL" ? 1 : permission === "PUT" ? -1 : 0;

    // ── pozisyon yönetimi (stop öncelikli) ──
    let exitedNow: Attempt | null = null;
    if (pos) {
      const P = pos;
      const hitStop = P.d > 0 ? b.low <= P.stop : b.high >= P.stop;
      const hitTgt = P.d > 0 ? b.high >= P.target : b.low <= P.target;
      let ex: { price: number; result: Attempt["result"] } | null = null;
      if (hitStop) ex = { price: P.stop, result: "ZARAR" };
      else if (hitTgt) ex = { price: P.target, result: "KÂR" };
      else if (endMin >= C.risk.exitMin) ex = { price: b.close, result: "ZAMAN" };
      P.att.mfe = Math.max(P.att.mfe, P.d > 0 ? b.high - P.att.entry : P.att.entry - b.low);
      if (ex) {
        P.att.exitClock = clock;
        P.att.exit = r2(ex.price);
        P.att.r = P.risk > 0 ? r2(((ex.price - P.att.entry) * P.d) / P.risk) : null;
        P.att.result = ex.result === "ZAMAN" ? ((P.att.r ?? 0) >= 0 ? "ZAMAN" : "ZARAR") : ex.result;
        exitedNow = P.att;
        pos = null;
        cooldownUntil = i + C.risk.cooldownBars;
      }
    }

    // ── ters uyarı (bilgi: yeni girişi engellemez, stopu otomatik oynatmaz) ──
    const rd: 1 | -1 | 0 = pos ? pos.d : d;
    const revNow: string[] = [];
    if (rd !== 0 && A5) {
      const pvw = i > 0 ? s5.vwap[i - 1] : null;
      if (i > 0 && pvw != null && (bars[i - 1].close - pvw) * rd >= 0 && (b.close - vw) * rd < 0 && rv != null && rv >= C.reverse.crossRvol) {
        revNow.push(`Ters yönde hacimli VWAP kesişimi (RVOL ${rv.toFixed(1)})`);
      }
      for (let j = Math.max(1, i - C.reverse.sweepWithinBars); j <= i; j++) {
        if (sweptFlag.has(j)) continue;
        const prior = bars.slice(0, j);
        const H = rd > 0 ? Math.max(...prior.map((x) => x.high)) : Math.min(...prior.map((x) => x.low));
        const pierced = rd > 0 ? bars[j].high >= H + C.reverse.sweepAtr * A5 : bars[j].low <= H - C.reverse.sweepAtr * A5;
        const back = rd > 0 ? b.close < H : b.close > H;
        if (pierced && back) {
          sweptFlag.add(j);
          revNow.push(`Likidite süpürmesi: ${rd > 0 ? "gün tepesi" : "gün dibi"} ${f2(H)} aşıldı, geri ${rd > 0 ? "altında" : "üstünde"} kapandı — kırılım tuzak olabilir`);
        }
      }
      const upW = b.high - Math.max(b.open, b.close), dnW = Math.min(b.open, b.close) - b.low;
      if (rv != null && rv > C.reverse.exhaustRvol && rg > 0 && (rd > 0 ? upW : dnW) >= Math.max(body, 0.4 * rg)) {
        revNow.push(`Tükenme: RVOL ${rv.toFixed(1)} mum uzun ${rd > 0 ? "üst" : "alt"} fitille kapandı`);
      }
    }
    if (revNow.length) { reverseUntil = i + C.reverse.lifeBars - 1; reverseWhy = revNow; }
    const reverseActive = i <= reverseUntil;

    let status: LadderStatus;
    let message = "";
    let change = "";
    let warnSigns: Cond[] | null = null;
    let trigConds: Cond[] | null = null;
    let plan: Plan | null = null;
    let side: "CALL" | "PUT" | null = d ? word(d) : null;
    const full = attempts.length >= C.risk.maxAttempts;
    const inWindow = endMin >= C.risk.firstEntryMin && endMin <= C.risk.lastEntryMin;
    const cooling = i <= cooldownUntil;
    const pat = d ? detectCandlePatterns(bars, i).filter((p) => (p.direction === "LONG" ? 1 : -1) === d).sort((a, c) => c.strength - a.strength)[0] ?? null : null;

    if (pos) {
      const P = pos;
      side = word(P.d);
      plan = { side: word(P.d), entry: P.att.entry, stop: P.stop, target: P.target, targetLabel: P.att.mode === "ÖĞLEN DÖNÜŞ" ? "VWAP" : `${C.risk.rr}R`, stopAtr: A5 ? r2(Math.abs(P.att.entry - P.stop) / A5) : 0, setup: P.att.setup };
      if (reverseActive) {
        status = "TERS UYARI";
        message = `${reverseWhy.join(" · ")}. Açık ${word(P.d)} pozisyonda stopu son 2 mumun ${P.d > 0 ? "dibine" : "tepesine"} sıkılaştırmayı düşün.`;
        change = `Stop ${f2(P.stop)} ya da hedef ${f2(P.target)}; 15:50'de kalan kapanır.`;
      } else {
        status = "TETİK";
        message = `${word(P.d)} pozisyonu açık (${P.att.clock} · ${P.att.mode}, giriş ${f2(P.att.entry)}) · stop ${f2(P.stop)} · hedef ${f2(P.target)} · en iyi +${f2(P.att.mfe)}.`;
        change = `Stop ${f2(P.stop)} ya da hedef ${f2(P.target)}; 15:50'de kalan pozisyon kapanır.`;
      }
    } else if (d && A5 && e5 != null && !exitedNow) {
      const quality = rg > 0 && body / rg >= C.trig.minBodyFrac && (d > 0 ? closePos >= C.trig.closeTop && b.close > b.open : closePos <= 1 - C.trig.closeTop && b.close < b.open);
      const volOk = pv > 0 && (b.volume || 0) >= C.trig.volRatio * pv;
      const fade = mode === "ÖĞLEN DÖNÜŞ";
      const placeOk = fade ? i > 0 && (b.close - bars[i - 1].close) * d > 0 : (b.close - e5) * d > 0 && (b.close - vw) * d > 0;
      trigConds = [
        { key: "t1", required: true, label: fade ? "Mum VWAP'a doğru döndü (kapanış öncekinden VWAP tarafında)" : `Kapanış VWAP ve EMA20'nin ${d > 0 ? "üstünde" : "altında"}`, ok: placeOk, value: fade ? `${f2(b.close)} · önceki ${i > 0 ? f2(bars[i - 1].close) : "—"}` : `VWAP ${f2(vw)} · EMA20 ${f2(e5)} · kapanış ${f2(b.close)}` },
        { key: "t2", required: true, label: `Gövdeli ${d > 0 ? "yeşil" : "kırmızı"} mum (gövde ≥ %${Math.round(C.trig.minBodyFrac * 100)}, kapanış iyi tarafta)`, ok: quality, value: `gövde %${rg > 0 ? Math.round((body / rg) * 100) : 0} · kapanış %${Math.round(closePos * 100)}${pat ? ` · ${pat.label}` : ""}` },
        { key: "t3", required: true, label: `Hacim ≥ önceki 3 mumun ortalaması`, ok: volOk, value: `${local != null ? local.toFixed(2) : "—"}× · RVOL ${rv != null ? rv.toFixed(2) : "—"}` },
      ];
      const fired = trigConds.every((c) => c.ok) && inWindow;
      if (fired && !full && !cooling) {
        const ext = d > 0 ? Math.min(...bars.slice(Math.max(0, i - 2), i + 1).map((x) => x.low)) : Math.max(...bars.slice(Math.max(0, i - 2), i + 1).map((x) => x.high));
        const stop = ext - d * C.risk.stopPadAtr * A5;
        const risk = Math.abs(b.close - stop);
        const tgt = fade ? vw : b.close + d * C.risk.rr * risk;
        if (risk > C.risk.maxStopAtr * A5 || risk < C.risk.minStopPts) {
          status = "İPTAL";
          message = `${word(d)} tetiği geldi ama stop ${risk < C.risk.minStopPts ? "çok dar" : `çok geniş (${f2(risk)} = ${(risk / A5).toFixed(2)} ATR > ${C.risk.maxStopAtr})`} — işlem açılmaz.`;
          change = "Sonraki kurulum beklenir.";
        } else if ((tgt - b.close) * d < C.risk.fadeMinR * risk) {
          status = "İPTAL";
          message = `${word(d)} tetiği geldi ama hedef (VWAP ${f2(vw)}) stoba göre çok yakın — işlem açılmaz.`;
          change = "Fiyat VWAP'tan yeniden uzaklaşırsa tekrar aranır.";
        } else {
          const setup = fade ? "VWAP'a dönüş mumu" : mode === "AÇILIŞ YÖNÜ" ? "açılış yönünde VWAP/EMA20 üstü gövdeli mum" : "kapanış yönünde VWAP/EMA20 üstü gövdeli mum";
          plan = { side: word(d), entry: r2(b.close), stop: r2(stop), target: r2(tgt), targetLabel: fade ? "VWAP" : `${C.risk.rr}R`, stopAtr: r2(risk / A5), setup };
          const att: Attempt = { side: word(d), mode, setup, clock, time: b.time, entry: r2(b.close), stop: r2(stop), target: r2(tgt), exitClock: null, exit: null, result: null, r: null, mfe: 0 };
          attempts.push(att);
          pos = { att, d, stop: r2(stop), target: r2(tgt), risk };
          status = "TETİK";
          message = `${word(d)} · ${mode} · ${setup}${pat ? ` (${pat.label})` : ""} — giriş ${f2(b.close)}, stop ${f2(stop)} (${f2(risk)}), hedef ${f2(tgt)} (${fade ? "VWAP" : `${C.risk.rr}R`}).`;
          change = `Stop ${f2(stop)} — kırılırsa çık; hedef ${f2(tgt)}. 15:50'de kalan kapanır.`;
        }
      } else if (fired) {
        status = "İPTAL";
        message = `${word(d)} tetiği geldi ama işlem açılmaz — ${full ? `günlük ${C.risk.maxAttempts} deneme doldu` : "çıkış sonrası kısa bekleme"}.`;
        change = "Sonraki kurulum beklenir.";
      } else {
        // erken uyarı (emri hazırla, girme)
        const L = [{ price: vw, label: "VWAP" }, { price: e5, label: "EMA20" }].sort((a, c) => Math.abs(a.price - b.close) - Math.abs(c.price - b.close))[0];
        const near = !fade && Math.abs(b.close - L.price) <= C.warn.nearAtr * A5;
        const pulled = !fade && i >= 2 && (b.close - bars[i - 2].close) * d < 0;
        const stretched = fade && devAtr != null && Math.abs(devAtr) >= C.plan.fadeK;
        const turnTxt = fade
          ? `5m ${d > 0 ? "yeşil" : "kırmızı"} gövdeli mum (gövde ≥ %30, kapanış ${d > 0 ? "üst" : "alt"} yarıda) + hacim ≥ önceki 3 mum`
          : `5m kapanış VWAP ${f2(vw)} ve EMA20 ${f2(e5)} ${d > 0 ? "üstünde" : "altında"}, gövdeli ${d > 0 ? "yeşil" : "kırmızı"} mum + hacim ≥ önceki 3 mum`;
        warnSigns = [
          { key: "w1", required: false, label: fade ? `Uzama eşiği doldu (|fiyat − VWAP| ≥ ${C.plan.fadeK} ATR)` : `Geri çekilme VWAP/EMA20'ye geldi (≤ ${C.warn.nearAtr} ATR)`, ok: fade ? stretched : near, value: fade ? `${devAtr != null ? sgn(devAtr) : "—"} ATR` : `${L.label} ${f2(L.price)} · ${(Math.abs(b.close - L.price) / A5).toFixed(2)} ATR` },
          { key: "w2", required: false, label: fade ? "Satış/alış yavaşlıyor (hacim önceki 3 mumdan düşük)" : "Geri çekilme hacimsiz (hacim önceki 3 mumdan düşük)", ok: local != null && local < 1, value: `${local != null ? local.toFixed(2) : "—"}×` },
          { key: "w3", required: false, label: fade ? `Dönüş formasyonu (${d > 0 ? "çekiç/yutan boğa" : "kayan yıldız/yutan ayı"})` : "Seviyede tutunma formasyonu", ok: !!pat, value: pat ? pat.label : "yok" },
        ];
        // öğlende: uzama dolu VE hız kesiliyor (hacim düşüyor ya da formasyon) · trendde: geri çekilme seviyeye geldi
        const ready = fade ? stretched && ((local != null && local < 1) || !!pat) : near && pulled;
        if (ready && inWindow && !full) {
          status = "ERKEN UYARI";
          message = `${word(d)} · ${mode} · ${fade ? `fiyat VWAP'tan ${devAtr != null ? sgn(devAtr) : ""} ATR uzakta, dönüş mumu bekleniyor` : `geri çekilme ${L.label} ${f2(L.price)} yakınında`}. Tetik: ${turnTxt}.`;
          change = fade ? `Uzama ${C.plan.fadeK} ATR'nin altına inerse ya da 14:00 olursa iptal.` : `Açılış yönü bitmezse tetik beklenir; 15m kapanış ${d > 0 ? "VWAP altına" : "VWAP üstüne"} geçerse dikkat.`;
        } else {
          status = reverseActive ? "TERS UYARI" : "İZLE";
          message = reverseActive
            ? `${reverseWhy.join(" · ")}. ${word(d)} izni sürüyor ama acele etme.`
            : !inWindow
              ? `${word(d)} yönü (${mode}) · ${endMin > C.risk.lastEntryMin ? "15:30 sonrası yeni giriş yok" : "10:00 öncesi giriş yok"}.`
              : full
                ? `${word(d)} yönü (${mode}) · günlük ${C.risk.maxAttempts} deneme doldu.`
                : `${word(d)} yönü (${mode}) · kurulum yok; fiyat ${L.label} ${f2(L.price)}'den ${(Math.abs(b.close - L.price) / A5).toFixed(2)} ATR uzakta.`;
          change = fade
            ? `Dönüş mumu gelirse TETİK (${turnTxt}).`
            : `Geri çekilme VWAP/EMA20'ye ${C.warn.nearAtr} ATR yaklaşırsa ERKEN UYARI; ${turnTxt} = TETİK.`;
        }
      }
    } else if (exitedNow) {
      status = "İZLE";
      message = `${exitedNow.side} pozisyonu kapandı (${exitedNow.result}, ${exitedNow.r != null ? `${exitedNow.r >= 0 ? "+" : ""}${exitedNow.r}R` : "—"}). ${d ? `${word(d)} yönü sürüyor (${mode}).` : modeText}`;
      change = `${C.risk.cooldownBars} mum sonra yeni kurulum aranır.`;
    } else {
      // izin yok: erken uyarı = yön hazırlanıyor
      const op = openingProvisional;
      const preSide = mode === "AÇILIŞ TOPLANIYOR" && op && (op.provisional === "UP" || op.provisional === "DOWN") ? (op.provisional === "UP" ? 1 : -1) : 0;
      const preFade = endMin >= C.plan.fadeStart && endMin < C.plan.fadeEnd && devAtr != null && Math.abs(devAtr) >= C.warn.fadePre * C.plan.fadeK && !(opD && !broken && endMin < C.plan.openEnd);
      if (preSide) {
        status = "ERKEN UYARI";
        side = word(preSide as 1 | -1);
        message = `Açılış yönü hazırlanıyor: ${op!.label}. 09:55/10:00'da NET olursa ${word(preSide as 1 | -1)} izni açılır — seviyeleri işaretle, giriş yok.`;
        change = `09:55 kuralı + EMA20 + hacim (+ gap) aynı yönde olursa NET; değilse açılış işlemi yok.`;
      } else if (preFade) {
        status = "ERKEN UYARI";
        side = devAtr! > 0 ? "PUT" : "CALL";
        message = `Öğlen dönüşü hazırlanıyor: fiyat VWAP'tan ${sgn(devAtr!)} ATR uzakta (eşik ±${C.plan.fadeK}). ${f2(devAtr! > 0 ? regime.fadeUp! : regime.fadeDn!)} ${devAtr! > 0 ? "üstünde" : "altında"} dönüş mumu = ${side} kurulumu.`;
        change = `Fiyat VWAP'a dönerse uyarı söner.`;
      } else {
        status = "İŞLEM YOK";
        side = null;
        message = modeText;
        change = endMin < 10 * 60
          ? "09:55 / 10:00'da açılış yönü NET olursa izin açılır."
          : endMin < C.plan.fadeEnd
            ? `Fiyat ${regime.fadeUp != null ? f2(regime.fadeUp) : "VWAP+1 ATR"} üstüne çıkarsa PUT, ${regime.fadeDn != null ? f2(regime.fadeDn) : "VWAP−1 ATR"} altına inerse CALL (VWAP'a dönüş) aranır.`
            : `Fiyat VWAP ve POC'un aynı tarafına geçerse o yönde izin açılır.`;
      }
    }

    steps.push({
      time: b.time, clock, status, side: status === "İŞLEM YOK" ? null : side, message, change, regime,
      warnSigns, trigConds, reverse: reverseActive ? reverseWhy : [], plan,
      rvol: rv != null ? r2(rv) : null, dayRvol: dayRv != null ? r2(dayRv) : null, localRatio: local != null ? r2(local) : null,
    });
  }

  return { date, steps, current: steps[steps.length - 1] ?? null, attempts, base: rvol, or: or30, opening };
}

// ── Mum yorumları (aynı sistem) ──────────────────────────────────────

const toneOf = (s: LadderStep | undefined): Tone => (s?.status === "TETİK" ? (s.side === "PUT" ? "bear" : "bull") : "neutral");

/** 5m mum yorumu: o anki merdiven durumu · mum kalitesi · formasyon · RVOL · VWAP/EMA20 */
export function ladderComment5(inp: LadderInput, lr: LadderRead, i: number): CandleComment {
  const b = inp.s5.bars[i];
  const st = lr.steps[i];
  const vw = inp.s5.vwap[i];
  const A = inp.atr5.get(b.time) ?? null;
  const e5 = inp.ema5.get(b.time) ?? null;
  const rg = b.high - b.low, body = Math.abs(b.close - b.open);
  const cp = rg > 0 ? (b.close - b.low) / rg : 0.5;
  const up = b.close >= b.open;
  const dev = vw != null ? b.close - vw : null;
  const devA = dev != null && A ? dev / A : null;
  const quality = rg > 0 && body / rg >= C.trig.minBodyFrac && (up ? cp >= C.trig.closeTop : cp <= 1 - C.trig.closeTop);
  const pat = detectCandlePatterns(inp.s5.bars, i).sort((a, c) => c.strength - a.strength)[0] ?? null;
  const lines: string[] = [
    `Durum: ${st.status}${st.side ? ` (${st.side})` : ""} · ${st.regime.mode} — ${st.message}`,
    `Mum: gövde %${rg > 0 ? Math.round((body / rg) * 100) : 0} · kapanış %${Math.round(cp * 100)} → ${quality ? "gövdeli" : "zayıf"}${A ? ` · aralık ${(rg / A).toFixed(2)} ATR` : ""}${pat ? ` · formasyon: ${pat.label} (${pat.direction === "LONG" ? "yukarı" : "aşağı"})` : ""}`,
    `Hacim: önceki 3 mumun ${st.localRatio != null ? `${st.localRatio.toFixed(2)}×'i` : "—"} · RVOL ${st.rvol != null ? st.rvol.toFixed(2) : "—"} (${rvolText(st.rvol)})`,
    `VWAP ${vw != null ? f2(vw) : "—"} (${dev != null ? sgn(dev) : "—"}${devA != null ? `, ${sgn(devA)} ATR` : ""}) · EMA20 ${e5 != null ? `${f2(e5)} (${sgn(b.close - e5)})` : "—"}`,
  ];
  if (st.change) lines.push(`Ne olursa değişir: ${st.change}`);
  return {
    tf: "5m", time: b.time, clock: nyClock(b.time + 300), tone: toneOf(st), forming: false,
    headline: `${st.status}${st.side ? ` · ${st.side}` : ""} · ${quality ? "gövdeli" : "zayıf"} ${up ? "yükseliş" : "düşüş"} mumu${pat ? ` · ${pat.label}` : ""}`,
    close: b.close, vwap: vw ?? null, vwapSide: dev == null ? null : Math.abs(dev) < 0.02 ? "AT" : dev > 0 ? "ABOVE" : "BELOW",
    upperWick: r2(b.high - Math.max(b.open, b.close)), lowerWick: r2(Math.min(b.open, b.close) - b.low), closePos: cp,
    volume: b.volume || 0, volRatio: st.rvol, lines,
  };
}

/** 15m mum yorumu: o kapanıştaki seans planı + 15m'in VWAP/EMA20 konumu + formasyon */
export function ladderComment15(inp: LadderInput, lr: LadderRead, k: number): CandleComment {
  const b = inp.s15.bars[k];
  const end = b.time + 900;
  const st = lr.steps.find((s) => s.time + 300 === end) ?? lr.steps.filter((s) => s.time + 300 <= end).slice(-1)[0];
  const rg = st?.regime;
  const vw = inp.s15.vwap[k];
  const e15 = inp.ema15.get(b.time) ?? null;
  const slot = Math.round((nyParts(b.time).minutes - OPEN_MIN) / 5);
  const base = lr.base;
  const exp = base ? base.slot.slice(slot, slot + 3).reduce((a, x) => a + x, 0) : 0;
  const rv15 = exp > 0 ? (b.volume || 0) / exp : null;
  const pat = detectCandlePatterns(inp.s15.bars, k).sort((a, c) => c.strength - a.strength)[0] ?? null;
  const dev = vw != null ? b.close - vw : null;
  const side = (x: number | null) => (x == null ? "—" : x > 0 ? "üstünde" : x < 0 ? "altında" : "üzerinde");
  const lines = [
    `Seans planı: ${rg ? `${rg.mode}${rg.permission !== "NÖTR" ? ` → ${rg.permission}` : ""} — ${rg.modeText}` : "—"}`,
    `15m kapanış VWAP ${vw != null ? f2(vw) : "—"} ${side(dev)} (${dev != null ? sgn(dev) : "—"}) · EMA20 ${e15 != null ? `${f2(e15)} ${side(b.close - e15)}` : "—"}`,
    `15m RVOL ${rv15 != null ? rv15.toFixed(2) : "—"}: ${rvolText(rv15)}${pat ? ` · formasyon: ${pat.label} (${pat.direction === "LONG" ? "yukarı" : "aşağı"})` : ""}`,
  ];
  if (st?.change) lines.push(`Ne olursa değişir: ${st.change}`);
  return {
    tf: "15m", time: b.time, clock: nyClock(end), tone: "neutral", forming: false,
    headline: `${rg?.mode ?? "—"}${rg && rg.permission !== "NÖTR" ? ` · ${rg.permission}` : ""} · 15m VWAP ${side(dev)} · EMA20 ${side(e15 != null ? b.close - e15 : null)}${pat ? ` · ${pat.label}` : ""}`,
    close: b.close, vwap: vw ?? null, vwapSide: dev == null ? null : Math.abs(dev) < 0.02 ? "AT" : dev > 0 ? "ABOVE" : "BELOW",
    upperWick: r2(b.high - Math.max(b.open, b.close)), lowerWick: r2(Math.min(b.open, b.close) - b.low),
    closePos: b.high > b.low ? (b.close - b.low) / (b.high - b.low) : 0.5,
    volume: b.volume || 0, volRatio: rv15 != null ? r2(rv15) : null, lines,
  };
}

/** Oluşan (henüz kapanmamış) mum — karar mumu değil; RVOL temposu ve VWAP farkı */
export function ladderForming(bar: Bar, vwap: number | null, atr: number | null, base: RvolBase | null, nowSec: number, tf: "5m" | "15m" = "5m"): CandleComment {
  const span = tf === "15m" ? 900 : 300;
  const slot = slotOf(bar.time);
  const frac = Math.min(1, Math.max(0.05, (nowSec - bar.time) / span));
  const exp = base ? base.slot.slice(slot, slot + span / 300).reduce((a, x) => a + x, 0) : 0;
  const rv = exp > 0 ? (bar.volume || 0) / (exp * frac) : null;
  const devA = vwap != null && atr ? (bar.close - vwap) / atr : null;
  const rg = bar.high - bar.low;
  return {
    tf, time: bar.time, clock: nyClock(bar.time + span), tone: "neutral", forming: true,
    headline: `Oluşan mum — karar mumu değil · RVOL temposu ${rv != null ? rv.toFixed(1) : "—"}`,
    close: bar.close, vwap, vwapSide: devA == null ? null : Math.abs(devA) < 0.05 ? "AT" : devA > 0 ? "ABOVE" : "BELOW",
    upperWick: r2(bar.high - Math.max(bar.open, bar.close)), lowerWick: r2(Math.min(bar.open, bar.close) - bar.low),
    closePos: rg > 0 ? (bar.close - bar.low) / rg : 0.5, volume: bar.volume || 0, volRatio: rv != null ? r2(rv) : null,
    lines: [
      `RVOL temposu (geçen süreye göre): ${rvolText(rv)}`,
      `VWAP farkı ${devA != null ? `${sgn(devA)} ATR` : "—"}${tf === "5m" ? ` · öğlen dönüş eşiği ±${C.plan.fadeK} ATR` : ""}`,
      "Durum yalnızca mum kapanınca değişir.",
    ],
  };
}

export { hm as ladderClock };
