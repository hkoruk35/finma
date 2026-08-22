/**
 * SPX SuperTrade — 0DTE Opsiyon Modelleme ve Runner Simülasyonu
 * Primler Black-Scholes ile modellenir (r=0, temettüsüz); örtük oynaklık
 * VIX'ten türetilir ve 0DTE gülümsemesi (smile) ile ayarlanır.
 * Değerler TEORİKTİR — canlı OPRA kotasyonu değildir.
 */

import type { Direction, FrameLite, OptionQuote, RunnerResult, RunnerSimulation } from "./types";

const MINUTES_PER_YEAR = 525600;
const CONTRACT_MULTIPLIER = 100;

/** Abramowitz–Stegun yaklaşımıyla standart normal kümülatif dağılım */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export interface OptionPricing {
  price: number;
  delta: number;
  theta: number; // günlük
}

/**
 * @param s spot fiyat
 * @param k kullanım fiyatı
 * @param minutesLeft vadeye kalan dakika
 * @param iv yıllık örtük oynaklık (0.15 = %15)
 */
export function priceOption(
  s: number,
  k: number,
  minutesLeft: number,
  iv: number,
  isCall: boolean
): OptionPricing {
  const t = Math.max(minutesLeft, 1) / MINUTES_PER_YEAR;
  const sigma = Math.max(iv, 0.01);
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(s / k) + (sigma * sigma / 2) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const nd1 = normCdf(d1);
  const nd2 = normCdf(d2);
  const pdf = 0.3989422804014327 * Math.exp((-d1 * d1) / 2);

  const price = isCall ? s * nd1 - k * nd2 : k * normCdf(-d2) - s * normCdf(-d1);
  const delta = isCall ? nd1 : nd1 - 1;
  const theta = (-(s * pdf * sigma) / (2 * sqrtT)) / 365;

  let tickPrice = price;
  if (price < 3.0) {
    tickPrice = Math.round(price * 20) / 20;
    tickPrice = Math.max(0.05, tickPrice);
  } else {
    tickPrice = Math.round(price * 10) / 10;
  }

  return {
    price: tickPrice,
    delta: Math.round(delta * 1000) / 1000,
    theta: Math.round(theta * 100) / 100,
  };
}

/** 0DTE örtük oynaklık: VIX tabanı + moneyness gülümsemesi */
export function impliedVolFor(vix: number, spot: number, strike: number): number {
  const base = Math.max(0.08, (Number.isFinite(vix) && vix > 0 ? vix : 15) / 100) * 1.15;
  const moneyness = Math.abs(strike - spot) / spot;
  return base * (1 + 28 * moneyness);
}

export function minutesToClose(nowMinutesEt: number): number {
  return Math.max(5, 16 * 60 - nowMinutesEt);
}

/**
 * 1-sigma teorik hareket (spot ile aynı fiyat biriminde), ATM taban örtük
 * oynaklık ve vadeye kalan süreye göre. Opsiyon yapı genişlikleri (spread /
 * condor / butterfly kanat mesafeleri) bu değere ORANLA belirlenmelidir —
 * sabit endeks puanı (ör. "10 puan") KULLANILMAMALIDIR: SPX/NDX gibi yüksek
 * nominal değerli varlıklarda sabit puanlar beklenen harekete kıyasla önemsiz
 * kalır ve neredeyse aynı fiyatlı bacaklar (dolayısıyla anlamsız derecede
 * düşük net kredi/maliyet farkı) üretir; SPY/QQQ gibi düşük fiyatlı
 * varlıklarda ise orantısız derecede geniş kalır. Bu fonksiyon her varlık ve
 * her IV/vade kombinasyonu için tutarlı, piyasa koşullarına duyarlı genişlik
 * üretir.
 */
export function expectedMove(spot: number, vix: number, minutesLeft: number): number {
  const iv = impliedVolFor(vix, spot, spot); // ATM taban IV (moneyness gülümsemesi sıfır)
  const t = Math.max(minutesLeft, 1) / MINUTES_PER_YEAR;
  return spot * iv * Math.sqrt(t);
}

/** Bir değeri, varlığın kendi ölçeğine uygun bir strike adımının en yakın katına yuvarlar */
export function roundToStep(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}

export interface ChainInput {
  spot: number;
  vix: number;
  minutesLeft: number;
  type: "CALL" | "PUT";
  /** Hedef fiyat — "hedefe göre beklenen getiri" sütunu için */
  targetPrice: number;
  scale: number;
  offsets?: number[];
}

export function buildChain(input: ChainInput): OptionQuote[] {
  const { spot, vix, minutesLeft, type, targetPrice, scale } = input;
  const isCall = type === "CALL";
  const step = 5 * scale;
  const atm = Math.round(spot / step) * step;
  const offsets = input.offsets ?? [0, step, 2 * step, 3 * step, 4 * step, 5 * step, 6 * step];

  return offsets.map((offset) => {
    const strike = isCall ? atm + offset : atm - offset;
    const iv = impliedVolFor(vix, spot, strike);
    const now = priceOption(spot, strike, minutesLeft, iv, isCall);

    // Hedefe ulaşıldığında kalan süre yaklaşık %60 varsayılır
    const atTarget = priceOption(
      targetPrice,
      strike,
      Math.max(5, minutesLeft * 0.6),
      impliedVolFor(vix, targetPrice, strike),
      isCall
    );

    const otmPts = isCall ? strike - spot : spot - strike;

    return {
      label: offset === 0 ? "ATM" : `${offset} OTM`,
      strike,
      type,
      otmPts: Math.round(otmPts * 100) / 100,
      otmPct: Math.round((Math.abs(otmPts) / spot) * 10000) / 100,
      premium: now.price,
      delta: now.delta,
      theta: now.theta,
      breakeven: Math.round((isCall ? strike + now.price : strike - now.price) * 100) / 100,
      premiumAtTarget: atTarget.price,
      targetReturnPct: Math.round(((atTarget.price - now.price) / now.price) * 1000) / 10,
      moneyness: offset === 0 ? "ATM" : "OTM",
    };
  });
}

// ── Runner modelleri ─────────────────────────────────────────────

interface ModelDef {
  id: string;
  name: string;
  rule: string;
}

const MODELS: ModelDef[] = [
  { id: "A", name: "Sabit hedef", rule: "Prim +%50 olunca tamamı kapanır" },
  { id: "B", name: "Maliyet stop", rule: "+%30'dan sonra stop girişe çekilir" },
  { id: "C", name: "Kâr koruma", rule: "+%100'den sonra stop +%50'ye çekilir" },
  { id: "D", name: "Zirve takip", rule: "En yüksek primden %20 geri çekilince çıkılır" },
  { id: "E", name: "Yapı takip", rule: "Spot tetik seviyesine geri dönünce çıkılır" },
];

export interface RunnerInput {
  frames: FrameLite[];
  vix: number;
  scale: number;
  contracts?: number;
}

/**
 * Gerçek fiyat yolundan runner modellerini simüle eder.
 * Giriş, gün içinde ilk kez yönsel duruma (EARLY/CONFIRMED/STRONG) geçilen bardır.
 */
export function simulateRunners(input: RunnerInput): RunnerSimulation {
  const { frames, vix, scale } = input;
  const contracts = input.contracts ?? 2;

  const empty: RunnerSimulation = {
    available: false,
    reason: "Bu seansta henüz yönsel bir sinyal tetiklenmedi.",
    direction: "NEUTRAL",
    strike: 0,
    entryTime: "",
    entryIndex: -1,
    contracts,
    models: [],
    bestId: null,
  };

  if (!frames.length) return { ...empty, reason: "Seans verisi bulunamadı." };

  const ENTRY_STATES = [
    "EARLY_LONG",
    "EARLY_SHORT",
    "CONFIRMED_LONG",
    "CONFIRMED_SHORT",
    "STRONG_LONG",
    "STRONG_SHORT",
  ];

  // En güncel yönsel sinyal bloğunu bul: önce son giriş sinyalini,
  // ardından o bloğun başlangıcını geriye doğru tarar. Böylece gün içinde
  // birden fazla kurulum olduğunda en son (aktif) işlem gösterilir.
  let lastEntry = -1;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (ENTRY_STATES.includes(frames[i].state)) {
      lastEntry = i;
      break;
    }
  }
  if (lastEntry < 0) return empty;

  const direction: Direction = frames[lastEntry].state.includes("LONG") ? "LONG" : "SHORT";

  let blockStart = lastEntry;
  while (blockStart > 0 && frames[blockStart - 1].state.includes(direction)) blockStart--;

  let entryIdx = blockStart;
  while (entryIdx < lastEntry && !ENTRY_STATES.includes(frames[entryIdx].state)) entryIdx++;

  const entryFrame = frames[entryIdx];
  const isCall = direction === "LONG";
  const spot = entryFrame.spotPrice;
  const step = 5 * scale;
  const strike = Math.round(spot / step) * step;
  const triggerLevel = entryFrame.trigger || spot;

  // Prim yolunu üret
  const path = frames.slice(entryIdx).map((f) => {
    const [hh, mm] = f.timeLabel.split(":").map(Number);
    const minutesLeft = minutesToClose(hh * 60 + mm);
    const iv = impliedVolFor(vix, f.spotPrice, strike);
    return {
      frame: f,
      premium: priceOption(f.spotPrice, strike, minutesLeft, iv, isCall).price,
    };
  });

  const entryPremium = path[0].premium;
  if (!(entryPremium > 0)) return { ...empty, reason: "Prim modellenemedi." };

  const models: RunnerResult[] = MODELS.map((def) => {
    let exitPremium = path[path.length - 1].premium;
    let exitTime: string | null = null;
    let peak = entryPremium;
    let trough = entryPremium;
    let open = true;

    for (let i = 1; i < path.length; i++) {
      const p = path[i].premium;
      peak = Math.max(peak, p);
      trough = Math.min(trough, p);
      const gain = (p - entryPremium) / entryPremium;
      const peakGain = (peak - entryPremium) / entryPremium;

      let shouldExit = false;

      if (def.id === "A") {
        if (gain >= 0.5) shouldExit = true;
      } else if (def.id === "B") {
        if (peakGain >= 0.3 && p <= entryPremium) shouldExit = true;
      } else if (def.id === "C") {
        if (peakGain >= 1.0 && gain <= 0.5) shouldExit = true;
      } else if (def.id === "D") {
        if (peak > entryPremium && p <= peak * 0.8) shouldExit = true;
      } else if (def.id === "E") {
        const px = path[i].frame.spotPrice;
        const broken = isCall ? px < triggerLevel : px > triggerLevel;
        if (broken) shouldExit = true;
      }

      // Ortak koruma: prim %60 erirse çık
      if (!shouldExit && gain <= -0.6) shouldExit = true;

      if (shouldExit) {
        exitPremium = p;
        exitTime = path[i].frame.timeLabel;
        open = false;
        break;
      }
    }

    const pnl = (exitPremium - entryPremium) * CONTRACT_MULTIPLIER * contracts;
    const maxPnl = (peak - entryPremium) * CONTRACT_MULTIPLIER * contracts;
    const drawdownPct = peak > 0 ? Math.round(((peak - trough) / peak) * -1000) / 10 : 0;

    return {
      id: def.id,
      name: def.name,
      rule: def.rule,
      entryPremium: Math.round(entryPremium * 100) / 100,
      exitPremium: Math.round(exitPremium * 100) / 100,
      entryTime: entryFrame.timeLabel,
      exitTime,
      open,
      pnl: Math.round(pnl * 100) / 100,
      maxPnl: Math.round(maxPnl * 100) / 100,
      drawdownPct,
    };
  });

  const best = models.reduce((a, b) => (b.pnl > a.pnl ? b : a), models[0]);

  return {
    available: true,
    direction,
    strike,
    entryTime: entryFrame.timeLabel,
    entryIndex: entryIdx,
    contracts,
    models,
    bestId: best?.id ?? null,
  };
}
