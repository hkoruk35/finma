/**
 * SPY Engine V9.0 — Açılış Rejimi · Canlı Yön · Mum Yorumları · Tahmin Haritası
 * (saf, izomorfik — DOM/ağ yok).
 *
 * Motorun giriş/çıkış kurallarına (strategy.ts) DOKUNMAZ; yalnızca sunum
 * katmanıdır. Hepsi KAPANMIŞ mumlardan üretilir (non-repainting). VWAP,
 * mumun kendi zaman diliminde (5m için 5m, 15m için 15m) 09:30 ET'den
 * başlayarak hesaplanır — premarket VWAP'a karışmaz.
 *
 * Tahmin haritası bir TAHMİNDİR (ölçüm değil): seviyeler ölçülü veriden gelir
 * (levels.ts), yolculuğun zamanlaması ortalama saatlik hareketten türetilir.
 */

import {
  nyParts, nyClock, nyDateTimeToEpoch, isRthBar, r2,
  RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar,
} from "./core";
import { detectCandlePatterns } from "./candlePatterns";
import type { LevelRead, CloseForecast } from "./levels";

export type Tf = "5m" | "15m";
export type VwapSide = "ABOVE" | "BELOW" | "AT";

const SPAN: Record<Tf, number> = { "5m": 300, "15m": 900 };
const AT_EPS = 0.02;

const sideOf = (close: number, vwap: number | null): VwapSide | null =>
  vwap == null ? null : Math.abs(close - vwap) <= AT_EPS ? "AT" : close > vwap ? "ABOVE" : "BELOW";

const fmt = (n: number, d = 2) => n.toFixed(d);
const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;

// ── Seans mumları + VWAP ─────────────────────────────────────────────

export interface DaySeries {
  bars: Bar[];
  vwap: (number | null)[];
}

/** Bugünün (ymd) KAPANMIŞ RTH mumları + 09:30'dan kümülatif VWAP */
export function daySeries(all: Bar[], tf: Tf, ymd: string, lastClosedTime: number | null, nowSec: number): DaySeries {
  const bars = all.filter((b) => {
    if (!isRthBar(b) || nyParts(b.time).ymd !== ymd) return false;
    return lastClosedTime != null ? b.time <= lastClosedTime : b.time + SPAN[tf] <= nowSec;
  });
  let pv = 0, vol = 0;
  const vwap = bars.map((b) => {
    const v = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vol += v;
    return vol > 0 ? pv / vol : null;
  });
  return { bars, vwap };
}

/** Oluşmakta olan (henüz kapanmamış) dahil, çizim için RTH VWAP */
export function liveVwap(all: Bar[], ymd: string): number | null {
  let pv = 0, vol = 0;
  for (const b of all) {
    if (!isRthBar(b) || nyParts(b.time).ymd !== ymd) continue;
    const v = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vol += v;
  }
  return vol > 0 ? pv / vol : null;
}

// ── Mum yorumu ───────────────────────────────────────────────────────

export type Tone = "bull" | "bear" | "neutral";

export interface CandleComment {
  tf: Tf;
  time: number;
  clock: string;
  tone: Tone;
  /** Tek satır sonuç: "Boğa mumu · VWAP üstünde kapandı → alıcı lehine" */
  headline: string;
  close: number;
  vwap: number | null;
  vwapSide: VwapSide | null;
  lines: string[];
}

export function commentCandle(s: DaySeries, i: number, tf: Tf): CandleComment {
  const b = s.bars[i];
  const v = s.vwap[i];
  const range = Math.max(0.01, b.high - b.low);
  const body = Math.abs(b.close - b.open);
  const bodyPct = body / range;
  const upW = b.high - Math.max(b.open, b.close);
  const loW = Math.min(b.open, b.close) - b.low;
  const color: "bull" | "bear" | "doji" = bodyPct < 0.15 ? "doji" : b.close > b.open ? "bull" : "bear";
  const mid = (b.high + b.low) / 2;

  const lines: string[] = [];
  let score = color === "bull" ? 1 : color === "bear" ? -1 : 0;

  // — şekil —
  if (color === "doji") lines.push("Kararsızlık mumu (doji) — alıcı/satıcı dengede.");
  else if (bodyPct >= 0.7) lines.push(`Güçlü gövdeli ${color === "bull" ? "yeşil" : "kırmızı"} mum — ${color === "bull" ? "alıcılar" : "satıcılar"} baskın (gövde %${Math.round(bodyPct * 100)}).`);
  else if (loW / range >= 0.5 && b.close >= mid) { lines.push("Uzun alt fitil — dipte alıcı tepkisi."); score += 0.5; }
  else if (upW / range >= 0.5 && b.close <= mid) { lines.push("Uzun üst fitil — tepede satıcı baskısı."); score -= 0.5; }
  else lines.push(`${color === "bull" ? "Yeşil" : "Kırmızı"} mum, normal gövde (%${Math.round(bodyPct * 100)}).`);

  // — VWAP konumu (en önemli satır) —
  const side = sideOf(b.close, v);
  const prev = i > 0 ? s.bars[i - 1] : null;
  const pv = i > 0 ? s.vwap[i - 1] : null;
  const prevSide = prev ? sideOf(prev.close, pv) : null;
  if (v == null || side == null) {
    lines.push("VWAP verisi yok.");
  } else {
    const d = b.close - v;
    if (prevSide === "BELOW" && side === "ABOVE") { lines.push(`VWAP'ı (${fmt(v)}) yukarı kesip üstünde kapattı (${sgn(d)}) → alıcı kontrolü ele geçirdi.`); score += 2; }
    else if (prevSide === "ABOVE" && side === "BELOW") { lines.push(`VWAP'ın (${fmt(v)}) altına kapandı (${sgn(d)}) → satıcı kontrolü ele geçirdi.`); score -= 2; }
    else if (side === "ABOVE") {
      if (b.low <= v) lines.push(`VWAP'a (${fmt(v)}) değdi ve üstünde kapattı (${sgn(d)}) → VWAP destek olarak tuttu.`);
      else lines.push(`VWAP üstünde kapanış (${fmt(v)}, ${sgn(d)}) → yükseliş yapısı sürüyor.`);
      score += 1.5;
    } else if (side === "BELOW") {
      if (b.high >= v) lines.push(`VWAP'a (${fmt(v)}) değdi ama altında kapattı (${sgn(d)}) → VWAP direnç oldu, reddedildi.`);
      else lines.push(`VWAP altında kapanış (${fmt(v)}, ${sgn(d)}) → düşüş yapısı sürüyor.`);
      score -= 1.5;
    } else lines.push(`Kapanış VWAP'ın (${fmt(v)}) tam üzerinde → yön kararsız.`);
  }

  // — hacim —
  const from = Math.max(0, i - 10);
  if (i - from >= 3) {
    const avg = s.bars.slice(from, i).reduce((a, x) => a + (x.volume || 0), 0) / (i - from);
    if (avg > 0) {
      const r = (b.volume || 0) / avg;
      if (r >= 1.5) lines.push(`Hacim yüksek (${fmt(r, 1)}× ort.) → hareket teyitli.`);
      else if (r <= 0.6) lines.push(`Hacim zayıf (${fmt(r, 1)}× ort.) → hareket güvenilir değil.`);
    }
  }

  // — formasyon —
  const hits = detectCandlePatterns(s.bars, i);
  if (hits.length) {
    const top = hits.reduce((a, x) => (x.strength >= a.strength ? x : a));
    lines.push(`Formasyon: ${top.label} — ${top.detail}.`);
    score += top.direction === "LONG" ? 1 : -1;
  }

  const tone: Tone = score >= 2 ? "bull" : score <= -2 ? "bear" : "neutral";
  const colorTxt = color === "bull" ? "Yeşil mum" : color === "bear" ? "Kırmızı mum" : "Doji";
  const vwapTxt = side == null ? "VWAP yok" : side === "ABOVE" ? "VWAP üstünde" : side === "BELOW" ? "VWAP altında" : "VWAP'ta";
  const meaning = tone === "bull" ? "alıcı lehine" : tone === "bear" ? "satıcı lehine" : "nötr / kararsız";

  return {
    tf, time: b.time, clock: nyClock(b.time), tone, close: b.close, vwap: v, vwapSide: side, lines,
    headline: `${colorTxt} · ${vwapTxt} → ${meaning}`,
  };
}

/** Bugünün tüm kapanmış mumları için yorum — EN YENİ başta */
export function commentAll(s: DaySeries, tf: Tf, limit = 40): CandleComment[] {
  const out: CandleComment[] = [];
  for (let i = s.bars.length - 1; i >= 0 && out.length < limit; i--) out.push(commentCandle(s, i, tf));
  return out;
}

// ── Açılış rejimi (09:30 → 09:45-10:00 kararı) ───────────────────────

export type OpeningSide = "UP" | "DOWN" | "UNCERTAIN";

export interface OpeningRegime {
  /** WAITING: 09:45'ten önce · FORMING: 09:45-10:00 (her 5m kapanışta güncellenir) · LOCKED: 10:00 sonrası sabit */
  status: "WAITING" | "FORMING" | "LOCKED";
  side: OpeningSide | null;
  label: string;
  summary: string;
  /** 09:30'dan itibaren her 5m kapanışın VWAP konumu */
  closes5: { clock: string; side: VwapSide | null; close: number }[];
  closes15: { clock: string; side: VwapSide | null; close: number }[];
}

const OPEN_WINDOW_END = 10 * 60; // 10:00

export function openingRegime(m5: DaySeries, m15: DaySeries): OpeningRegime {
  const win5 = m5.bars
    .map((b, i) => ({ b, v: m5.vwap[i] }))
    .filter((x) => nyParts(x.b.time).minutes < OPEN_WINDOW_END);
  const win15 = m15.bars
    .map((b, i) => ({ b, v: m15.vwap[i] }))
    .filter((x) => nyParts(x.b.time).minutes < OPEN_WINDOW_END);

  const closes5 = win5.map((x) => ({ clock: nyClock(x.b.time), side: sideOf(x.b.close, x.v), close: x.b.close }));
  const closes15 = win15.map((x) => ({ clock: nyClock(x.b.time), side: sideOf(x.b.close, x.v), close: x.b.close }));

  const base = { closes5, closes15 };
  if (win5.length < 3) {
    return {
      ...base, status: "WAITING", side: null, label: "BEKLENİYOR",
      summary: `İlk 3 adet 5m kapanış (09:30·09:35·09:40) ve 15m 09:30 kapanışı bekleniyor — karar 09:45 ET'de başlar (${win5.length}/3 mum kapandı).`,
    };
  }

  const above = closes5.filter((c) => c.side === "ABOVE").length;
  const below = closes5.filter((c) => c.side === "BELOW").length;
  const n = closes5.length;
  const lastSide = closes5[n - 1].side;
  const side15 = closes15.length ? closes15[closes15.length - 1].side : null;

  let side: OpeningSide = "UNCERTAIN";
  if (above / n >= 0.8 && lastSide === "ABOVE" && side15 === "ABOVE") side = "UP";
  else if (below / n >= 0.8 && lastSide === "BELOW" && side15 === "BELOW") side = "DOWN";

  const status: OpeningRegime["status"] = n >= 6 ? "LOCKED" : "FORMING";
  const label = side === "UP" ? "YÜKSELİŞ" : side === "DOWN" ? "DÜŞÜŞ" : "BELİRSİZ";

  const why =
    side === "UP" ? `${n} 5m kapanışın ${above}'i VWAP üstünde, son kapanış VWAP üstünde, 15m kapanış VWAP üstünde.`
    : side === "DOWN" ? `${n} 5m kapanışın ${below}'i VWAP altında, son kapanış VWAP altında, 15m kapanış VWAP altında.`
    : `${n} 5m kapanış: ${above} VWAP üstü / ${below} VWAP altı${side15 ? `, 15m kapanış VWAP ${side15 === "ABOVE" ? "üstünde" : side15 === "BELOW" ? "altında" : "üzerinde"}` : ""} — kapanışlar tek yönde toplanmadı (VWAP etrafında gidip geliyor).`;

  return {
    ...base, status, side, label,
    summary: `${status === "LOCKED" ? "10:00 kararı (kilitli): " : "Oluşuyor — 10:00'a kadar her 5m kapanışta güncellenir: "}${why}`,
  };
}

// ── Canlı yön (her kapanan 5m + 15m mumla güncellenir) ───────────────

export interface LiveDirection {
  dir: "UP" | "DOWN" | "MIXED";
  strength: "GÜÇLÜ" | "ZAYIF" | "ÇELİŞKİ";
  side5: VwapSide | null;
  side15: VwapSide | null;
  /** Aynı VWAP tarafında üst üste kapanan mum sayısı */
  streak5: number;
  streak15: number;
  asOf5: string;
  asOf15: string | null;
  /** Yön VWAP ile teyitli mi (5m ve 15m aynı tarafta) */
  aligned: boolean;
  text: string;
}

function streakOf(s: DaySeries): { side: VwapSide | null; count: number; crossed: boolean } {
  const n = s.bars.length;
  if (!n) return { side: null, count: 0, crossed: false };
  const side = sideOf(s.bars[n - 1].close, s.vwap[n - 1]);
  let count = 0;
  for (let i = n - 1; i >= 0 && sideOf(s.bars[i].close, s.vwap[i]) === side; i--) count++;
  const prev = n - count - 1 >= 0 ? sideOf(s.bars[n - count - 1].close, s.vwap[n - count - 1]) : null;
  const crossed = count === 1 && prev != null && prev !== "AT" && side != null && side !== "AT" && prev !== side;
  return { side, count, crossed };
}

/**
 * Yön, HER kapanan 5m ve 15m mumun VWAP konumundan okunur (sabit mum sayısı
 * yok). Açılışta karar için 3×5m + 15m beklenir (openingRegime) — bu
 * fonksiyon açılış rejimi oluştuktan sonra çağrılır.
 */
export function liveDirection(s5: DaySeries, s15: DaySeries): LiveDirection | null {
  if (!s5.bars.length) return null;
  const a = streakOf(s5);
  const b = streakOf(s15);
  const asOf5 = nyClock(s5.bars[s5.bars.length - 1].time);
  const asOf15 = s15.bars.length ? nyClock(s15.bars[s15.bars.length - 1].time) : null;

  const up5 = a.side === "ABOVE", dn5 = a.side === "BELOW";
  const up15 = b.side === "ABOVE", dn15 = b.side === "BELOW";
  let dir: LiveDirection["dir"] = "MIXED";
  let strength: LiveDirection["strength"] = "ÇELİŞKİ";
  if (up5 && up15) dir = "UP";
  else if (dn5 && dn15) dir = "DOWN";
  const aligned = dir !== "MIXED";
  if (aligned) strength = a.count >= 2 ? "GÜÇLÜ" : "ZAYIF";

  const nm = (side: VwapSide | null) => (side === "ABOVE" ? "VWAP üstünde" : side === "BELOW" ? "VWAP altında" : side === "AT" ? "VWAP'ta" : "VWAP yok");
  const t5 = `5m (${asOf5}): ${nm(a.side)}${a.count > 1 ? `, ${a.count} mumdur üst üste` : a.crossed ? ", VWAP'ı yeni kesti" : ""}`;
  const t15 = asOf15 ? `15m (${asOf15}): ${nm(b.side)}${b.count > 1 ? `, ${b.count} mumdur üst üste` : b.crossed ? ", VWAP'ı yeni kesti" : ""}` : "15m: henüz kapanış yok";
  const verdict =
    dir === "UP" ? (strength === "GÜÇLÜ" ? "İki zaman dilimi de yukarı — yön teyitli." : "Yeni kesişim — bir sonraki 5m kapanışı teyit etmeli.")
    : dir === "DOWN" ? (strength === "GÜÇLÜ" ? "İki zaman dilimi de aşağı — yön teyitli." : "Yeni kesişim — bir sonraki 5m kapanışı teyit etmeli.")
    : "5m ve 15m farklı tarafta / VWAP'ta — yön yok, bekle.";

  return { dir, strength, side5: a.side, side15: b.side, streak5: a.count, streak15: b.count, asOf5, asOf15, aligned, text: `${t5} · ${t15}. ${verdict}` };
}

// ── Tahmin haritası ──────────────────────────────────────────────────

export interface MapLevel {
  price: number;
  label: string;
}

export interface PathPoint {
  t: number;
  price: number;
  label: string;
}

export interface ForecastMapData {
  bias: "UP" | "DOWN" | "FLAT";
  biasText: string;
  price: number;
  vwap: number | null;
  supports: MapLevel[];
  resistances: MapLevel[];
  path: PathPoint[];
  closeExpect: number;
  closeLow: number;
  closeHigh: number;
  steps: string[];
  alt: string[];
}

const DEFAULT_HOURLY = 1.0;

export function buildForecastMap(input: {
  price: number;
  vwap: number | null;
  date: string;
  nowSec: number;
  opening: OpeningRegime;
  live: LiveDirection | null;
  levels: LevelRead | null;
  forecast: CloseForecast | null;
}): ForecastMapData | null {
  const { price, vwap, date, nowSec, opening, live, levels, forecast } = input;
  if (!Number.isFinite(price)) return null;

  const closeSec = nyDateTimeToEpoch(date, RTH_CLOSE_MIN);
  const openSec = nyDateTimeToEpoch(date, RTH_OPEN_MIN);
  const t0 = Math.min(Math.max(nowSec, openSec), closeSec);

  // — bias —
  let bias: ForecastMapData["bias"] = "FLAT";
  let biasText = "Yön belirsiz — fiyat VWAP etrafında; aralık senaryosu.";
  if (opening.side === "UP" || opening.side === "DOWN") {
    bias = opening.side;
    biasText = `Açılış rejimi ${opening.label} → gün yönü ${bias === "UP" ? "yukarı" : "aşağı"} eğilimli.`;
  } else if (vwap != null && live && live.aligned && live.strength === "GÜÇLÜ" && opening.status !== "WAITING") {
    bias = live.dir as "UP" | "DOWN";
    biasText = `Açılış rejimi ${opening.label}; ancak 5m ve 15m kapanışlar VWAP ${bias === "UP" ? "üstünde" : "altında"} teyitli → kısa vadeli ${bias === "UP" ? "yukarı" : "aşağı"} eğilim.`;
  }

  // — seviyeler (yalnızca ölçülmüş veriden) —
  const cand: MapLevel[] = [];
  const add = (p: number | null | undefined, label: string) => {
    if (p != null && Number.isFinite(p)) cand.push({ price: r2(p), label });
  };
  if (levels) {
    add(levels.prevClose, "Dünkü kapanış");
    add(levels.premarket.high, "Premarket zirvesi");
    add(levels.premarket.low, "Premarket dibi");
    add(levels.rth.high, "Gün zirvesi");
    add(levels.rth.low, "Gün dibi");
    add(levels.support?.price, levels.support ? `Destek (${levels.support.source})` : "");
    add(levels.resistance?.price, levels.resistance ? `Direnç (${levels.resistance.source})` : "");
    add(levels.projectedHigh, "ATR zirve projeksiyonu");
    add(levels.projectedLow, "ATR dip projeksiyonu");
  }
  add(vwap, "VWAP");
  const whole = Math.floor(price);
  add(whole, `${whole} yuvarlak`);
  add(whole + 1, `${whole + 1} yuvarlak`);

  const uniq: MapLevel[] = [];
  for (const c of cand.sort((a, b) => a.price - b.price)) {
    const last = uniq[uniq.length - 1];
    if (last && Math.abs(last.price - c.price) < 0.15) {
      // yakın seviyeleri birleştir; VWAP etiketini koru
      if (c.label === "VWAP" || (!last.label.startsWith("VWAP") && c.label.length < last.label.length)) uniq[uniq.length - 1] = c;
    } else uniq.push(c);
  }
  const MIN_DIST = 0.12;
  const supports = uniq.filter((l) => l.price < price - MIN_DIST).sort((a, b) => b.price - a.price).slice(0, 3);
  const resistances = uniq.filter((l) => l.price > price + MIN_DIST).sort((a, b) => a.price - b.price).slice(0, 3);

  // — yolculuk —
  const hr = Math.max(0.3, levels?.hourlyRange ?? DEFAULT_HOURLY);
  const minLeft = Math.max(0, (closeSec - t0) / 60);
  const travel = (dist: number) => Math.min(Math.max(10, Math.round((Math.abs(dist) / hr) * 60)), Math.max(10, minLeft * 0.4));
  const at = (mins: number) => Math.min(closeSec, t0 + mins * 60);

  const s1 = supports[0] ?? { price: r2(price - hr * 0.5), label: "ATR desteği (tahmini)" };
  const r1 = resistances[0] ?? { price: r2(price + hr * 0.5), label: "ATR direnci (tahmini)" };

  const path: PathPoint[] = [{ t: t0, price: r2(price), label: "Şimdi" }];
  const steps: string[] = [];
  const alt: string[] = [];
  let closeExpect: number;

  if (bias === "DOWN") {
    const m1 = travel(price - s1.price);
    const bounceRef = vwap != null && vwap > s1.price ? vwap : r1.price;
    const bounce = r2(s1.price + (bounceRef - s1.price) * 0.5);
    path.push({ t: at(m1), price: s1.price, label: `Destek ${fmt(s1.price)}` });
    path.push({ t: at(m1 + 45), price: bounce, label: `Tepki ${fmt(bounce)}` });
    closeExpect = r2((s1.price + bounce) / 2);
    steps.push(`Fiyat ${fmt(price)}'ten ilk desteğe — ${fmt(s1.price)} (${s1.label}) — doğru iner (~${m1} dk).`);
    steps.push(`Destek tutarsa ${fmt(bounce)} civarına tepki yükselişi gelir (VWAP/direnç yarı mesafe).`);
    steps.push(`Gün sonu kapanış beklentisi ≈ ${fmt(closeExpect)}.`);
    alt.push(`İptal: 5m kapanış VWAP'ın${vwap != null ? ` (${fmt(vwap)})` : ""} üstüne çıkarsa düşüş senaryosu bozulur → hedef ${fmt(r1.price)}.`);
    alt.push(`Destek ${fmt(s1.price)} aşağı kırılırsa${supports[1] ? ` sıradaki durak ${fmt(supports[1].price)} (${supports[1].label})` : " yeni dip aranır"}.`);
  } else if (bias === "UP") {
    const m1 = travel(r1.price - price);
    const pullRef = vwap != null && vwap < r1.price ? vwap : s1.price;
    const pull = r2(r1.price - (r1.price - pullRef) * 0.5);
    path.push({ t: at(m1), price: r1.price, label: `Direnç ${fmt(r1.price)}` });
    path.push({ t: at(m1 + 45), price: pull, label: `Geri çekilme ${fmt(pull)}` });
    closeExpect = r2((r1.price + pull) / 2);
    steps.push(`Fiyat ${fmt(price)}'ten ilk dirence — ${fmt(r1.price)} (${r1.label}) — doğru yükselir (~${m1} dk).`);
    steps.push(`Direnç aşılamazsa ${fmt(pull)} civarına geri çekilme gelir (VWAP/destek yarı mesafe).`);
    steps.push(`Gün sonu kapanış beklentisi ≈ ${fmt(closeExpect)}.`);
    alt.push(`İptal: 5m kapanış VWAP'ın${vwap != null ? ` (${fmt(vwap)})` : ""} altına inerse yükseliş senaryosu bozulur → hedef ${fmt(s1.price)}.`);
    alt.push(`Direnç ${fmt(r1.price)} yukarı kırılırsa${resistances[1] ? ` sıradaki durak ${fmt(resistances[1].price)} (${resistances[1].label})` : " yeni zirve aranır"}.`);
  } else {
    const m1 = travel(Math.min(price - s1.price, r1.price - price));
    const center = vwap ?? price;
    path.push({ t: at(m1), price: r2(center), label: `VWAP ${fmt(center)}` });
    closeExpect = r2((center + price) / 2);
    steps.push(`Yön belirsiz: fiyat ${fmt(s1.price)} – ${fmt(r1.price)} aralığında VWAP (${fmt(center)}) etrafında dolaşır.`);
    steps.push(`Gün sonu kapanış beklentisi ≈ ${fmt(closeExpect)} (aralık ortası).`);
    alt.push(`Yön netleşmesi: 5m kapanış ${fmt(r1.price)} üstüne çıkarsa yükseliş, ${fmt(s1.price)} altına inerse düşüş senaryosu başlar.`);
  }

  // Kapanış noktası: tahmin bandıyla sınırlı (band = ölçülmüş |kapanış−fiyat| kantili)
  let closeLow = r2(closeExpect - hr * 0.5);
  let closeHigh = r2(closeExpect + hr * 0.5);
  if (forecast) {
    closeLow = forecast.low;
    closeHigh = forecast.high;
    closeExpect = r2(Math.min(forecast.high, Math.max(forecast.low, closeExpect)));
  }
  path.push({ t: closeSec, price: closeExpect, label: `Kapanış ≈ ${fmt(closeExpect)}` });

  return { bias, biasText, price, vwap, supports, resistances, path, closeExpect, closeLow, closeHigh, steps, alt };
}
