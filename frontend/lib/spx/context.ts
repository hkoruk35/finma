/**
 * SPX SuperTrade — Bağlam ve Rejim Motoru
 * Takvim mevsimselliği, volatilite rejimi, önceki seans yapısı, gece
 * seansı boşluğu ve tarihsel benzer gün eşleşmesini GERÇEK veriden üretir.
 */

import type {
  AnalogContext,
  Bar,
  ContextSnapshot,
  OvernightContext,
  PreviousSessionContext,
  SeasonalityContext,
  SignalState,
  VolatilityContext,
} from "./types";
import { barsOnDate, nyParts, round2 } from "./yahoo";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function thirdFriday(year: number, month: number): number {
  // month: 1-12 — ayın 3. Cuma gününün gün numarası
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstFriday = 1 + ((5 - first.getUTCDay() + 7) % 7);
  return firstFriday + 14;
}

export function buildSeasonality(sessionDate: string): SeasonalityContext {
  const [y, m, d] = sessionDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = dt.getUTCDay();

  const monthPhase: "EARLY" | "MID" | "LATE" = d <= 10 ? "EARLY" : d > 20 ? "LATE" : "MID";
  const tf = thirdFriday(y, m);
  const isOpexWeek = d >= tf - 4 && d <= tf;
  const isTripleWitching = isOpexWeek && [3, 6, 9, 12].includes(m);

  const phaseTr = monthPhase === "EARLY" ? "ay başı" : monthPhase === "LATE" ? "ay sonu" : "ay ortası";

  return {
    month: MONTHS[m - 1],
    weekday: WEEKDAYS[weekday],
    monthPhase,
    isOpexWeek,
    isTripleWitching,
    summary: `${MONTHS[m - 1]} ${phaseTr}, ${WEEKDAYS[weekday]}${isTripleWitching ? " — üçlü vade sonu haftası" : isOpexWeek ? " — vade sonu haftası" : ""}`,
  };
}

export function buildVolatility(vixDaily: Bar[]): VolatilityContext {
  if (!vixDaily.length) {
    return {
      vix: 0,
      vix5dChange: 0,
      level: "NORMAL",
      trend: "STABLE",
      label: "VIX verisi yok",
      impliedVol: 0.18,
    };
  }

  const last = vixDaily[vixDaily.length - 1].close;
  const ref = vixDaily[Math.max(0, vixDaily.length - 6)].close;
  const change = round2(last - ref);

  const level: VolatilityContext["level"] =
    last < 14 ? "LOW" : last < 20 ? "NORMAL" : last < 28 ? "HIGH" : "EXTREME";
  const trend: VolatilityContext["trend"] = change > 0.6 ? "RISING" : change < -0.6 ? "FALLING" : "STABLE";

  const levelTr = { LOW: "düşük", NORMAL: "normal", HIGH: "yüksek", EXTREME: "aşırı" }[level];
  const trendTr = { RISING: "yükseliyor", FALLING: "geriliyor", STABLE: "yatay" }[trend];

  return {
    vix: round2(last),
    vix5dChange: change,
    level,
    trend,
    label: `VIX ${levelTr} bölgede, 5 günlük eğilim ${trendTr}`,
    impliedVol: Math.max(0.08, (last / 100) * 1.15),
  };
}

export function buildPreviousSession(
  spx1m: Bar[],
  prevDate: string | null
): PreviousSessionContext {
  const empty: PreviousSessionContext = {
    date: prevDate ?? "—",
    changePct: 0,
    closePositionPct: 0,
    last30mDirection: "FLAT",
    structureType: "VERİ YOK",
    label: "Önceki seans verisi bulunamadı",
  };
  if (!prevDate) return empty;

  const bars = barsOnDate(spx1m, prevDate);
  if (bars.length < 10) return empty;

  const open = bars[0].open;
  const close = bars[bars.length - 1].close;
  const high = Math.max(...bars.map((b) => b.high));
  const low = Math.min(...bars.map((b) => b.low));
  const range = high - low;

  const changePct = round2(((close - open) / open) * 100);
  const closePositionPct = range > 0 ? Math.round(((close - low) / range) * 100) : 50;

  const last30 = bars.slice(-30);
  const l30Change = last30[last30.length - 1].close - last30[0].open;
  const last30mDirection: PreviousSessionContext["last30mDirection"] =
    l30Change > range * 0.08 ? "UP" : l30Change < -range * 0.08 ? "DOWN" : "FLAT";

  let structureType: string;
  let label: string;
  if (closePositionPct >= 80 && changePct > 0.25) {
    structureType = "GÜÇLÜ BOĞA KAPANIŞI";
    label = "Zirveye yakın kapanış, alıcı kontrolü";
  } else if (closePositionPct <= 20 && changePct < -0.25) {
    structureType = "GÜÇLÜ AYI KAPANIŞI";
    label = "Dibe yakın kapanış, satıcı kontrolü";
  } else if (Math.abs(changePct) < 0.2) {
    structureType = "YATAY GÜN";
    label = "Dar bantta denge günü";
  } else if (changePct > 0) {
    structureType = "ILIMLI YUKARI";
    label = "Pozitif kapanış, ivme sınırlı";
  } else {
    structureType = "ILIMLI AŞAĞI";
    label = "Negatif kapanış, ivme sınırlı";
  }

  return { date: prevDate, changePct, closePositionPct, last30mDirection, structureType, label };
}

export function buildOvernight(
  esOvernight: Bar[],
  esRthFirst: Bar | null,
  esPdc: number,
  onMid: number,
  nqChangePct: number,
  esChangePct: number
): OvernightContext {
  const empty: OvernightContext = {
    gapPts: 0,
    gapPct: 0,
    gapType: "VERİ YOK",
    onRangePts: 0,
    vsOnMid: "ABOVE",
    nqAlignment: "ALIGNED",
    nqChangePct: 0,
    esChangePct: 0,
    label: "Gece seansı verisi bulunamadı",
  };

  if (!esOvernight.length || !esPdc) return empty;

  const onh = Math.max(...esOvernight.map((b) => b.high));
  const onl = Math.min(...esOvernight.map((b) => b.low));
  const openPrice = esRthFirst ? esRthFirst.open : esOvernight[esOvernight.length - 1].close;
  const gapPts = round2(openPrice - esPdc);
  const gapPct = round2((gapPts / esPdc) * 100);

  let gapType: string;
  if (Math.abs(gapPct) < 0.08) gapType = "BOŞLUKSUZ AÇILIŞ";
  else if (gapPct >= 0.35) gapType = "BÜYÜK YUKARI BOŞLUK";
  else if (gapPct > 0) gapType = "KÜÇÜK YUKARI BOŞLUK";
  else if (gapPct <= -0.35) gapType = "BÜYÜK AŞAĞI BOŞLUK";
  else gapType = "KÜÇÜK AŞAĞI BOŞLUK";

  const aligned = (nqChangePct >= 0) === (esChangePct >= 0);

  return {
    gapPts,
    gapPct,
    gapType,
    onRangePts: round2(onh - onl),
    vsOnMid: openPrice >= onMid ? "ABOVE" : "BELOW",
    nqAlignment: aligned ? "ALIGNED" : "DIVERGENT",
    nqChangePct: round2(nqChangePct),
    esChangePct: round2(esChangePct),
    label: `${gapType.toLowerCase()}, gece aralığı ${round2(onh - onl)} puan`,
  };
}

/**
 * Tarihsel benzer gün motoru.
 * Günlük SPX barlarından, bugünkü açılış boşluğu + önceki gün kapanış
 * konumu + hafta günü + ay evresi kombinasyonuna en yakın günleri bulur
 * ve o günlerin gün içi sonuçlarının dağılımını çıkarır.
 */
export function buildAnalog(
  spxDaily: Bar[],
  todayGapPct: number,
  todayPrevClosePos: number,
  todayWeekday: number,
  todayMonthPhase: "EARLY" | "MID" | "LATE",
  spotPrice: number
): AnalogContext {
  const empty: AnalogContext = {
    sampleSize: 0,
    bullishCount: 0,
    bearishCount: 0,
    chopCount: 0,
    bullishPct: 0,
    medianMovePts: 0,
    medianMfePts: 0,
    medianMaePts: 0,
    nearestDate: "—",
    nearestSimilarity: 0,
    bias: "NEUTRAL",
    criteria: "Yeterli tarihsel veri yok",
  };

  if (spxDaily.length < 40) return empty;

  interface Candidate {
    date: string;
    similarity: number;
    movePct: number;
    mfePct: number;
    maePct: number;
  }

  const candidates: Candidate[] = [];

  for (let i = 1; i < spxDaily.length - 1; i++) {
    const prev = spxDaily[i - 1];
    const day = spxDaily[i];
    if (!prev.close || !day.open) continue;

    const gapPct = ((day.open - prev.close) / prev.close) * 100;
    const prevRange = prev.high - prev.low;
    const prevClosePos = prevRange > 0 ? ((prev.close - prev.low) / prevRange) * 100 : 50;

    const p = nyParts(day.time);
    const phase: "EARLY" | "MID" | "LATE" = p.day <= 10 ? "EARLY" : p.day > 20 ? "LATE" : "MID";

    let similarity = 100;
    similarity -= Math.min(45, Math.abs(gapPct - todayGapPct) * 45);
    similarity -= Math.min(25, (Math.abs(prevClosePos - todayPrevClosePos) / 100) * 25);
    if (p.weekday !== todayWeekday) similarity -= 8;
    if (phase !== todayMonthPhase) similarity -= 5;

    if (similarity < 45) continue;

    candidates.push({
      date: p.ymd,
      similarity: Math.round(similarity),
      movePct: ((day.close - day.open) / day.open) * 100,
      mfePct: ((day.high - day.open) / day.open) * 100,
      maePct: ((day.low - day.open) / day.open) * 100,
    });
  }

  if (candidates.length < 6) return empty;

  candidates.sort((a, b) => b.similarity - a.similarity);
  const top = candidates.slice(0, 25);

  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const bullishCount = top.filter((c) => c.movePct > 0.15).length;
  const bearishCount = top.filter((c) => c.movePct < -0.15).length;
  const chopCount = top.length - bullishCount - bearishCount;
  const bullishPct = Math.round((bullishCount / top.length) * 1000) / 10;

  const toPts = (pct: number) => round2((pct / 100) * spotPrice);

  const bias: AnalogContext["bias"] =
    bullishPct >= 60 ? "BULLISH" : bullishPct <= 40 ? "BEARISH" : "NEUTRAL";

  return {
    sampleSize: top.length,
    bullishCount,
    bearishCount,
    chopCount,
    bullishPct,
    medianMovePts: toPts(median(top.map((c) => c.movePct))),
    medianMfePts: toPts(median(top.map((c) => c.mfePct))),
    medianMaePts: toPts(median(top.map((c) => c.maePct))),
    nearestDate: top[0].date,
    nearestSimilarity: top[0].similarity,
    bias,
    criteria: `Açılış boşluğu %${todayGapPct.toFixed(2)}, önceki gün kapanış konumu %${Math.round(todayPrevClosePos)} ve aynı hafta günü kriterlerine en yakın ${top.length} seans`,
  };
}

export function buildFingerprint(
  seasonality: SeasonalityContext,
  volatility: VolatilityContext,
  previousSession: PreviousSessionContext,
  overnight: OvernightContext
): string {
  return [
    `AY=${seasonality.month.slice(0, 3).toUpperCase()}`,
    `EVRE=${seasonality.monthPhase}`,
    `GUN=${seasonality.weekday.slice(0, 3).toUpperCase()}`,
    `VIX=${volatility.level}_${volatility.trend}`,
    `ONCEKI=${previousSession.structureType.split(" ")[0]}`,
    `GECE=${overnight.gapType.split(" ")[0]}`,
  ].join(" | ");
}

export function evaluateAgreement(
  analog: AnalogContext,
  state: SignalState
): { liveAgreement: "CONFIRMED" | "CONTRADICTED" | "PENDING"; liveAgreementText: string } {
  const isLong = state.includes("LONG") && !state.startsWith("FAILED");
  const isShort = state.includes("SHORT") && !state.startsWith("FAILED");

  const biasTr =
    analog.bias === "BULLISH"
      ? `yukarı yönlü (benzer ${analog.sampleSize} seansın %${analog.bullishPct}'i pozitif kapandı)`
      : analog.bias === "BEARISH"
      ? `aşağı yönlü (benzer ${analog.sampleSize} seansın yalnızca %${analog.bullishPct}'i pozitif kapandı)`
      : `belirsiz (benzer seansların %${analog.bullishPct}'i pozitif)`;

  if (!analog.sampleSize) {
    return {
      liveAgreement: "PENDING",
      liveAgreementText: "Tarihsel karşılaştırma için yeterli örnek bulunamadı; yalnızca canlı yapı dikkate alınıyor.",
    };
  }

  if ((isLong && analog.bias === "BULLISH") || (isShort && analog.bias === "BEARISH")) {
    return {
      liveAgreement: "CONFIRMED",
      liveAgreementText: `Tarihsel eğilim ${biasTr} ve canlı yapı bunu doğruluyor.`,
    };
  }

  if ((isLong && analog.bias === "BEARISH") || (isShort && analog.bias === "BULLISH")) {
    return {
      liveAgreement: "CONTRADICTED",
      liveAgreementText: `Tarihsel eğilim ${biasTr}; canlı yapı ters yönde. Çelişki durumunda canlı yapı önceliklidir.`,
    };
  }

  return {
    liveAgreement: "PENDING",
    liveAgreementText: `Tarihsel eğilim ${biasTr}; canlı kırılım teyidi henüz oluşmadı.`,
  };
}

export interface ContextInput {
  sessionDate: string;
  prevDate: string | null;
  spx1m: Bar[];
  spxDaily: Bar[];
  vixDaily: Bar[];
  esOvernight: Bar[];
  esRthFirst: Bar | null;
  esPdc: number;
  onMid: number;
  nqChangePct: number;
  esChangePct: number;
  spotPrice: number;
  state: SignalState;
}

export function buildContext(input: ContextInput): ContextSnapshot {
  const seasonality = buildSeasonality(input.sessionDate);
  const volatility = buildVolatility(input.vixDaily);
  const previousSession = buildPreviousSession(input.spx1m, input.prevDate);
  const overnight = buildOvernight(
    input.esOvernight,
    input.esRthFirst,
    input.esPdc,
    input.onMid,
    input.nqChangePct,
    input.esChangePct
  );

  const [, , dayStr] = input.sessionDate.split("-");
  const day = Number(dayStr);
  const monthPhase: "EARLY" | "MID" | "LATE" = day <= 10 ? "EARLY" : day > 20 ? "LATE" : "MID";
  const weekday = new Date(`${input.sessionDate}T12:00:00Z`).getUTCDay();

  const analog = buildAnalog(
    input.spxDaily,
    overnight.gapPct,
    previousSession.closePositionPct,
    weekday,
    monthPhase,
    input.spotPrice
  );

  const agreement = evaluateAgreement(analog, input.state);

  return {
    fingerprint: buildFingerprint(seasonality, volatility, previousSession, overnight),
    seasonality,
    volatility,
    previousSession,
    overnight,
    analog,
    ...agreement,
  };
}
