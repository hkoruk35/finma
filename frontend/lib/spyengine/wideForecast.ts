/**
 * Geniş Harita tahmini — saf, izomorfik (2026-11-12, kullanıcı isteği).
 *
 * Bugünden itibaren 3 işlem günü için Monte Carlo senaryo hesabı:
 *   • Oynaklık: son ≤6 seansın 15m getiri sapması (σ15) + seans arası boşluk sapması (σgap) — GERÇEK veriden.
 *   • Eğilim (drift): 4h okuması (htf4h.ts, −4…+4 puan) × küçük katsayı; son 4h mumun hacmi yönü teyit ediyorsa ×1,25, zayıfsa ×0,75.
 *     Katsayı ölçülmüş değil, "hafif eğim" olarak seçildi: puan +4 iken 3 günde yaklaşık +0,6σ kayma.
 *   • Seviyeler: pivot merdiveni (4h pivotlar, dünkü/bugünkü tepe-dip-kapanış) — dokunma olasılıkları bu seviyelere göre.
 * Sistem senaryoları: en yakın üst seviye (U1) ile alt seviyeye (D1) hangisine ÖNCE değileceği + ikisine de değmeme.
 * Kullanıcı senaryosu (isteğe bağlı): [H0 zayıf yükseliş] → L1 geri çekilme → T kırılım hedefi | B planı L2 — sıralı dokunma olasılıkları.
 *
 * DÜRÜSTLÜK: bu kalibre edilmiş bir tahmin modeli DEĞİL; olasılıklar "bu oynaklık ve hafif eğimle rastgele yürüyüşte neler olurdu"
 * sorusunun cevabıdır. Mum/hacim formasyonu yalnız eğim katsayısına girer. Geriye dönük isabet ölçümü yapılmadı.
 * Tohumlu rastgele sayı: aynı 4h kapanışı + aynı girdi → aynı sonuç (sayfa yenilendikçe oynamaz).
 */

import { nyDateTimeToEpoch, nyParts, RTH_CLOSE_MIN, RTH_OPEN_MIN, type Bar } from "./core";
import type { Htf4hRead } from "./htf4h";

export const SLOT_MIN = 15;
export const SLOTS_PER_DAY = (RTH_CLOSE_MIN - RTH_OPEN_MIN) / SLOT_MIN; // 26
const N_PATHS = 3000;
const MICRO = 3; // slot başına alt adım (fitil/dokunma tespiti için)

export interface UserScenarioInput {
  /** zayıf yükseliş tepesi (opsiyonel) */
  h0?: number | null;
  /** geri çekilme seviyesi */
  l1: number | null;
  /** B planı: L1 altı hedef */
  l2?: number | null;
  /** ana senaryo: sonraki daha güçlü denemede kırılacak hedef */
  t?: number | null;
}

export interface WideInput {
  symbol: string;
  price: number;
  t: number;
  /** RTH 15m mumlar (çok günlük, en az ~3 seans) */
  bars15: Bar[];
  read4h: Htf4hRead | null;
  /** pivot merdiveni */
  levels: { price: number; label: string }[];
  user: UserScenarioInput | null;
  /** son kapanmış 4h mumun zamanı (tohum + güncelleme damgası) */
  basis4h: number | null;
  /** son 4h mumun hacim oranı (önceki ort.'a göre) */
  volRatio4h: number | null;
}

export interface FutureSlot { time: number; day: number; endsAt: number }

export interface ClassPath {
  key: string;
  title: string;
  /** 0..100 */
  pct: number;
  /** slot sonu medyan yol (class üyelerinin); üye yoksa boş */
  median: number[];
  /** sınıfın ortalama ilk-dokunma slotu (yaklaşık süre) */
  etaSlot: number | null;
}

export interface LevelOdds { price: number; label: string; touchPct: number; side: "UP" | "DOWN" }

export interface UserResult {
  pH0: number | null;
  pL1: number;
  /** L1'e dokunup SONRA T'ye (L2'den önce) değme — mutlak */
  pMain: number | null;
  /** L1'e dokunup SONRA L2'ye (T'den önce) değme — mutlak */
  pPlanB: number | null;
  main: ClassPath | null;
  planB: ClassPath | null;
  l1Path: ClassPath | null;
}

export interface WideForecast {
  generatedAt: number;
  basis4h: number | null;
  slots: FutureSlot[];
  sigma15: number;
  sigmaDay: number;
  sigmaGap: number;
  tilt: number;
  tiltNote: string;
  cone: { p10: number[]; p50: number[]; p90: number[] };
  u1: { price: number; label: string };
  d1: { price: number; label: string };
  up: ClassPath;
  down: ClassPath;
  none: ClassPath;
  pU2: number | null;
  pD2: number | null;
  u2: { price: number; label: string } | null;
  d2: { price: number; label: string } | null;
  levelOdds: LevelOdds[];
  user: UserResult | null;
  /** 4h kapanışında bu tahmin kuruldu */
  lines: string[];
}

// ── yardımcılar ──────────────────────────────────────────────────

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pctile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
const isWeekday = (ymd: string) => { const w = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return w >= 1 && w <= 5; };

/** `t`'den sonraki 15m slotlar: bugünün kalanı (seans içindeyse) + sonraki `days` işlem günü (hafta sonu atlanır; tatiller bilinmez) */
export function futureSlots(t: number, days = 3): FutureSlot[] {
  const out: FutureSlot[] = [];
  const p = nyParts(t);
  let day = 0;
  const push = (ymd: string, fromMin: number) => {
    for (let m = fromMin; m < RTH_CLOSE_MIN; m += SLOT_MIN) {
      const s = nyDateTimeToEpoch(ymd, m);
      out.push({ time: s, day, endsAt: s + SLOT_MIN * 60 });
    }
  };
  let ymd = p.ymd;
  if (isWeekday(ymd)) {
    if (p.minutes < RTH_OPEN_MIN) push(ymd, RTH_OPEN_MIN);
    else if (p.minutes < RTH_CLOSE_MIN) push(ymd, Math.ceil((p.minutes + 0.01) / SLOT_MIN) * SLOT_MIN);
  }
  for (let k = 0; k < days; k++) {
    do { ymd = addDays(ymd, 1); } while (!isWeekday(ymd));
    day += 1;
    push(ymd, RTH_OPEN_MIN);
  }
  return out;
}

function estimateVol(bars15: Bar[]): { sigma15: number; sigmaGap: number } {
  const bySession = new Map<string, Bar[]>();
  for (const b of bars15) {
    const y = nyParts(b.time).ymd;
    const a = bySession.get(y) ?? [];
    a.push(b); bySession.set(y, a);
  }
  const days = [...bySession.keys()].sort().slice(-6);
  const rets: number[] = [];
  const gaps: number[] = [];
  let prevClose: number | null = null;
  for (const y of days) {
    const bs = bySession.get(y)!;
    for (let i = 1; i < bs.length; i++) if (bs[i - 1].close > 0) rets.push(Math.log(bs[i].close / bs[i - 1].close));
    if (prevClose != null && bs[0].open > 0) gaps.push(Math.log(bs[0].open / prevClose));
    prevClose = bs[bs.length - 1].close;
  }
  const sd = (a: number[], fallback: number) => {
    if (a.length < 5) return fallback;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
  };
  const sigma15 = Math.max(0.0004, sd(rets, 0.0012));
  const sigmaGap = Math.max(0.0003, sd(gaps, sigma15 * 3));
  return { sigma15, sigmaGap };
}

// ── ana hesap ────────────────────────────────────────────────────

export function buildWideForecast(inp: WideInput): WideForecast | null {
  const { price, t } = inp;
  if (!(price > 0) || inp.bars15.length < 20) return null;
  const slots = futureSlots(t, 3);
  if (slots.length < 10) return null;

  const { sigma15, sigmaGap } = estimateVol(inp.bars15);
  const sigmaDay = sigma15 * Math.sqrt(SLOTS_PER_DAY);

  // eğim: 4h puanı × 0,015σ15 / slot; hacim teyidi ×1,25 · zayıf hacim ×0,75
  const score = inp.read4h?.score ?? 0;
  let tilt = 0.015 * score * sigma15;
  let tiltNote = inp.read4h ? `4h ${inp.read4h.dir === "UP" ? "YUKARI" : inp.read4h.dir === "DOWN" ? "AŞAĞI" : "YATAY"} (${score > 0 ? "+" : ""}${score})` : "4h veri yok — eğim 0";
  if (inp.volRatio4h != null && score !== 0) {
    const lastBull = (inp.read4h?.last?.close ?? 0) >= (inp.read4h?.last?.open ?? 0);
    const agree = (score > 0) === lastBull;
    if (inp.volRatio4h >= 1.5 && agree) { tilt *= 1.25; tiltNote += " · yüksek hacimle teyitli (×1,25)"; }
    else if (inp.volRatio4h <= 0.6) { tilt *= 0.75; tiltNote += " · zayıf hacim (×0,75)"; }
  }

  // seviyeler
  const lv = [...inp.levels].filter((l) => Number.isFinite(l.price)).sort((a, b) => a.price - b.price);
  const minDist = 0.35 * sigmaDay * price;
  const ups = lv.filter((l) => l.price >= price + minDist);
  const dns = lv.filter((l) => l.price <= price - minDist).reverse();
  const u1 = ups[0] ?? { price: +(price * (1 + sigmaDay * 0.8)).toFixed(2), label: "+0,8σ (seviye yok)" };
  const d1 = dns[0] ?? { price: +(price * (1 - sigmaDay * 0.8)).toFixed(2), label: "−0,8σ (seviye yok)" };
  const u2 = ups[1] ?? null;
  const d2 = dns[1] ?? null;

  const user = inp.user && inp.user.l1 != null && inp.user.l1 > 0 ? inp.user : null;
  const watch = lv.filter((l) => Math.abs(l.price - price) <= 4 * sigmaDay * price);

  const rng = mulberry32(hashStr(`${inp.symbol}|${inp.basis4h ?? 0}|${Math.round(price * 100)}|${user ? `${user.h0}|${user.l1}|${user.l2}|${user.t}` : ""}`));
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const S = slots.length;
  const sigStep = sigma15 / Math.sqrt(MICRO);
  const tiltStep = tilt / MICRO;
  const paths: Float32Array[] = [];
  const hit = new Map<number, number>();           // seviye fiyatı → dokunan yol sayısı
  const lvPrices = watch.map((l) => l.price);
  const lvHit = new Array(lvPrices.length).fill(0);

  // sınıf bayrakları
  const cls: number[] = [];       // 0 = up-first, 1 = down-first, 2 = none
  let cU2 = 0, cD2 = 0;
  const uH0: boolean[] = [], uL1: boolean[] = [], uMain: boolean[] = [], uB: boolean[] = [];
  const uL1Slot: number[] = [];
  let nH0 = 0, nL1 = 0, nMain = 0, nB = 0;

  const useH0 = !!(user && user.h0 != null && user.h0 > price);
  const l1Below = user ? user.l1! < price : true;

  for (let n = 0; n < N_PATHS; n++) {
    const arr = new Float32Array(S);
    let x = Math.log(price);
    let mx = x, mn = x;
    let tU1 = -1, tD1 = -1;
    const touched = new Array(lvPrices.length).fill(false);
    let reachedU2 = false, reachedD2 = false;
    // kullanıcı durum makinesi
    let stage = user ? (useH0 ? 0 : 1) : 9;
    let sawH0 = false, sawL1 = false, main = false, planB = false, l1Slot = -1;

    for (let s = 0; s < S; s++) {
      if (s > 0 && slots[s].day !== slots[s - 1].day) x += sigmaGap * gauss(); // seans arası boşluk
      for (let m = 0; m < MICRO; m++) {
        x += tiltStep - 0.5 * sigStep * sigStep + sigStep * gauss();
        if (x > mx) mx = x;
        if (x < mn) mn = x;
        const p = Math.exp(x);
        if (tU1 < 0 && p >= u1.price) tU1 = s;
        if (tD1 < 0 && p <= d1.price) tD1 = s;
        if (u2 && !reachedU2 && p >= u2.price) reachedU2 = true;
        if (d2 && !reachedD2 && p <= d2.price) reachedD2 = true;
        for (let k = 0; k < lvPrices.length; k++) if (!touched[k] && ((lvPrices[k] >= price && p >= lvPrices[k]) || (lvPrices[k] < price && p <= lvPrices[k]))) touched[k] = true;
        if (user) {
          if (stage === 0 && p >= user.h0!) { stage = 1; sawH0 = true; }
          else if (stage === 1 && (l1Below ? p <= user.l1! : p >= user.l1!)) { stage = 2; sawL1 = true; l1Slot = s; }
          else if (stage === 2) {
            if (user.t != null && p >= user.t) { stage = 3; main = true; }
            else if (user.l2 != null && p <= user.l2) { stage = 3; planB = true; }
          }
        }
      }
      arr[s] = Math.exp(x);
    }
    paths.push(arr);
    for (let k = 0; k < lvPrices.length; k++) if (touched[k]) lvHit[k]++;
    if (tU1 >= 0 && (tD1 < 0 || tU1 < tD1)) cls.push(0);
    else if (tD1 >= 0 && (tU1 < 0 || tD1 <= tU1)) cls.push(1);
    else cls.push(2);
    if (reachedU2) cU2++;
    if (reachedD2) cD2++;
    uH0.push(sawH0); uL1.push(sawL1); uMain.push(main); uB.push(planB); uL1Slot.push(l1Slot);
    if (sawH0) nH0++;
    if (sawL1) nL1++;
    if (main) nMain++;
    if (planB) nB++;
    void hit; void mx; void mn;
  }

  const pct = (c: number) => Math.round((c / N_PATHS) * 1000) / 10;
  const medianPath = (pred: (i: number) => boolean): number[] => {
    const idx: number[] = [];
    for (let i = 0; i < N_PATHS && idx.length < 1500; i++) if (pred(i)) idx.push(i);
    if (idx.length < 20) return [];
    const out: number[] = [];
    for (let s = 0; s < S; s++) out.push(median(idx.map((i) => paths[i][s])));
    return out;
  };

  // koni
  const p10: number[] = [], p50: number[] = [], p90: number[] = [];
  for (let s = 0; s < S; s++) {
    const col = paths.map((a) => a[s]).sort((a, b) => a - b);
    p10.push(pctile(col, 0.1)); p50.push(pctile(col, 0.5)); p90.push(pctile(col, 0.9));
  }

  const count = (k: number) => cls.filter((c) => c === k).length;
  const mk = (key: string, title: string, k: number): ClassPath => ({
    key, title, pct: pct(count(k)), median: medianPath((i) => cls[i] === k), etaSlot: null,
  });
  const up = mk("up", `▲ ${u1.price.toFixed(2)} (${u1.label}) önce`, 0);
  const down = mk("down", `▼ ${d1.price.toFixed(2)} (${d1.label}) önce`, 1);
  const none = mk("none", "İkisine de değmez (aralık)", 2);

  const levelOdds: LevelOdds[] = watch.map((l, k) => ({
    price: l.price, label: l.label, touchPct: pct(lvHit[k]), side: l.price >= price ? "UP" as const : "DOWN" as const,
  })).sort((a, b) => b.price - a.price);

  let userRes: UserResult | null = null;
  if (user) {
    const base = useH0 ? (i: number) => uH0[i] : () => true;
    void base;
    userRes = {
      pH0: useH0 ? pct(nH0) : null,
      pL1: pct(nL1),
      pMain: user.t != null ? pct(nMain) : null,
      pPlanB: user.l2 != null ? pct(nB) : null,
      main: user.t != null ? { key: "umain", title: `Senin ana senaryon → ${user.t.toFixed(2)}`, pct: pct(nMain), median: medianPath((i) => uMain[i]), etaSlot: null } : null,
      planB: user.l2 != null ? { key: "uplanb", title: `B planı → ${user.l2.toFixed(2)}`, pct: pct(nB), median: medianPath((i) => uB[i]), etaSlot: null } : null,
      l1Path: { key: "ul1", title: `Geri çekilme → ${user.l1!.toFixed(2)}`, pct: pct(nL1), median: medianPath((i) => uL1[i]), etaSlot: null },
    };
  }

  const lines: string[] = [];
  lines.push(`Oynaklık: 15m σ %${(sigma15 * 100).toFixed(3)} · günlük σ %${(sigmaDay * 100).toFixed(2)} (≈ ${(sigmaDay * price).toFixed(2)} puan) · seans arası boşluk σ %${(sigmaGap * 100).toFixed(2)}.`);
  lines.push(`Eğim: ${tiltNote}.`);
  lines.push(`3 işlem günü içinde önce ${u1.price.toFixed(2)} (${u1.label}) %${up.pct} · önce ${d1.price.toFixed(2)} (${d1.label}) %${down.pct} · ikisine de değmez %${none.pct}.`);
  if (u2) lines.push(`Üstte bir sonraki seviye ${u2.price.toFixed(2)} (${u2.label}): 3 günde değme %${pct(cU2)}.`);
  if (d2) lines.push(`Altta bir sonraki seviye ${d2.price.toFixed(2)} (${d2.label}): 3 günde değme %${pct(cD2)}.`);

  return {
    generatedAt: t, basis4h: inp.basis4h, slots, sigma15, sigmaDay, sigmaGap, tilt, tiltNote,
    cone: { p10, p50, p90 }, u1, d1, up, down, none,
    pU2: u2 ? pct(cU2) : null, pD2: d2 ? pct(cD2) : null, u2, d2, levelOdds, user: userRes, lines,
  };
}
