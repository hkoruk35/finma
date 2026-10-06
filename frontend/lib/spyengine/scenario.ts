/**
 * SPY Engine — İki bacaklı senaryo + gün tipi + 0DTE prim tahmini (saf).
 *
 * Kullanıcının oyunu: açılış yönünde 1. bacak (ör. 768,8 → 772 direnç, call),
 * dirençte dönüşle 2. bacak (772 → 766 destek, put). Burada sistemin KENDİ
 * seviyelerinden (harita destek/direnç: likidite, POC/VA, Fibonacci, ADR,
 * opsiyon duvarları) bacak hedefleri, süreleri ve tahmini prim katları üretilir.
 *
 * 58–60 seanslık ölçüm (2026-07 → 10, 5m):
 *   • 09:55 kararından sonra 2 saat içinde yönde ≥3 puan: %24 (ort. 55 dk)
 *     (gün tipi artık davranıştan okunur: bkz. dayType.ts — VIX eşiği yanlış alarm veriyordu)
 *   • İlk hedefe (≥1 puan uzaktaki ilk seviye, ort. 2,3 puan) 2 saatte ulaşma %48, ort. 52 dk
 *   • Hedefe ulaşınca 90 dk içinde ≥3 puan DÖNÜŞ yalnızca %7; dönüş>devam %53 (yazı-tura)
 *     → 2. bacak ancak 5m dönüş işaretleri GELİRSE düşünülmeli.
 * Prim tahmini Black-Scholes'tur (IV ≈ VIX); gerçek 0DTE fiyatı spread, IV
 * eğrisi ve likiditeyle farklı olabilir — yalnızca büyüklük fikri verir.
 */

// ── Black-Scholes (r ≈ 0; 0DTE için faiz etkisi ihmal edilebilir) ──
function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
/** T: yıl cinsinden (işlem dakikası / (252×390)) */
export function bsPrice(isCall: boolean, S: number, K: number, T: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) return Math.max(0, isCall ? S - K : K - S);
  const v = sigma * Math.sqrt(T);
  const d1 = Math.log(S / K) / v + v / 2, d2 = d1 - v;
  return isCall ? S * ncdf(d1) - K * ncdf(d2) : K * ncdf(-d2) - S * ncdf(-d1);
}
const yearsOf = (tradingMin: number) => Math.max(0, tradingMin) / (252 * 390);

export interface Leg {
  side: "CALL" | "PUT";
  from: number;
  to: number;
  toLabel: string;
  dist: number;
  /** Tahmini süre (dk) — ortalama saatlik hareketten */
  etaMin: number;
  strike: number;
  premiumIn: number;
  premiumOut: number;
  multiple: number;
  /** Bu bacak için ölçülmüş gerçekleşme notu */
  odds: string;
  /** Giriş priminin kaynağı (canlı zincir / model) */
  source: string;
}

export interface Scenario {
  dir: "UP" | "DOWN";
  dirSource: string;
  leg1: Leg | null;
  leg2: Leg | null;
  iv: number;
  notes: string[];
}

export function buildScenario(input: {
  dir: "UP" | "DOWN";
  dirSource: string;
  price: number;
  /** Harita seviyeleri (fiyata göre sıralı) */
  supports: { price: number; label: string }[];
  resistances: { price: number; label: string }[];
  vwap: number | null;
  hourlyRange: number | null;
  vix: number | null;
  /** Gerçekleşen volatiliteden IV (scenarioTrack.realizedIV) — verilirse VIX yerine kullanılır */
  iv?: number | null;
  /** Kapanışa kalan işlem dakikası */
  minutesToClose: number;
  /** Canlı 0DTE kotasyonları (varsa giriş primi ve IV buradan) */
  quotes?: { strike: number; callMid: number | null; putMid: number | null; callIv: number | null; putIv: number | null }[] | null;
}): Scenario | null {
  const { dir, price, supports, resistances } = input;
  if (!Number.isFinite(price) || input.minutesToClose <= 0) return null;
  // VIX 30 günlük vadedir; 0DTE için gerçekleşen volatilite daha doğru (verilmezse VIX'in %65'i)
  const iv = input.iv != null ? input.iv : Math.max(0.08, ((input.vix ?? 16) / 100) * 0.65);
  const hr = Math.max(0.5, input.hourlyRange ?? 1.2);
  const eta = (d: number) => Math.max(10, Math.round(((Math.abs(d) / hr) * 60) / 5) * 5);
  const real = (l: { label: string }) => !l.label.includes("yuvarlak");
  const ahead = (dir === "UP" ? resistances : supports).filter((l) => real(l) && Math.abs(l.price - price) >= 1);
  const behind = (dir === "UP" ? supports : resistances).filter((l) => real(l));

  const leg = (side: "CALL" | "PUT", from: number, to: number, toLabel: string, startMin: number, odds: string): Leg => {
    const strike = side === "CALL" ? Math.ceil(from) : Math.floor(from + 0.5);
    const e = eta(to - from);
    // canlı zincir: yalnız 1. bacakta (giriş şimdi) piyasa fiyatı/IV anlamlı; 2. bacak gelecekte olduğu için model
    const q = startMin === 0 ? input.quotes?.find((x) => x.strike === strike) : undefined;
    const qIv = side === "CALL" ? q?.callIv : q?.putIv;
    const sig = qIv ?? iv;
    const live = side === "CALL" ? q?.callMid : q?.putMid;
    const pin = live ?? bsPrice(side === "CALL", from, strike, yearsOf(input.minutesToClose - startMin), sig);
    const pout = bsPrice(side === "CALL", to, strike, yearsOf(input.minutesToClose - startMin - e), sig);
    return {
      side, from, to, toLabel, dist: Math.round(Math.abs(to - from) * 100) / 100, etaMin: e, strike,
      premiumIn: Math.round(pin * 100) / 100, premiumOut: Math.round(pout * 100) / 100,
      multiple: pin > 0.01 ? Math.round((pout / pin) * 10) / 10 : 0, odds,
      source: live != null ? `canlı zincir orta fiyatı${qIv ? `, IV %${(qIv * 100).toFixed(0)}` : ""}` : `model (IV %${(sig * 100).toFixed(0)})`,
    };
  };

  const t1 = ahead[0] ?? null;
  const leg1 = t1
    ? leg(dir === "UP" ? "CALL" : "PUT", price, t1.price, t1.label, 0,
        "İlk hedefe 2 saatte ulaşma %48 (ort. 52 dk); 09:55 sonrası ≥3 puan %24 — gün tipine göre %11–43.")
    : null;

  // 2. bacak: hedefte dönüş → girişin öbür tarafındaki ilk gerçek seviye (yoksa VWAP)
  let leg2: Leg | null = null;
  if (leg1) {
    const beyond = behind.filter((l) => (dir === "UP" ? l.price < price - 0.5 : l.price > price + 0.5));
    const tgt = beyond[0] ?? (input.vwap != null && (dir === "UP" ? input.vwap < leg1.to - 1 : input.vwap > leg1.to + 1) ? { price: input.vwap, label: "VWAP" } : null);
    if (tgt) {
      leg2 = leg(dir === "UP" ? "PUT" : "CALL", leg1.to, tgt.price, tgt.label, leg1.etaMin,
        "Hedefte ≥3 puan dönüş yalnızca %7, dönüş>devam %53 — YALNIZCA 5m erken dönüş işareti gelirse (ters fitil, EMA20/VWAP kaybı).");
    }
  }

  const notes: string[] = [];
  if (!t1) notes.push(`${dir === "UP" ? "Yukarıda" : "Aşağıda"} ≥1 puan uzaklıkta ölçülmüş seviye yok — hedef belirsiz.`);
  notes.push(`Prim tahmini Black-Scholes, IV ≈ VIX (${(iv * 100).toFixed(1)}%); gerçek 0DTE fiyatı spread/IV eğrisiyle farklı olabilir.`);
  notes.push("Süre tahmini ortalama saatlik hareketten; sıkışma günlerinde uzar.");
  return { dir, dirSource: input.dirSource, leg1, leg2, iv, notes };
}
