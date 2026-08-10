import { formatNumber } from "@/lib/formatNumber";

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
    buyZone: { low: +formatNumber(buyZoneLow, 2), high: +formatNumber(buyZoneHigh, 2) },
    sellZone: { low: +formatNumber(sellZoneLow, 2), high: +formatNumber(sellZoneHigh, 2) },
    stopZone: { low: +formatNumber(stopLow, 2), high: +formatNumber(stopHigh, 2) },
    tp1: +formatNumber(tp1, 2),
    tp2: +formatNumber(tp2, 2),
    tp3: +formatNumber(tp3, 2),
    supportLevel: +formatNumber(supportLevel, 2),
    resistLevel: +formatNumber(resistLevel, 2),
    breakoutLevel: +formatNumber(breakoutLevel, 2),
    ema20_1h: +formatNumber(ema20_1h, 2),
    atr1d: +formatNumber(atr1d, 2),
    atrPct: +formatNumber(atrPct, 2),
    riskReward: +formatNumber(rrRatio, 2),
    riskUsd: +formatNumber(actualRisk, 2),
    rewardUsd: +formatNumber(actualReward, 2),
    stopPrice: +formatNumber(stopHigh, 2),
    avgEntry: +formatNumber(avgEntry, 2),
  };
}

// ── Gerekce metinleri (EMA / VWAP / Hacim / RSI / giris kosulu / stop gerekcesi) ──
// 5 dil destekler (tr/en/es/fr/pt) — eskiden sadece tr/en vardi, es/fr/pt
// otomatik olarak en'e dusuyordu (grafik sayfasinda PT/ES/FR kullanicilari
// Ingilizce metin goruyordu). Her dil kendi metnini alir.

export type RationaleLang = "en" | "tr" | "es" | "fr" | "pt";

export interface RationaleInputs {
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number;
  rvol: number;
  rsi: number;
  zones: TradePlanZones;
  lang: RationaleLang;
}

export interface TradePlanRationale {
  entryCondition: string;
  stopRationale: string;
  ema: string;
  vwap: string;
  volume: string;
  rsi: string;
}

const fmt$ = (n: number) => `$${formatNumber(n, 2)}`;

function pick(lang: RationaleLang, map: Record<RationaleLang, string>): string {
  return map[lang] ?? map.en;
}

export function buildTradePlanRationale(input: RationaleInputs): TradePlanRationale {
  const { price, ema20, ema50, ema200, vwap, rvol, rsi, zones, lang } = input;

  // ── Giriş koşulu ────────────────────────────────────────────────────────
  let entryCondition: string;
  switch (zones.entryEngine.type) {
    case "REVERSAL (Liquidity Sweep)":
      entryCondition = pick(lang, {
        en: `Calculated entry range is ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Price sweeping below ${fmt$(zones.supportLevel)} support followed by a strong volume reclaim and candle close above it can reinforce upward momentum.`,
        tr: `Hesaplanan giriş aralığı ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)} seviyeleridir. Fiyatın ${fmt$(zones.supportLevel)} desteğinin altına sarkıp yüksek hacimle tekrar üzerine tutunarak mum kapatması yukarı yönlü olasılığı destekleyici bir unsur olabilir.`,
        es: `El rango de entrada calculado es ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Si el precio rompe por debajo del soporte de ${fmt$(zones.supportLevel)} y luego recupera y cierra por encima con volumen fuerte, puede respaldar el impulso alcista.`,
        fr: `La plage d'entrée calculée est de ${fmt$(zones.buyZone.low)} à ${fmt$(zones.buyZone.high)}. Un balayage sous le support de ${fmt$(zones.supportLevel)} suivi d'une réintégration avec du volume et d'une clôture au-dessus peut soutenir la dynamique haussière.`,
        pt: `O intervalo de entrada calculado é ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. O preço varrendo abaixo do suporte de ${fmt$(zones.supportLevel)} e recuperando com fechamento acima sob alto volume pode reforçar a tendência de alta.`,
      });
      break;
    case "BREAKOUT (BOS)":
      entryCondition = pick(lang, {
        en: `Calculated entry range is ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. A 1-hour candle closing above ${fmt$(zones.breakoutLevel)} resistance on expanding volume serves as key technical confirmation for continuation.`,
        tr: `Hesaplanan giriş aralığı ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)} seviyeleridir. 1 saatlik mum kapanışının ${fmt$(zones.breakoutLevel)} direnci üzerinde hacimli gerçekleşmesi yükseliş ivmesini destekleyici teknik bir göstergedir.`,
        es: `El rango de entrada calculado es ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Un cierre de vela de 1 hora por encima de la resistencia de ${fmt$(zones.breakoutLevel)} con volumen creciente sirve como confirmación técnica.`,
        fr: `La plage d'entrée calculée est de ${fmt$(zones.buyZone.low)} à ${fmt$(zones.buyZone.high)}. Une clôture de bougie 1h au-dessus de la résistance de ${fmt$(zones.breakoutLevel)} avec expansion du volume confirme techniquement la poursuite haussière.`,
        pt: `O intervalo de entrada calculado é ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Um fechamento de candle de 1h acima da resistência de ${fmt$(zones.breakoutLevel)} com volume expansivo serve como confirmação técnica.`,
      });
      break;
    case "EARLY MOMENTUM":
      entryCondition = pick(lang, {
        en: `Calculated entry range is ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Price holding above the 1-hour EMA20 (${fmt$(zones.ema20_1h)}) with rising volume trajectory can strengthen early momentum.`,
        tr: `Hesaplanan giriş aralığı ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)} seviyeleridir. Fiyatın 1 saatlik EMA20 (${fmt$(zones.ema20_1h)}) üzerinde kalması ve hacim yönünün yukarı seyretmesi erken momentumu destekleyici bir faktör olabilir.`,
        es: `El rango de entrada calculado es ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Mantenerse por encima de la EMA20 de 1h (${fmt$(zones.ema20_1h)}) con trayectoria de volumen alcista puede fortalecer el impulso inicial.`,
        fr: `La plage d'entrée calculée est de ${fmt$(zones.buyZone.low)} à ${fmt$(zones.buyZone.high)}. Le maintien au-dessus de l'EMA20 1h (${fmt$(zones.ema20_1h)}) avec un volume en hausse renforce le momentum initial.`,
        pt: `O intervalo de entrada calculado é ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. O preço se mantendo acima da EMA20 de 1h (${fmt$(zones.ema20_1h)}) com trajetória de volume crescente pode fortalecer o impulso inicial.`,
      });
      break;
    case "PULLBACK":
      entryCondition = pick(lang, {
        en: `Calculated entry range is ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Holding above ${fmt$(zones.supportLevel)} support and forming a bullish reversal candle provides technical confirmation for the setup.`,
        tr: `Hesaplanan giriş aralığı ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)} seviyeleridir. Fiyatın ${fmt$(zones.supportLevel)} desteği üzerinde tutunması ve dönüş mumu oluşturması yukarı yönlü potansiyeli güçlendirebilir.`,
        es: `El rango de entrada calculado es ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Mantenerse sobre el soporte de ${fmt$(zones.supportLevel)} y formar una vela alcista refuerza la validez técnica.`,
        fr: `La plage d'entrée calculée est de ${fmt$(zones.buyZone.low)} à ${fmt$(zones.buyZone.high)}. Le maintien au-dessus du support de ${fmt$(zones.supportLevel)} et la formation d'une bougie haussière renforcent la validité technique.`,
        pt: `O intervalo de entrada calculado é ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Manter-se acima do suporte de ${fmt$(zones.supportLevel)} e formar um candle de reversão alcista fortalece a validade técnica.`,
      });
      break;
    default:
      entryCondition = pick(lang, {
        en: `Calculated entry range is ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Evaluating volume expansion, RSI direction, and candle closes relative to ${fmt$(zones.resistLevel)} resistance or ${fmt$(zones.supportLevel)} support can assist in decision making.`,
        tr: `Hesaplanan giriş aralığı ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)} seviyeleridir. Karar verilirken hacim artışı, RSI yönü ve bir önceki mum kapanışının ${fmt$(zones.resistLevel)} direnci veya ${fmt$(zones.supportLevel)} desteği üzerindeki seyri takip edilebilir.`,
        es: `El rango de entrada calculado es ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Al tomar decisiones, se sugiere evaluar la expansión del volumen, la dirección del RSI y el cierre de velas respecto a la resistencia de ${fmt$(zones.resistLevel)} o soporte de ${fmt$(zones.supportLevel)}.`,
        fr: `La plage d'entrée calculée est de ${fmt$(zones.buyZone.low)} à ${fmt$(zones.buyZone.high)}. Lors de la prise de décision, l'expansion du volume, la direction du RSI et les clôtures de bougies par rapport à la résistance de ${fmt$(zones.resistLevel)} ou au support de ${fmt$(zones.supportLevel)} peuvent être observées.`,
        pt: `O intervalo de entrada calculado é ${fmt$(zones.buyZone.low)} – ${fmt$(zones.buyZone.high)}. Para auxílio na tomada de decisão, recomenda-se acompanhar a expansão de volume, direção do RSI e fechamentos em relação à resistência de ${fmt$(zones.resistLevel)} ou suporte de ${fmt$(zones.supportLevel)}.`,
      });
  }

  // ── Stop gerekçesi ──────────────────────────────────────────────────────
  const emaCandidates = [{ label: "EMA20", value: ema20 }, { label: "EMA50", value: ema50 }, { label: "EMA200", value: ema200 }];
  const nearestEma = emaCandidates.reduce((a, b) => Math.abs(b.value - zones.stopPrice) < Math.abs(a.value - zones.stopPrice) ? b : a);
  const stopRationale = pick(lang, {
    en: `Calculated stop-loss level is set at ${fmt$(zones.stopPrice)}. A daily close below ${nearestEma.label} (${fmt$(nearestEma.value)}) or daily VWAP (${fmt$(vwap)}) indicates technical invalidation of the structure.`,
    tr: `Hesaplanan stop-loss seviyesi ${fmt$(zones.stopPrice)} olarak belirlenmiştir. Fiyatın ${nearestEma.label} (${fmt$(nearestEma.value)}) veya günlük VWAP (${fmt$(vwap)}) altında gün kapatması durumunda teknik yapı geçersizlik kazanabilir.`,
    es: `El nivel de stop-loss calculado se fija en ${fmt$(zones.stopPrice)}. Un cierre diario por debajo de la ${nearestEma.label} (${fmt$(nearestEma.value)}) o del VWAP diario (${fmt$(vwap)}) señala la invalidación técnica de la estructura.`,
    fr: `Le niveau de stop-loss calculé est fixé à ${fmt$(zones.stopPrice)}. Une clôture journalière sous l'${nearestEma.label} (${fmt$(nearestEma.value)}) ou le VWAP journalier (${fmt$(vwap)}) indique une invalidation technique.`,
    pt: `O nível de stop-loss calculado é fixado em ${fmt$(zones.stopPrice)}. Um fechamento diário abaixo da ${nearestEma.label} (${fmt$(nearestEma.value)}) ou VWAP diário (${fmt$(vwap)}) indica potencial invalidação técnica da estrutura.`,
  });

  // ── EMA yapısı ───────────────────────────────────────────────────────────
  let ema = price > ema20 && ema20 > ema50 && ema50 > ema200 ? pick(lang, {
    en: `Price is trading above a fully bullish EMA stack (20>50>200) — established uptrend structure.`,
    tr: `Fiyat yükseliş sıralamasındaki EMA dizilimi (20>50>200) üzerinde seyrediyor — pozitif trend yapısına işaret etmektedir.`,
    es: `El precio cotiza por encima de una estructura de EMA totalmente alcista (20>50>200) — indica una estructura de tendencia positiva.`,
    fr: `Le prix évolue au-dessus d'une structure d'EMA totalement haussière (20>50>200) — indique une structure de tendance positive.`,
    pt: `O preço está negociando acima de uma estrutura de EMA totalmente altista (20>50>200) — indica uma estrutura de tendência positiva.`,
  }) : price > ema50 ? pick(lang, {
    en: `Price is above its 50-day EMA (${fmt$(ema50)}), while shorter-term structure displays mixed conditions.`,
    tr: `Fiyat 50 günlük EMA'nın (${fmt$(ema50)}) üzerinde seyrediyor, kısa vadeli yapı ise nötr/karışık bir görünümde.`,
    es: `El precio está por encima de su EMA de 50 días (${fmt$(ema50)}), mientras que la estructura de corto plazo muestra condiciones mixtas.`,
    fr: `Le prix est au-dessus de son EMA 50 jours (${fmt$(ema50)}), tandis que la structure à court terme affiche une configuration mitigée.`,
    pt: `O preço está acima da sua EMA de 50 dias (${fmt$(ema50)}), enquanto a estrutura de curto prazo exibe condições mistas.`,
  }) : pick(lang, {
    en: `Price is trading below its 50-day EMA (${fmt$(ema50)}) — indicating momentum slowing down.`,
    tr: `Fiyat 50 günlük EMA'nın (${fmt$(ema50)}) altında bulunuyor — trend ivmesinde yavaşlamaya işaret edebilir.`,
    es: `El precio cotiza por debajo de su EMA de 50 días (${fmt$(ema50)}) — puede indicar desaceleración en el impulso.`,
    fr: `Le prix évolue sous son EMA 50 jours (${fmt$(ema50)}) — peut indiquer un ralentissement du momentum.`,
    pt: `O preço está sendo negociado abaixo da sua EMA de 50 dias (${fmt$(ema50)}) — pode indicar desaceleração do impulso.`,
  });

  // ── VWAP ────────────────────────────────────────────────────────────────
  const vwap_ = pick(lang, price >= vwap ? {
    en: `Price is trading above the intraday VWAP (${fmt$(vwap)}), indicating positive intraday buyer orientation.`,
    tr: `Fiyat gün içi VWAP'ın (${fmt$(vwap)}) üzerinde seyrediyor — gün içi alıcı ağırlıklı bir yapıya işaret edebilir.`,
    es: `El precio cotiza por encima del VWAP intradía (${fmt$(vwap)}), lo que sugiere orientación comprador intradía.`,
    fr: `Le prix évolue au-dessus du VWAP intrajournalier (${fmt$(vwap)}), suggérant une orientation acheteuse au cours de la journée.`,
    pt: `O preço está negociando acima da VWAP intradiária (${fmt$(vwap)}), sugerindo orientação compradora no dia.`,
  } : {
    en: `Price is trading below the intraday VWAP (${fmt$(vwap)}), indicating intraday seller influence.`,
    tr: `Fiyat gün içi VWAP'ın (${fmt$(vwap)}) altında seyrediyor — gün içi satıcı baskısının öne çıktığı bir görünüme işaret edebilir.`,
    es: `El precio cotiza por debajo del VWAP intradía (${fmt$(vwap)}), lo que sugiere presión vendedora intradía.`,
    fr: `Le prix évolue sous le VWAP intrajournalier (${fmt$(vwap)}), suggérant une pression vendeuse intrajournalière.`,
    pt: `O preço está negociando abaixo da VWAP intradiária (${fmt$(vwap)}), sugerindo pressão vendedora no dia.`,
  });

  // ── Hacim ───────────────────────────────────────────────────────────────
  const volume = rvol >= 1.5 ? pick(lang, {
    en: `Volume is ${formatNumber(rvol, 1)}x above the 30-day average — indicating active market participation and a high probability of confirmation.`,
    tr: `Hacim 30 günlük ortalamanın ${formatNumber(rvol, 1)} katı seviyesinde — piyasa katılımının yüksek olduğunu ve hareketin teyit edilme olasılığının kuvvetli muhtemel olduğunu gösterir.`,
    es: `El volumen supera en ${formatNumber(rvol, 1)}x el promedio de 30 días — indica alta participación y una fuerte probabilidad de confirmación.`,
    fr: `Le volume est de ${formatNumber(rvol, 1)}x supérieur à la moyenne de 30 jours — indique une forte participation et une haute probabilité de confirmation.`,
    pt: `O volume está ${formatNumber(rvol, 1)}x acima da média de 30 dias — indica alta participação e forte probabilidade de confirmação.`,
  }) : rvol >= 1.0 ? pick(lang, {
    en: `Volume is near its 30-day average — standard market participation observed.`,
    tr: `Hacim 30 günlük ortalamaya yakın seviyede — standart piyasa katılımı gözleniyor.`,
    es: `El volumen está cerca de su promedio de 30 días — se observa una participación de mercado estándar.`,
    fr: `Le volume est proche de sa moyenne de 30 jours — participation standard au marché observée.`,
    pt: `O volume está próximo da sua média de 30 dias — observada participação padrão do mercado.`,
  }) : pick(lang, {
    en: `Volume is below average (${formatNumber(rvol, 1)}x) — volume confirmation is limited; position sizing can be managed according to risk preference.`,
    tr: `Hacim ortalamanın altında (${formatNumber(rvol, 1)}x) — hacim teyidi sınırlı kalabilir, pozisyon büyüklüğü kişisel risk yönetiminize göre ayarlanabilir.`,
    es: `El volumen está por debajo del promedio (${formatNumber(rvol, 1)}x) — la confirmación por volumen es limitada; ajuste el tamaño de posición según su gestión de riesgo.`,
    fr: `Le volume est inférieur à la moyenne (${formatNumber(rvol, 1)}x) — la confirmation par le volume est limitée ; la taille de position peut être ajustée selon votre gestion du risque.`,
    pt: `O volume está abaixo da média (${formatNumber(rvol, 1)}x) — a confirmação por volume é limitada; o tamanho da posição pode ser ajustado conforme sua gestão de risco.`,
  });

  // ── RSI ─────────────────────────────────────────────────────────────────
  const rsiText = rsi >= 70 ? pick(lang, {
    en: `RSI at ${formatNumber(rsi, 0)} is in overbought territory — short-term consolidation or momentum pause may be observed.`,
    tr: `RSI ${formatNumber(rsi, 0)} seviyesi ile aşırı alım bölgesinde — kısa vadede konsolidasyon veya momentum duraklaması gözlenebilir.`,
    es: `El RSI en ${formatNumber(rsi, 0)} está en zona de sobrecompra — se podría observar una consolidación o pausa a corto plazo.`,
    fr: `Le RSI à ${formatNumber(rsi, 0)} est en zone de surachat — une consolidation à court terme ou une pause du momentum peut être observée.`,
    pt: `O RSI em ${formatNumber(rsi, 0)} está em território de sobrecompra — consolidação de curto prazo ou pausa no impulso pode ser observada.`,
  }) : rsi >= 55 ? pick(lang, {
    en: `RSI at ${formatNumber(rsi, 0)} supports positive momentum.`,
    tr: `RSI ${formatNumber(rsi, 0)} seviyesinde pozitif momentumu destekliyor.`,
    es: `El RSI en ${formatNumber(rsi, 0)} respalda el impulso positivo.`,
    fr: `Le RSI à ${formatNumber(rsi, 0)} soutient le momentum positif.`,
    pt: `O RSI em ${formatNumber(rsi, 0)} suporta o impulso positivo.`,
  }) : rsi <= 30 ? pick(lang, {
    en: `RSI at ${formatNumber(rsi, 0)} is in oversold territory — potential for a technical bounce exists.`,
    tr: `RSI ${formatNumber(rsi, 0)} ile aşırı satım bölgesinde — tepki yükselişi olasılığı barındırabilir.`,
    es: `El RSI en ${formatNumber(rsi, 0)} está en zona de sobreventa — existe potencial para un rebote técnico.`,
    fr: `Le RSI à ${formatNumber(rsi, 0)} est en zone de survente — un potentiel de rebond technique existe.`,
    pt: `O RSI em ${formatNumber(rsi, 0)} está em território de sobrevenda — existe potencial para um repique técnico.`,
  }) : rsi <= 45 ? pick(lang, {
    en: `RSI at ${formatNumber(rsi, 0)} displays a weaker momentum structure.`,
    tr: `RSI ${formatNumber(rsi, 0)} seviyesinde zayıf momentum görünümü sergiliyor.`,
    es: `El RSI en ${formatNumber(rsi, 0)} muestra una estructura de impulso más débil.`,
    fr: `Le RSI à ${formatNumber(rsi, 0)} affiche une structure de momentum plus faible.`,
    pt: `O RSI em ${formatNumber(rsi, 0)} exibe uma estrutura de impulso mais fraca.`,
  }) : pick(lang, {
    en: `RSI at ${formatNumber(rsi, 0)} remains in a neutral range.`,
    tr: `RSI ${formatNumber(rsi, 0)} ile dengeli/nötr bir görünümde.`,
    es: `El RSI en ${formatNumber(rsi, 0)} se mantiene en un rango neutral.`,
    fr: `Le RSI à ${formatNumber(rsi, 0)} reste dans une plage neutre.`,
    pt: `O RSI em ${formatNumber(rsi, 0)} permanece em uma faixa neutra.`,
  });

  return { entryCondition, stopRationale, ema, vwap: vwap_, volume, rsi: rsiText };
}
