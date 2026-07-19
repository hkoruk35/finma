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

const fmt$ = (n: number) => `$${n.toFixed(2)}`;

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
        en: `Buy on a reversal — if price sweeps below ${fmt$(zones.supportLevel)} support then reclaims and closes back above it on strong volume.`,
        tr: `Ters dönüş alımı — fiyat ${fmt$(zones.supportLevel)} desteğini aşağı kırıp güçlü hacimle geri üstüne kapanırsa.`,
        es: `Compra en reversión — si el precio rompe por debajo del soporte de ${fmt$(zones.supportLevel)} y luego recupera y cierra por encima con volumen fuerte.`,
        fr: `Achat sur retournement — si le prix passe sous le support de ${fmt$(zones.supportLevel)} puis reprend et clôture au-dessus avec un fort volume.`,
        pt: `Compra na reversão — se o preço romper abaixo do suporte de ${fmt$(zones.supportLevel)} e depois recuperar e fechar acima com volume forte.`,
      });
      break;
    case "BREAKOUT (BOS)":
      entryCondition = pick(lang, {
        en: `Buy if the 1h candle closes above ${fmt$(zones.breakoutLevel)}, confirming a breakout with volume.`,
        tr: `1 saatlik mum ${fmt$(zones.breakoutLevel)} seviyesinin üzerinde, hacimle birlikte kapanırsa alım.`,
        es: `Compra si la vela de 1h cierra por encima de ${fmt$(zones.breakoutLevel)}, confirmando una ruptura con volumen.`,
        fr: `Achat si la bougie 1h clôture au-dessus de ${fmt$(zones.breakoutLevel)}, confirmant une cassure avec volume.`,
        pt: `Compra se o candle de 1h fechar acima de ${fmt$(zones.breakoutLevel)}, confirmando um rompimento com volume.`,
      });
      break;
    case "EARLY MOMENTUM":
      entryCondition = pick(lang, {
        en: `Buy while price holds above the 1h EMA20 (${fmt$(zones.ema20_1h)}) with rising volume — early momentum confirmation.`,
        tr: `Fiyat 1 saatlik EMA20 (${fmt$(zones.ema20_1h)}) üzerinde tutunup hacim artarsa erken momentum alımı.`,
        es: `Compra mientras el precio se mantenga sobre la EMA20 de 1h (${fmt$(zones.ema20_1h)}) con volumen creciente — confirmación de momentum temprano.`,
        fr: `Achat tant que le prix se maintient au-dessus de l'EMA20 1h (${fmt$(zones.ema20_1h)}) avec un volume croissant — confirmation d'un momentum précoce.`,
        pt: `Compra enquanto o preço se mantiver acima da EMA20 de 1h (${fmt$(zones.ema20_1h)}) com volume crescente — confirmação de momentum inicial.`,
      });
      break;
    case "PULLBACK":
      entryCondition = pick(lang, {
        en: `Buy on a pullback that holds above ${fmt$(zones.supportLevel)} support with a bullish reversal candle.`,
        tr: `Fiyat ${fmt$(zones.supportLevel)} desteği üstünde tutunup yükseliş mumu oluşturursa geri çekilme alımı.`,
        es: `Compra en un retroceso que se mantenga sobre el soporte de ${fmt$(zones.supportLevel)} con una vela de reversión alcista.`,
        fr: `Achat sur un repli qui se maintient au-dessus du support de ${fmt$(zones.supportLevel)} avec une bougie de retournement haussier.`,
        pt: `Compra em um recuo que se mantenha acima do suporte de ${fmt$(zones.supportLevel)} com um candle de reversão de alta.`,
      });
      break;
    default:
      entryCondition = pick(lang, {
        en: `No confirmed trigger yet — wait for either a break above ${fmt$(zones.resistLevel)} resistance or a pullback to ${fmt$(zones.supportLevel)} support.`,
        tr: `Henüz net bir tetikleyici yok — ${fmt$(zones.resistLevel)} direncinin kırılmasını veya ${fmt$(zones.supportLevel)} desteğine çekilmeyi bekle.`,
        es: `Aún no hay un disparador confirmado — espera una ruptura por encima de la resistencia de ${fmt$(zones.resistLevel)} o un retroceso al soporte de ${fmt$(zones.supportLevel)}.`,
        fr: `Aucun déclencheur confirmé pour l'instant — attends soit une cassure au-dessus de la résistance de ${fmt$(zones.resistLevel)}, soit un repli vers le support de ${fmt$(zones.supportLevel)}.`,
        pt: `Ainda não há um gatilho confirmado — aguarde um rompimento acima da resistência de ${fmt$(zones.resistLevel)} ou um recuo até o suporte de ${fmt$(zones.supportLevel)}.`,
      });
  }

  // ── Stop gerekçesi (en yakın EMA + VWAP referansı) ──────────────────────
  const emaCandidates: { label: string; value: number }[] = [
    { label: "EMA20", value: ema20 },
    { label: "EMA50", value: ema50 },
    { label: "EMA200", value: ema200 },
  ];
  const nearestEma = emaCandidates.reduce((a, b) =>
    Math.abs(b.value - zones.stopPrice) < Math.abs(a.value - zones.stopPrice) ? b : a
  );
  const stopRationale = pick(lang, {
    en: `Stop-loss at ${fmt$(zones.stopPrice)} — invalidated if price closes below the ${nearestEma.label} (${fmt$(nearestEma.value)}) or below the day's VWAP (${fmt$(vwap)}) on a daily close.`,
    tr: `Stop-loss ${fmt$(zones.stopPrice)} seviyesinde — fiyat ${nearestEma.label} (${fmt$(nearestEma.value)}) veya günlük VWAP (${fmt$(vwap)}) altında gün kapatırsa geçersiz sayılır.`,
    es: `Stop-loss en ${fmt$(zones.stopPrice)} — se invalida si el precio cierra por debajo de la ${nearestEma.label} (${fmt$(nearestEma.value)}) o por debajo del VWAP del día (${fmt$(vwap)}) en un cierre diario.`,
    fr: `Stop-loss à ${fmt$(zones.stopPrice)} — invalidé si le prix clôture sous l'${nearestEma.label} (${fmt$(nearestEma.value)}) ou sous le VWAP du jour (${fmt$(vwap)}) en clôture journalière.`,
    pt: `Stop-loss em ${fmt$(zones.stopPrice)} — invalidado se o preço fechar abaixo da ${nearestEma.label} (${fmt$(nearestEma.value)}) ou abaixo da VWAP do dia (${fmt$(vwap)}) no fechamento diário.`,
  });

  // ── EMA yapısı ───────────────────────────────────────────────────────────
  let ema: string;
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
    ema = pick(lang, {
      en: `Price is trading above a fully bullish EMA stack (20>50>200) — established uptrend.`,
      tr: `Fiyat tam yükseliş EMA dizilimi (20>50>200) üzerinde — yerleşik yükseliş trendi.`,
      es: `El precio cotiza por encima de una estructura de EMA totalmente alcista (20>50>200) — tendencia alcista establecida.`,
      fr: `Le prix évolue au-dessus d'une structure d'EMA totalement haussière (20>50>200) — tendance haussière établie.`,
      pt: `O preço está negociando acima de uma estrutura de EMA totalmente altista (20>50>200) — tendência de alta estabelecida.`,
    });
  } else if (price > ema50) {
    ema = pick(lang, {
      en: `Price is above its 50-day EMA (${fmt$(ema50)}), but the shorter-term structure is mixed.`,
      tr: `Fiyat 50 günlük EMA'nın (${fmt$(ema50)}) üzerinde, ancak kısa vadeli yapı karışık.`,
      es: `El precio está por encima de su EMA de 50 días (${fmt$(ema50)}), pero la estructura de corto plazo es mixta.`,
      fr: `Le prix est au-dessus de son EMA 50 jours (${fmt$(ema50)}), mais la structure court terme est mitigée.`,
      pt: `O preço está acima da sua EMA de 50 dias (${fmt$(ema50)}), mas a estrutura de curto prazo é mista.`,
    });
  } else {
    ema = pick(lang, {
      en: `Price has broken below its 50-day EMA (${fmt$(ema50)}) — a bearish signal, trend is weakening.`,
      tr: `Fiyat 50 günlük EMA'nın (${fmt$(ema50)}) altına sarktı — düşüşü işaret eder, trend zayıflıyor.`,
      es: `El precio ha roto por debajo de su EMA de 50 días (${fmt$(ema50)}) — señal bajista, la tendencia se debilita.`,
      fr: `Le prix est passé sous son EMA 50 jours (${fmt$(ema50)}) — signal baissier, la tendance s'affaiblit.`,
      pt: `O preço rompeu abaixo da sua EMA de 50 dias (${fmt$(ema50)}) — sinal de baixa, a tendência está enfraquecendo.`,
    });
  }

  // ── VWAP ────────────────────────────────────────────────────────────────
  const vwap_ = price >= vwap
    ? pick(lang, {
        en: `Price is trading above the intraday VWAP (${fmt$(vwap)}), showing buyers in control today.`,
        tr: `Fiyat gün içi VWAP'ın (${fmt$(vwap)}) üzerinde — bugün alıcılar kontrolde.`,
        es: `El precio cotiza por encima del VWAP intradía (${fmt$(vwap)}), mostrando a los compradores en control hoy.`,
        fr: `Le prix évolue au-dessus du VWAP intrajournalier (${fmt$(vwap)}), les acheteurs sont aux commandes aujourd'hui.`,
        pt: `O preço está negociando acima da VWAP intradiária (${fmt$(vwap)}), mostrando os compradores no controle hoje.`,
      })
    : pick(lang, {
        en: `Price is below the intraday VWAP (${fmt$(vwap)}), showing sellers in control today.`,
        tr: `Fiyat gün içi VWAP'ın (${fmt$(vwap)}) altında — bugün satıcılar kontrolde.`,
        es: `El precio está por debajo del VWAP intradía (${fmt$(vwap)}), mostrando a los vendedores en control hoy.`,
        fr: `Le prix est en dessous du VWAP intrajournalier (${fmt$(vwap)}), les vendeurs sont aux commandes aujourd'hui.`,
        pt: `O preço está abaixo da VWAP intradiária (${fmt$(vwap)}), mostrando os vendedores no controle hoje.`,
      });

  // ── Hacim ───────────────────────────────────────────────────────────────
  let volume: string;
  if (rvol >= 1.5) {
    volume = pick(lang, {
      en: `Volume is running ${rvol.toFixed(1)}x above the 30-day average, confirming strong participation.`,
      tr: `Hacim 30 günlük ortalamanın ${rvol.toFixed(1)} katı — güçlü katılımı doğruluyor.`,
      es: `El volumen está en ${rvol.toFixed(1)}x el promedio de 30 días, confirmando una fuerte participación.`,
      fr: `Le volume est à ${rvol.toFixed(1)}x la moyenne de 30 jours, confirmant une forte participation.`,
      pt: `O volume está em ${rvol.toFixed(1)}x a média de 30 dias, confirmando forte participação.`,
    });
  } else if (rvol >= 1.0) {
    volume = pick(lang, {
      en: `Volume is near its 30-day average — normal participation.`,
      tr: `Hacim 30 günlük ortalamaya yakın — normal katılım.`,
      es: `El volumen está cerca de su promedio de 30 días — participación normal.`,
      fr: `Le volume est proche de sa moyenne de 30 jours — participation normale.`,
      pt: `O volume está próximo da sua média de 30 dias — participação normal.`,
    });
  } else {
    volume = pick(lang, {
      en: `Volume is below average (${rvol.toFixed(1)}x) — lower conviction, size positions accordingly.`,
      tr: `Hacim ortalamanın altında (${rvol.toFixed(1)}x) — düşük inanç, pozisyon büyüklüğünü ona göre ayarla.`,
      es: `El volumen está por debajo del promedio (${rvol.toFixed(1)}x) — menor convicción, ajusta el tamaño de la posición en consecuencia.`,
      fr: `Le volume est en dessous de la moyenne (${rvol.toFixed(1)}x) — conviction plus faible, ajuste la taille de position en conséquence.`,
      pt: `O volume está abaixo da média (${rvol.toFixed(1)}x) — menor convicção, ajuste o tamanho da posição de acordo.`,
    });
  }

  // ── RSI ─────────────────────────────────────────────────────────────────
  let rsiText: string;
  if (rsi >= 70) {
    rsiText = pick(lang, {
      en: `RSI at ${rsi.toFixed(0)} is in overbought territory — momentum may be due for a pause.`,
      tr: `RSI ${rsi.toFixed(0)} aşırı alım bölgesinde — momentum bir süre duraklayabilir.`,
      es: `El RSI en ${rsi.toFixed(0)} está en zona de sobrecompra — el momentum podría hacer una pausa.`,
      fr: `Le RSI à ${rsi.toFixed(0)} est en zone de surachat — le momentum pourrait marquer une pause.`,
      pt: `O RSI em ${rsi.toFixed(0)} está em território de sobrecompra — o momentum pode fazer uma pausa.`,
    });
  } else if (rsi >= 55) {
    rsiText = pick(lang, {
      en: `RSI at ${rsi.toFixed(0)} shows healthy bullish momentum.`,
      tr: `RSI ${rsi.toFixed(0)} sağlıklı yükseliş momentumu gösteriyor.`,
      es: `El RSI en ${rsi.toFixed(0)} muestra un momentum alcista saludable.`,
      fr: `Le RSI à ${rsi.toFixed(0)} montre un momentum haussier sain.`,
      pt: `O RSI em ${rsi.toFixed(0)} mostra um momentum de alta saudável.`,
    });
  } else if (rsi <= 30) {
    rsiText = pick(lang, {
      en: `RSI at ${rsi.toFixed(0)} is in oversold territory — potential for a bounce.`,
      tr: `RSI ${rsi.toFixed(0)} aşırı satım bölgesinde — tepki yükselişi potansiyeli var.`,
      es: `El RSI en ${rsi.toFixed(0)} está en zona de sobreventa — hay potencial de un rebote.`,
      fr: `Le RSI à ${rsi.toFixed(0)} est en zone de survente — un rebond est possible.`,
      pt: `O RSI em ${rsi.toFixed(0)} está em território de sobrevenda — há potencial para uma recuperação.`,
    });
  } else if (rsi <= 45) {
    rsiText = pick(lang, {
      en: `RSI at ${rsi.toFixed(0)} shows weak/bearish momentum.`,
      tr: `RSI ${rsi.toFixed(0)} zayıf/düşüşü momentum gösteriyor.`,
      es: `El RSI en ${rsi.toFixed(0)} muestra un momentum débil/bajista.`,
      fr: `Le RSI à ${rsi.toFixed(0)} montre un momentum faible/baissier.`,
      pt: `O RSI em ${rsi.toFixed(0)} mostra um momentum fraco/de baixa.`,
    });
  } else {
    rsiText = pick(lang, {
      en: `RSI at ${rsi.toFixed(0)} is neutral.`,
      tr: `RSI ${rsi.toFixed(0)} nötr bölgede.`,
      es: `El RSI en ${rsi.toFixed(0)} es neutral.`,
      fr: `Le RSI à ${rsi.toFixed(0)} est neutre.`,
      pt: `O RSI em ${rsi.toFixed(0)} é neutro.`,
    });
  }

  return { entryCondition, stopRationale, ema, vwap: vwap_, volume, rsi: rsiText };
}
