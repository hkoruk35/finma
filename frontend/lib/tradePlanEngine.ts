// Tek, paylasilan trade-plan motoru — /api/ask (deep analysis raporu),
// /api/preorder-analysis (grafik sayfasi) ve dolayisiyla TickerDetailPanel
// hepsi BU fonksiyonlari kullanir. Amac: ayni ticker icin farkli sayfalarda
// birbirini yalanlayan giris/stop/hedef degerleri gostermemek.
//
// Sayisal cekirdek, /api/ask/route.ts'deki eski calculateSupportResistance1h
// fonksiyonundan tasindi (pivot/ATR tabanli gercek destek-direnc mantigi,
// EMA tabanli degil) — Python uretim motoruyla (swing117_boga.py) ayni
// mantik. Buna ek olarak Python'daki %5 stop tabani (preorder-analysis'te
// hic yoktu, TS/ask kopyasinda da eksikti) burada da uygulanir.

function calcEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

export interface TradePlanZones {
  entryEngine: { valid: boolean; type: string; confidence: number };
  buyZone: { low: number; high: number };
  sellZone: { low: number; high: number }; // = TP1..TP3 araligi
  stopZone: { low: number; high: number };
  // Swing hedef merdiveni (7-90 gun): gunluk pivot direncleri + yuzde
  // tabanlari. TUM sayfalar (analysis / graphic / stock) bunlari gosterir.
  tp1: number;
  tp2: number;
  tp3: number;
  supportLevel: number;
  resistLevel: number;
  breakoutLevel: number; // BOS icin referans alinan yakin donemsel zirve
  ema20_1h: number; // early-momentum kosulu icin referans
  atr1d: number;
  atrPct: number;
  riskReward: number;
  riskUsd: number;
  rewardUsd: number;
  stopPrice: number; // = stopZone.high, kisa yol
  avgEntry: number;
}

export function calculateTradePlanZones(
  closes1d: number[],
  highs1d: number[],
  lows1d: number[],
  closes1h: number[] | null,
  highs1h: number[] | null,
  lows1h: number[] | null,
  opens1h: number[] | null,
  volumes1h: number[] | null,
  currentPrice: number
): TradePlanZones {
  const period = 14;
  const trs: number[] = [];
  for (let i = 1; i < closes1d.length; i++) {
    const hl = highs1d[i] - lows1d[i];
    const hc = Math.abs(highs1d[i] - closes1d[i - 1]);
    const lc = Math.abs(lows1d[i] - closes1d[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  let sum = 0;
  for (let i = Math.max(0, trs.length - period); i < trs.length; i++) sum += trs[i];
  const atr1d = trs.length > 0 ? sum / Math.min(period, trs.length) : currentPrice * 0.03;
  const atrPct = (atr1d / currentPrice) * 100;

  const macroSupport = Math.min(...lows1d.slice(-10));
  const macroResist = Math.max(...highs1d.slice(-15));

  let supportLevel = macroSupport;
  let resistLevel = macroResist;
  let breakoutLevel = macroResist;
  let ema20_1h = 0;

  let entryValid = false;
  let entryType = "WAITING_FOR_VOLUME_OR_SWEEP";
  let entryConfidence = 0;

  if (closes1h && closes1h.length >= 20 && highs1h && lows1h && opens1h && volumes1h) {
    const currC = closes1h.at(-1)!;
    const currO = opens1h.at(-1)!;
    const currH = highs1h.at(-1)!;
    const currL = lows1h.at(-1)!;
    const currV = volumes1h.at(-1)!;
    const prevC = closes1h.at(-2)!;
    const prevO = opens1h.at(-2)!;

    const pivotLows: number[] = [];
    const pivotHighs: number[] = [];
    for (let i = 2; i < lows1h.length - 2; i++) {
      if (lows1h[i] < lows1h[i - 1] && lows1h[i] < lows1h[i + 1]) pivotLows.push(lows1h[i]);
      if (highs1h[i] > highs1h[i - 1] && highs1h[i] > highs1h[i + 1]) pivotHighs.push(highs1h[i]);
    }

    const supportsBelow = pivotLows.filter((p) => p < currentPrice - atr1d * 0.4);
    if (supportsBelow.length > 0) supportLevel = Math.max(Math.max(...supportsBelow), macroSupport);

    const resistsAbove = pivotHighs.filter((p) => p > currentPrice + atr1d * 0.5);
    if (resistsAbove.length > 0) resistLevel = Math.min(Math.min(...resistsAbove), macroResist);

    const volSlice = volumes1h.slice(-20);
    const volAvg20 = volSlice.reduce((a, b) => a + b, 0) / 20;
    const isGreenCandle = currC > currO;
    const volumeSpikeBreakout = currV > volAvg20 * 1.3 && isGreenCandle;
    const volumeSpikeSweep = currV > volAvg20 * 1.8 && isGreenCandle;

    const body = Math.abs(currC - currO);
    const lowerWick = Math.min(currC, currO) - currL;
    const upperWick = currH - Math.max(currC, currO);
    const isPinbar = lowerWick > body * 2.0 && upperWick < body * 0.5;
    const isBullishEngulfing = isGreenCandle && prevC < prevO && currC > prevO && currO < prevC;
    const isLiquiditySweep = currL < supportLevel && currC > supportLevel;

    const recentHighSlice = highs1h.slice(-11, -1);
    breakoutLevel = recentHighSlice.length > 0 ? Math.max(...recentHighSlice) : Math.max(...highs1h.slice(0, -1));
    const isBos = currC > breakoutLevel && volumeSpikeBreakout;
    const isPullback = currL >= supportLevel && currL <= supportLevel + atr1d * 0.3;

    ema20_1h = calcEMA(closes1h, 20);
    const roc1h = prevC > 0 ? ((currC - prevC) / prevC) * 100 : 0;
    const isEarlyMomentum = currC > ema20_1h && roc1h > 0.8 && currV > volAvg20 * 1.15;

    // Bu string degerler Python uretim motoruyla (swing117_boga.py) ve
    // data/latest/stocks/*.json'daki degerlerle BIREBIR ayni tutulmali —
    // StockReportView.tsx bu degeri dogrudan kullaniciya gosteriyor.
    if (isLiquiditySweep && (isPinbar || volumeSpikeSweep)) {
      entryValid = true; entryType = "REVERSAL (Liquidity Sweep)"; entryConfidence = 95;
    } else if (isBos) {
      entryValid = true; entryType = "BREAKOUT (BOS)"; entryConfidence = 85;
    } else if (isEarlyMomentum) {
      entryValid = true; entryType = "EARLY MOMENTUM"; entryConfidence = 80;
    } else if (isPullback && (isPinbar || isBullishEngulfing) && volumeSpikeBreakout) {
      entryValid = true; entryType = "PULLBACK"; entryConfidence = 80;
    }
  }

  if (currentPrice - supportLevel < atr1d * 0.6) {
    supportLevel = currentPrice - atr1d * 0.8;
  }

  const isMomentumEntry = entryValid && ["BREAKOUT (BOS)", "REVERSAL (Liquidity Sweep)"].includes(entryType);

  let buyZoneLow: number, buyZoneHigh: number;
  if (isMomentumEntry) {
    buyZoneLow = currentPrice - atr1d * 0.25;
    buyZoneHigh = currentPrice + atr1d * 0.15;
  } else {
    buyZoneLow = supportLevel + atr1d * 0.2;
    buyZoneHigh = currentPrice + atr1d * 0.1;
  }
  if (buyZoneLow >= buyZoneHigh) buyZoneLow = buyZoneHigh - atr1d * 0.3;

  let stopHigh = supportLevel - atr1d * 0.5;
  let stopLow = stopHigh - atr1d * 0.2;

  // Python uretim motoruyla ayni %5 taban — stop, fiyata cok yakinsa
  // (dar araliklarda pivot destegi fiyatin hemen altinda olabiliyor),
  // en az %5 risk mesafesi zorlanir.
  const slFloor = currentPrice * 0.95;
  if (stopHigh > slFloor) {
    const shift = stopHigh - slFloor;
    stopHigh = slFloor;
    stopLow -= shift;
  }

  // Giris bir ARALIKTIR (buyZone). Turev hesaplar (risk, R/R, hedef
  // tabanlari) araligin orta noktasina baglanir — her sayfada ayni referans.
  const avgEntry = (buyZoneLow + buyZoneHigh) / 2;

  // ── Swing hedef merdiveni (7-90 gun operasyon) ──────────────────────────
  // /analysis'te dogrulanan formul: gunluk pivot direncleri (7 bar pencere,
  // %0.8 kumeleme — deep-analysis/buildSRFromPivots ile ayni) + yuzde
  // tabanlari (TP1 >= giris+%5, TP2 >= +%10, TP3 >= +%15). Eski
  // sellZone = 2R..4R mantigi ATR'e bagliydi ve scalp seviyesinde dar
  // hedefler uretiyordu; swing icin yapisal seviyeler esastir.
  const WIN = 7;
  const pivotHighsD: number[] = [];
  for (let i = WIN; i < highs1d.length - WIN; i++) {
    const left = highs1d.slice(i - WIN, i);
    const right = highs1d.slice(i + 1, i + WIN + 1);
    if (highs1d[i] >= Math.max(...left) && highs1d[i] >= Math.max(...right)) {
      pivotHighsD.push(highs1d[i]);
    }
  }
  const ladder: number[] = [];
  let lastLvl = -Infinity;
  for (const v of [...pivotHighsD].sort((a, b) => a - b)) {
    if (v - lastLvl > lastLvl * 0.008) { ladder.push(v); lastLvl = v; }
  }
  const hi52 = Math.max(...highs1d);
  const resAbove = ladder.filter((r) => r > avgEntry * 1.02);
  const tp1 = Math.max(resAbove[0] ?? 0, avgEntry * 1.05);
  const tp2 = Math.max(resAbove[1] ?? 0, avgEntry * 1.1, tp1 * 1.02);
  const tp3 = Math.max(resAbove[2] ?? hi52, avgEntry * 1.15, tp2 * 1.02);

  const sellZoneLow = tp1;
  const sellZoneHigh = tp3;

  const actualRisk = avgEntry - stopHigh;
  const actualReward = tp2 - avgEntry; // orta hedef — temsili R/R
  const rrRatio = actualRisk > 0 ? actualReward / actualRisk : 0;

  return {
    entryEngine: { valid: entryValid, type: entryType, confidence: entryConfidence },
    buyZone: { low: +buyZoneLow.toFixed(2), high: +buyZoneHigh.toFixed(2) },
    sellZone: { low: +sellZoneLow.toFixed(2), high: +sellZoneHigh.toFixed(2) },
    stopZone: { low: +stopLow.toFixed(2), high: +stopHigh.toFixed(2) },
    tp1: +tp1.toFixed(2),
    tp2: +tp2.toFixed(2),
    tp3: +tp3.toFixed(2),
    supportLevel: +supportLevel.toFixed(2),
    resistLevel: +resistLevel.toFixed(2),
    breakoutLevel: +breakoutLevel.toFixed(2),
    ema20_1h: +ema20_1h.toFixed(2),
    atr1d: +atr1d.toFixed(2),
    atrPct: +atrPct.toFixed(2),
    riskReward: +rrRatio.toFixed(2),
    riskUsd: +actualRisk.toFixed(2),
    rewardUsd: +actualReward.toFixed(2),
    stopPrice: +stopHigh.toFixed(2),
    avgEntry: +avgEntry.toFixed(2),
  };
}

// ── Gerekce metinleri (EMA / VWAP / Hacim / RSI / giris kosulu / stop gerekcesi) ──

export interface RationaleInputs {
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number;
  rvol: number;
  rsi: number;
  zones: TradePlanZones;
  lang: "en" | "tr";
}

export interface TradePlanRationale {
  entryCondition: string;
  stopRationale: string;
  ema: string;
  vwap: string;
  volume: string;
  rsi: string;
}

const fmt$ = (n: number) => `$${n.toFixed(2)}`;

export function buildTradePlanRationale(input: RationaleInputs): TradePlanRationale {
  const { price, ema20, ema50, ema200, vwap, rvol, rsi, zones, lang } = input;
  const en = lang === "en";

  // ── Giris kosulu ────────────────────────────────────────────────────────
  let entryCondition: string;
  switch (zones.entryEngine.type) {
    case "REVERSAL (Liquidity Sweep)":
      entryCondition = en
        ? `Buy on a reversal — if price sweeps below ${fmt$(zones.supportLevel)} support then reclaims and closes back above it on strong volume.`
        : `Ters donus alimi — fiyat ${fmt$(zones.supportLevel)} destegini asagi kirip guclu hacimle geri ustune kapanirsa.`;
      break;
    case "BREAKOUT (BOS)":
      entryCondition = en
        ? `Buy if the 1h candle closes above ${fmt$(zones.breakoutLevel)}, confirming a breakout with volume.`
        : `1 saatlik mum ${fmt$(zones.breakoutLevel)} seviyesinin uzerinde, hacimle birlikte kapanirsa alim.`;
      break;
    case "EARLY MOMENTUM":
      entryCondition = en
        ? `Buy while price holds above the 1h EMA20 (${fmt$(zones.ema20_1h)}) with rising volume — early momentum confirmation.`
        : `Fiyat 1 saatlik EMA20 (${fmt$(zones.ema20_1h)}) uzerinde tutunup hacim artarsa erken momentum alimi.`;
      break;
    case "PULLBACK":
      entryCondition = en
        ? `Buy on a pullback that holds above ${fmt$(zones.supportLevel)} support with a bullish reversal candle.`
        : `Fiyat ${fmt$(zones.supportLevel)} destegi ustunde tutunup yukselis mumu olusturursa geri cekilme alimi.`;
      break;
    default:
      entryCondition = en
        ? `No confirmed trigger yet — wait for either a break above ${fmt$(zones.resistLevel)} resistance or a pullback to ${fmt$(zones.supportLevel)} support.`
        : `Henuz net bir tetikleyici yok — ${fmt$(zones.resistLevel)} direncinin kirilmasini veya ${fmt$(zones.supportLevel)} destegine cekilmeyi bekle.`;
  }

  // ── Stop gerekcesi (en yakin EMA + VWAP referansi) ──────────────────────
  const emaCandidates: { label: string; value: number }[] = [
    { label: "EMA20", value: ema20 },
    { label: "EMA50", value: ema50 },
    { label: "EMA200", value: ema200 },
  ];
  const nearestEma = emaCandidates.reduce((a, b) =>
    Math.abs(b.value - zones.stopPrice) < Math.abs(a.value - zones.stopPrice) ? b : a
  );
  const stopRationale = en
    ? `Stop-loss at ${fmt$(zones.stopPrice)} — invalidated if price closes below the ${nearestEma.label} (${fmt$(nearestEma.value)}) or below the day's VWAP (${fmt$(vwap)}) on a daily close.`
    : `Stop-loss ${fmt$(zones.stopPrice)} seviyesinde — fiyat ${nearestEma.label} (${fmt$(nearestEma.value)}) veya gunluk VWAP (${fmt$(vwap)}) altinda gun kapatirsa gecersiz sayilir.`;

  // ── EMA yapisi ───────────────────────────────────────────────────────────
  let ema: string;
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
    ema = en
      ? `Price is trading above a fully bullish EMA stack (20>50>200) — established uptrend.`
      : `Fiyat tam yukselis EMA dizilimi (20>50>200) uzerinde — yerlesik yukselis trendi.`;
  } else if (price > ema50) {
    ema = en
      ? `Price is above its 50-day EMA (${fmt$(ema50)}), but the shorter-term structure is mixed.`
      : `Fiyat 50 gunluk EMA'nin (${fmt$(ema50)}) uzerinde, ancak kisa vadeli yapi karisik.`;
  } else {
    ema = en
      ? `Price has broken below its 50-day EMA (${fmt$(ema50)}) — a bearish signal, trend is weakening.`
      : `Fiyat 50 gunluk EMA'nin (${fmt$(ema50)}) altina sarkti — dususu isaret eder, trend zayifliyor.`;
  }

  // ── VWAP ────────────────────────────────────────────────────────────────
  const vwap_ = price >= vwap
    ? (en
        ? `Price is trading above the intraday VWAP (${fmt$(vwap)}), showing buyers in control today.`
        : `Fiyat gun ici VWAP'in (${fmt$(vwap)}) uzerinde — bugun alicilar kontrolde.`)
    : (en
        ? `Price is below the intraday VWAP (${fmt$(vwap)}), showing sellers in control today.`
        : `Fiyat gun ici VWAP'in (${fmt$(vwap)}) altinda — bugun saticilar kontrolde.`);

  // ── Hacim ───────────────────────────────────────────────────────────────
  let volume: string;
  if (rvol >= 1.5) {
    volume = en
      ? `Volume is running ${rvol.toFixed(1)}x above the 30-day average, confirming strong participation.`
      : `Hacim 30 gunluk ortalamanin ${rvol.toFixed(1)} kati — guclu katilimi dogruluyor.`;
  } else if (rvol >= 1.0) {
    volume = en ? `Volume is near its 30-day average — normal participation.` : `Hacim 30 gunluk ortalamaya yakin — normal katilim.`;
  } else {
    volume = en
      ? `Volume is below average (${rvol.toFixed(1)}x) — lower conviction, size positions accordingly.`
      : `Hacim ortalamanin altinda (${rvol.toFixed(1)}x) — dusuk inanc, pozisyon buyuklugunu ona gore ayarla.`;
  }

  // ── RSI ─────────────────────────────────────────────────────────────────
  let rsiText: string;
  if (rsi >= 70) {
    rsiText = en
      ? `RSI at ${rsi.toFixed(0)} is in overbought territory — momentum may be due for a pause.`
      : `RSI ${rsi.toFixed(0)} asiri alim bolgesinde — momentum bir sure duraklayabilir.`;
  } else if (rsi >= 55) {
    rsiText = en ? `RSI at ${rsi.toFixed(0)} shows healthy bullish momentum.` : `RSI ${rsi.toFixed(0)} saglikli yukselis momentumu gosteriyor.`;
  } else if (rsi <= 30) {
    rsiText = en
      ? `RSI at ${rsi.toFixed(0)} is in oversold territory — potential for a bounce.`
      : `RSI ${rsi.toFixed(0)} asiri satim bolgesinde — tepki yukselisi potansiyeli var.`;
  } else if (rsi <= 45) {
    rsiText = en ? `RSI at ${rsi.toFixed(0)} shows weak/bearish momentum.` : `RSI ${rsi.toFixed(0)} zayif/dususu momentum gosteriyor.`;
  } else {
    rsiText = en ? `RSI at ${rsi.toFixed(0)} is neutral.` : `RSI ${rsi.toFixed(0)} notr bolgede.`;
  }

  return { entryCondition, stopRationale, ema, vwap: vwap_, volume, rsi: rsiText };
}
