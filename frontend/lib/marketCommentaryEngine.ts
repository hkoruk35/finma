import { AssetCategory, formatAssetPrice } from "./symbols";
import { formatNumber } from "@/lib/formatNumber";

export type CommentaryLang = "tr" | "en" | "es" | "fr" | "pt" | "id";

export type VolatilityRegime = "CALM" | "NORMAL" | "ACTIVE" | "HIGH";

export interface AiCommentaryInput {
  ticker: string;
  category: AssetCategory;
  price: number;
  changePct: number;
  rsi: number;
  rvol: number;
  atrPct: number;
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number;
  pivotP: number;
  pivotR1: number;
  pivotS1: number;
  wyckoffScore: number;
  weinsteinStage: number;
  macdHist: number;
  lang: CommentaryLang;
  // Derived from raw historical bars by the caller (route.ts) — this
  // function stays a pure template and never re-derives a fact from data
  // it wasn't explicitly handed (see docs/AI_BEHAVIOR.md Rule 1).
  ema50SupportTested: boolean;
  ema200SupportTested: boolean;
  volatilityRegime: VolatilityRegime;
  weeklyTrendUp: boolean;
  weeklyTrendDown: boolean;
  rsiRising: boolean;
  volumeRising: boolean;
}

export interface AiMarketCommentary {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL" | "BREAKOUT_WATCH";
  biasLabel: string;
  assetClassLabel: string;
  summary: string;
  keyLevels: string;
  liquidityVolume: string;
  noPlanMessage: {
    title: string;
    description: string;
  };
}

function pick<T>(lang: CommentaryLang, map: Record<CommentaryLang, T>): T {
  return map[lang] ?? map.en;
}

// ── Weinstein stage → plain language (never shown as "Stage N" to users;
// see AGENTS.md / user request: methodology names stay internal only) ──────
const STAGE_LABEL: Record<number, Record<CommentaryLang, string>> = {
  1: {
    tr: "yatay bir taban oluşturuyor",
    en: "is building a sideways base",
    es: "está formando una base lateral",
    fr: "forme une base latérale",
    pt: "está formando uma base lateral",
    id: "sedang membentuk basis menyamping",
  },
  2: {
    tr: "orta-uzun vadeli yükseliş eğilimini koruyor",
    en: "is holding a medium-to-long-term uptrend",
    es: "mantiene una tendencia alcista de medio-largo plazo",
    fr: "maintient une tendance haussière à moyen-long terme",
    pt: "mantém uma tendência de alta de médio-longo prazo",
    id: "mempertahankan tren naik jangka menengah-panjang",
  },
  3: {
    tr: "yükseliş ivmesi zayıflayıp yataylaşıyor",
    en: "is seeing upside momentum fade and flatten out",
    es: "muestra un impulso alcista que se debilita y se aplana",
    fr: "voit son élan haussier faiblir et s'aplatir",
    pt: "vê o impulso de alta enfraquecer e se estabilizar",
    id: "melihat momentum naik melemah dan mendatar",
  },
  4: {
    tr: "orta-uzun vadeli düşüş baskısı altında",
    en: "is under medium-to-long-term downside pressure",
    es: "está bajo presión bajista de medio-largo plazo",
    fr: "subit une pression baissière à moyen-long terme",
    pt: "está sob pressão de baixa de médio-longo prazo",
    id: "berada di bawah tekanan turun jangka menengah-panjang",
  },
};

type EmaStructure = "STRONG" | "MODERATE" | "CHOPPY" | "WEAK";

const EMA_STRUCTURE_PHRASE: Record<EmaStructure, Record<CommentaryLang, string>> = {
  STRONG: {
    tr: "Kısa, orta ve uzun vadeli fiyat yapısı yukarı yönü destekliyor.",
    en: "The short, medium and long-term price structure all support the upside.",
    es: "La estructura de precios de corto, medio y largo plazo respalda el alza.",
    fr: "La structure de prix à court, moyen et long terme soutient la hausse.",
    pt: "A estrutura de preço de curto, médio e longo prazo apoia a alta.",
    id: "Struktur harga jangka pendek, menengah, dan panjang mendukung kenaikan.",
  },
  MODERATE: {
    tr: "Fiyat orta ve uzun vadeli ortalamaların üzerinde kalarak ana yükseliş yapısını koruyor.",
    en: "Price is holding above the medium and long-term averages, preserving the main uptrend structure.",
    es: "El precio se mantiene sobre las medias de medio y largo plazo, preservando la estructura alcista principal.",
    fr: "Le prix reste au-dessus des moyennes moyen et long terme, préservant la structure haussière principale.",
    pt: "O preço se mantém acima das médias de médio e longo prazo, preservando a estrutura de alta principal.",
    id: "Harga bertahan di atas rata-rata jangka menengah dan panjang, menjaga struktur tren naik utama.",
  },
  CHOPPY: {
    tr: "Fiyat kısa ve orta vadeli ortalamaların çevresinde sıkışıyor; net bir yön için bu bölgenin dışına çıkılması gerekiyor.",
    en: "Price is squeezed around the short and medium-term averages; a clear break outside this zone is needed for direction.",
    es: "El precio está comprimido alrededor de las medias de corto y medio plazo; se necesita una ruptura clara de esta zona para definir dirección.",
    fr: "Le prix est comprimé autour des moyennes court et moyen terme ; une sortie nette de cette zone est nécessaire pour une direction claire.",
    pt: "O preço está comprimido em torno das médias de curto e médio prazo; é necessário romper claramente essa zona para haver direção.",
    id: "Harga terjepit di sekitar rata-rata jangka pendek dan menengah; diperlukan penembusan jelas dari zona ini untuk menentukan arah.",
  },
  WEAK: {
    tr: "Fiyat önemli orta/uzun vadeli ortalamaların altında kaldığı için teknik görünüm üzerindeki baskı sürüyor.",
    en: "Price remains below the key medium/long-term averages, so pressure on the technical picture continues.",
    es: "El precio permanece por debajo de las medias clave de medio/largo plazo, por lo que la presión sobre el panorama técnico continúa.",
    fr: "Le prix reste sous les moyennes clés moyen/long terme, la pression sur le tableau technique se poursuit.",
    pt: "O preço permanece abaixo das médias-chave de médio/longo prazo, então a pressão sobre o quadro técnico continua.",
    id: "Harga tetap di bawah rata-rata jangka menengah/panjang utama, sehingga tekanan pada gambaran teknikal berlanjut.",
  },
};

const VOLATILITY_SHORT: Record<VolatilityRegime, Record<CommentaryLang, string>> = {
  CALM: {
    tr: "Hisse kendi normaline göre daha sakin hareket ediyor.",
    en: "The stock is trading calmer than its own normal range.",
    es: "La acción se mueve más tranquila de lo habitual para ella.",
    fr: "L'action évolue plus calmement que sa normale.",
    pt: "A ação está se movendo mais calma do que o normal para ela.",
    id: "Saham bergerak lebih tenang dari kebiasaannya.",
  },
  NORMAL: {
    tr: "Hareketliliği kendi tarihsel ortalamasına yakın seyrediyor.",
    en: "Its movement is tracking close to its own historical average.",
    es: "Su movimiento se mantiene cerca de su promedio histórico.",
    fr: "Sa volatilité reste proche de sa moyenne historique.",
    pt: "Sua movimentação está próxima da média histórica dela.",
    id: "Pergerakannya mendekati rata-rata historisnya sendiri.",
  },
  ACTIVE: {
    tr: "Hisse son dönemde normalden daha hareketli.",
    en: "The stock has been more active than usual lately.",
    es: "La acción ha estado más activa de lo habitual últimamente.",
    fr: "L'action a été plus active que d'habitude récemment.",
    pt: "A ação tem estado mais ativa do que o normal recentemente.",
    id: "Saham ini belakangan lebih aktif dari biasanya.",
  },
  HIGH: {
    tr: "Hisse belirgin şekilde yüksek oynaklık gösteriyor.",
    en: "The stock is showing noticeably high volatility.",
    es: "La acción muestra una volatilidad notablemente alta.",
    fr: "L'action affiche une volatilité nettement élevée.",
    pt: "A ação apresenta uma volatilidade visivelmente alta.",
    id: "Saham menunjukkan volatilitas yang jelas tinggi.",
  },
};

const VOLATILITY_LONG: Record<VolatilityRegime, Record<CommentaryLang, string>> = {
  CALM: {
    tr: "Hisse son dönemde kendi normaline göre daha sakin hareket ediyor; günlük fiyat aralıkları daralmış durumda.",
    en: "The stock has been calmer than its own normal lately; daily price ranges have narrowed.",
    es: "La acción ha estado más tranquila de lo habitual; los rangos diarios de precio se han estrechado.",
    fr: "L'action a été plus calme que d'habitude ; les fourchettes de prix quotidiennes se sont resserrées.",
    pt: "A ação tem estado mais calma do que o normal; as faixas diárias de preço se estreitaram.",
    id: "Saham ini lebih tenang dari biasanya belakangan; kisaran harga harian menyempit.",
  },
  NORMAL: {
    tr: "Hissenin günlük hareketliliği kendi tarihsel ortalamasına yakın.",
    en: "The stock's daily volatility is close to its own historical average.",
    es: "La volatilidad diaria de la acción está cerca de su promedio histórico.",
    fr: "La volatilité quotidienne de l'action est proche de sa moyenne historique.",
    pt: "A volatilidade diária da ação está próxima da sua média histórica.",
    id: "Volatilitas harian saham mendekati rata-rata historisnya.",
  },
  ACTIVE: {
    tr: "Hisse son dönemde normalden daha geniş günlük fiyat hareketleri gösteriyor.",
    en: "The stock has been showing wider-than-normal daily price swings lately.",
    es: "La acción ha mostrado movimientos diarios de precio más amplios de lo normal últimamente.",
    fr: "L'action montre des variations de prix quotidiennes plus larges que la normale.",
    pt: "A ação tem mostrado oscilações diárias de preço mais amplas do que o normal.",
    id: "Saham menunjukkan pergerakan harga harian yang lebih lebar dari biasanya belakangan ini.",
  },
  HIGH: {
    tr: "Hissede fiyat hareketleri belirgin şekilde yüksek; kısa sürede geniş fiyat değişimleri görülebileceğinden risk aralıkları normalden daha geniş değerlendirilmelidir.",
    en: "Price moves are noticeably elevated; wide swings can occur quickly, so risk ranges should be sized wider than usual.",
    es: "Los movimientos de precio están notablemente elevados; pueden ocurrir oscilaciones amplias rápidamente, por lo que el rango de riesgo debe ser más amplio de lo habitual.",
    fr: "Les mouvements de prix sont nettement élevés ; de larges variations peuvent survenir rapidement, la plage de risque doit donc être plus large que d'habitude.",
    pt: "Os movimentos de preço estão notavelmente elevados; oscilações amplas podem ocorrer rapidamente, então as faixas de risco devem ser mais largas que o normal.",
    id: "Pergerakan harga meningkat secara nyata; ayunan lebar bisa terjadi dengan cepat, sehingga kisaran risiko sebaiknya dibuat lebih lebar dari biasanya.",
  },
};

type ConfirmationKind = "UP" | "DOWN" | "PARTIAL_UP" | "PARTIAL_DOWN" | null;

const CONFIRMATION_TEXT: Record<Exclude<ConfirmationKind, null>, Record<CommentaryLang, string>> = {
  UP: {
    tr: "Günlük momentum ve artan işlem aktivitesi haftalık yükseliş eğilimiyle aynı yönde ilerliyor; kısa vadeli yukarı yön ek teyit kazanıyor.",
    en: "Daily momentum and rising trading activity are moving in the same direction as the weekly uptrend, giving the short-term upside extra confirmation.",
    es: "El impulso diario y el aumento de la actividad de negociación avanzan en la misma dirección que la tendencia alcista semanal, dando una confirmación adicional al alza a corto plazo.",
    fr: "L'élan quotidien et l'activité de négociation en hausse évoluent dans le même sens que la tendance haussière hebdomadaire, ce qui renforce la confirmation de la hausse à court terme.",
    pt: "O momentum diário e o aumento da atividade de negociação avançam na mesma direção da tendência de alta semanal, dando confirmação extra à alta de curto prazo.",
    id: "Momentum harian dan meningkatnya aktivitas perdagangan bergerak searah dengan tren naik mingguan, memberikan konfirmasi tambahan bagi arah naik jangka pendek.",
  },
  DOWN: {
    tr: "Günlük momentumdaki zayıflama ve satış sırasında artan işlem aktivitesi haftalık düşüş eğilimiyle aynı yönde; aşağı yönlü baskı teyit kazanıyor.",
    en: "The daily momentum weakening, together with rising activity on the way down, lines up with the weekly downtrend — the downside pressure gains confirmation.",
    es: "El debilitamiento del impulso diario, junto con el aumento de la actividad durante la caída, se alinea con la tendencia bajista semanal; la presión bajista gana confirmación.",
    fr: "L'affaiblissement de l'élan quotidien, associé à une activité en hausse durant la baisse, s'aligne avec la tendance baissière hebdomadaire ; la pression baissière gagne en confirmation.",
    pt: "O enfraquecimento do momentum diário, junto com o aumento da atividade durante a queda, se alinha com a tendência de baixa semanal; a pressão de baixa ganha confirmação.",
    id: "Melemahnya momentum harian, disertai meningkatnya aktivitas saat harga turun, sejalan dengan tren turun mingguan — tekanan turun mendapat konfirmasi.",
  },
  PARTIAL_UP: {
    tr: "Günlük momentum toparlanıyor ancak haftalık ana trend henüz aynı yönde teyit vermiyor.",
    en: "Daily momentum is recovering, but the weekly main trend hasn't confirmed the same direction yet.",
    es: "El impulso diario se está recuperando, pero la tendencia semanal principal aún no confirma la misma dirección.",
    fr: "L'élan quotidien se redresse, mais la tendance hebdomadaire principale ne confirme pas encore la même direction.",
    pt: "O momentum diário está se recuperando, mas a tendência semanal principal ainda não confirma a mesma direção.",
    id: "Momentum harian sedang pulih, tetapi tren mingguan utama belum mengonfirmasi arah yang sama.",
  },
  PARTIAL_DOWN: {
    tr: "Günlük momentum zayıflıyor ancak haftalık ana trend henüz bunu teyit etmiyor.",
    en: "Daily momentum is weakening, but the weekly main trend hasn't confirmed it yet.",
    es: "El impulso diario se está debilitando, pero la tendencia semanal principal aún no lo confirma.",
    fr: "L'élan quotidien s'affaiblit, mais la tendance hebdomadaire principale ne le confirme pas encore.",
    pt: "O momentum diário está enfraquecendo, mas a tendência semanal principal ainda não confirma isso.",
    id: "Momentum harian melemah, tetapi tren mingguan utama belum mengonfirmasinya.",
  },
};

function getConfirmationKind(input: {
  rsiRising: boolean;
  rsi: number;
  volumeRising: boolean;
  weeklyTrendUp: boolean;
  weeklyTrendDown: boolean;
  changePct: number;
}): ConfirmationKind {
  const { rsiRising, rsi, volumeRising, weeklyTrendUp, weeklyTrendDown, changePct } = input;
  if (rsiRising && rsi > 50 && volumeRising && weeklyTrendUp) return "UP";
  if (!rsiRising && rsi < 50 && changePct < 0 && volumeRising && weeklyTrendDown) return "DOWN";
  if (rsiRising && weeklyTrendDown) return "PARTIAL_UP";
  if (!rsiRising && weeklyTrendUp) return "PARTIAL_DOWN";
  return null;
}

export function generateAiMarketCommentary(input: AiAiInput): AiMarketCommentary {
  const {
    ticker,
    category,
    price,
    changePct,
    rsi,
    rvol,
    atrPct,
    ema20,
    ema50,
    ema200,
    vwap,
    pivotP,
    pivotR1,
    pivotS1,
    wyckoffScore,
    weinsteinStage,
    macdHist,
    lang,
    ema50SupportTested,
    ema200SupportTested,
    volatilityRegime,
    weeklyTrendUp,
    weeklyTrendDown,
    rsiRising,
    volumeRising,
  } = input;

  const fmtP = (p: number) => `$${formatAssetPrice(p, ticker)}`;

  // Determine Directional Bias
  let bias: AiMarketCommentary["bias"] = "NEUTRAL";
  if (price > ema20 && ema20 > ema50 && price > vwap && macdHist >= 0) {
    bias = "BULLISH";
  } else if (price < ema20 && ema20 < ema50 && price < vwap && macdHist < 0) {
    bias = "BEARISH";
  } else if (rvol >= 1.8 && Math.abs(changePct) >= 1.2) {
    bias = "BREAKOUT_WATCH";
  }

  const strongBullish = bias === "BULLISH" && price > ema20 && ema20 > ema50 && ema50 > ema200 && rsi >= 55;

  // Asset Class Badges
  const assetClassLabel = pick(lang, {
    tr: category === "forex" ? "DÖVİZ PARİTESİ" : category === "commodity" ? "EMTIA PİYASASI" : category === "crypto" ? "KRİPTO VARLIK" : "ABD HİSSESİ",
    en: category === "forex" ? "CURRENCY PAIR" : category === "commodity" ? "COMMODITY MARKET" : category === "crypto" ? "CRYPTO ASSET" : "US EQUITY",
    es: category === "forex" ? "PAR DE DIVISAS" : category === "commodity" ? "MATERIA PRIMA" : category === "crypto" ? "CRIPTOMONEDA" : "ACCIÓN DE EE. UU.",
    fr: category === "forex" ? "PAIRE DE DEVISES" : category === "commodity" ? "MATIÈRE PREMIÈRE" : category === "crypto" ? "CRYPTO-ACTIF" : "ACTION AMÉRICAINE",
    pt: category === "forex" ? "PAR DE MOEDAS" : category === "commodity" ? "COMMODITY" : category === "crypto" ? "CRIPTOATIVO" : "AÇÃO DOS EUA",
    id: category === "forex" ? "PASANGAN MATA UANG" : category === "commodity" ? "PASAR KOMODITAS" : category === "crypto" ? "ASET KRIPTO" : "SAHAM AS",
  });

  // Bias badge labels — kept in plain, non-jargon language on purpose (no
  // "Weinstein"/"Wyckoff" methodology names shown to end users).
  const biasLabelMap: Record<AiMarketCommentary["bias"], Record<CommentaryLang, string>> = {
    BULLISH: strongBullish ? {
      tr: "GÜÇLÜ YUKARI EĞİLİM ↗",
      en: "STRONG UPTREND ↗",
      es: "TENDENCIA ALCISTA FUERTE ↗",
      fr: "FORTE TENDANCE HAUSSIÈRE ↗",
      pt: "TENDÊNCIA DE ALTA FORTE ↗",
      id: "TREN NAIK KUAT ↗",
    } : {
      tr: "YUKARI EĞİLİM ↗",
      en: "UPTREND ↗",
      es: "TENDENCIA ALCISTA ↗",
      fr: "TENDANCE HAUSSIÈRE ↗",
      pt: "TENDÊNCIA DE ALTA ↗",
      id: "TREN NAIK ↗",
    },
    BEARISH: {
      tr: "AŞAĞI BASKI ↘",
      en: "DOWNSIDE PRESSURE ↘",
      es: "PRESIÓN BAJISTA ↘",
      fr: "PRESSION BAISSIÈRE ↘",
      pt: "PRESSÃO DE BAIXA ↘",
      id: "TEKANAN TURUN ↘",
    },
    BREAKOUT_WATCH: {
      tr: "YÜKSEK HAREKETLİLİK ⚡",
      en: "HIGH ACTIVITY ⚡",
      es: "ALTA ACTIVIDAD ⚡",
      fr: "FORTE ACTIVITÉ ⚡",
      pt: "ALTA ATIVIDADE ⚡",
      id: "AKTIVITAS TINGGI ⚡",
    },
    NEUTRAL: {
      tr: "YATAY / SIKIŞIK ⇄",
      en: "SIDEWAYS / TIGHT RANGE ⇄",
      es: "LATERAL / RANGO ESTRECHO ⇄",
      fr: "LATÉRAL / RANGE SERRÉ ⇄",
      pt: "LATERAL / FAIXA ESTREITA ⇄",
      id: "MENYAMPING / RANGE SEMPIT ⇄",
    },
  };

  const biasLabel = pick(lang, biasLabelMap[bias]);

  // EMA structure classification (see AI_BEHAVIOR-style rule: only describe
  // what the data actually shows — a stack of >/< checks, not guesswork).
  let emaStructure: EmaStructure;
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
    emaStructure = "STRONG";
  } else if (price < ema50 || price < ema200) {
    emaStructure = "WEAK";
  } else if (Math.abs(ema20 - ema50) / price < 0.015) {
    emaStructure = "CHOPPY";
  } else if (price > ema50 && ema50 > ema200) {
    emaStructure = "MODERATE";
  } else {
    emaStructure = "CHOPPY";
  }
  const emaStructurePhrase = pick(lang, EMA_STRUCTURE_PHRASE[emaStructure]);
  const volatilityShort = pick(lang, VOLATILITY_SHORT[volatilityRegime]);
  const volatilityLong = pick(lang, VOLATILITY_LONG[volatilityRegime]);

  const confirmationKind = getConfirmationKind({ rsiRising, rsi, volumeRising, weeklyTrendUp, weeklyTrendDown, changePct });
  const confirmationClause = confirmationKind ? pick(lang, CONFIRMATION_TEXT[confirmationKind]) : "";

  // Asset-specific Narrative Generation
  let summary = "";
  if (category === "commodity") {
    summary = pick(lang, {
      tr: `${ticker} spot piyasada ${fmtP(price)} seviyesinde işlem görmektedir (%${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}). Fiyatın 20 günlük EMA (${fmtP(ema20)}) ve VWAP (${fmtP(vwap)}) üzerindeki konumu ${bias === "BULLISH" ? "kurumsal alım baskısının ve makro yükseliş trendinin korunduğunu gösterir." : "makro satıcıların etkisinde dengelenme aradığını göstermektedir."} ATR% %${formatNumber(atrPct, 2)} ile emtia volatilitesinin aktif olduğunu doğrulamaktadır.`,
      en: `${ticker} is trading at ${fmtP(price)} in spot markets (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Price relative to the 20-day EMA (${fmtP(ema20)}) and VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indicates sustained institutional buying pressure and macro uptrend alignment." : "suggests market participants are absorbing supply below key dynamic resistance."} ATR% at ${formatNumber(atrPct, 2)}% reflects active commodity volatility.`,
      es: `${ticker} cotiza a ${fmtP(price)} en los mercados al contado (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). El precio con respecto a la EMA20 (${fmtP(ema20)}) y VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indica una presión compradora institucional sostenida y alineación de tendencia macro." : "sugiere consolidación bajo resistencia dinámica."} El ATR% de ${formatNumber(atrPct, 2)}% refleja volatilidad activa.`,
      fr: `${ticker} se négocie à ${fmtP(price)} sur les marchés au comptant (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Le prix par rapport à l'EMA20 (${fmtP(ema20)}) et au VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indique une pression acheteuse institutionnelle soutenue et un alignement haussier macro." : "suggère une absorption de l'offre sous résistance."} L'ATR% à ${formatNumber(atrPct, 2)}% reflète une volatilité active.`,
      pt: `${ticker} está negociando a ${fmtP(price)} nos mercados à vista (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). O preço em relação à EMA20 (${fmtP(ema20)}) e VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indica pressão compradora institucional sustentada e alinhamento de tendência de alta." : "sugere consolidação sob resistência dinâmica."} O ATR% em ${formatNumber(atrPct, 2)}% reflete volatilidade ativa.`,
      id: `${ticker} diperdagangkan di ${fmtP(price)} di pasar spot (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Posisi harga terhadap EMA 20 hari (${fmtP(ema20)}) dan VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "menunjukkan tekanan beli institusional yang berkelanjutan dan keselarasan tren naik." : "menunjukkan pelaku pasar menyerap suplai di bawah resistensi dinamis."} ATR% sebesar ${formatNumber(atrPct, 2)}% mencerminkan volatilitas komoditas yang aktif.`,
    });
  } else if (category === "forex") {
    summary = pick(lang, {
      tr: `${ticker} paritesi ${fmtP(price)} seviyesinde seyretmektedir. Gün içi VWAP (${fmtP(vwap)}) ve pivot seviyesi (${fmtP(pivotP)}) etrafındaki fiyatlama, ${bias === "BULLISH" ? "alıcıların üst üste seanslarda kontrolü elinde tuttuğuna işaret etmektedir." : "satıcı ağırlıklı momentumun devam ettiğine işaret etmektedir."} RSI (${formatNumber(rsi, 0)}) dengeli ivmeyi desteklemektedir.`,
      en: `${ticker} currency pair is trading at ${fmtP(price)}. Price action around intraday VWAP (${fmtP(vwap)}) and Daily Pivot (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indicates buyers maintaining control across sessions." : "signals prevailing downside order flow momentum."} RSI at ${formatNumber(rsi, 0)} reflects balanced momentum dynamics.`,
      es: `El par ${ticker} cotiza a ${fmtP(price)}. La acción del precio alrededor del VWAP intradía (${fmtP(vwap)}) y el Pívot Diario (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indica que los compradores mantienen el control en las sesiones." : "señala impulso vendedor predominante."} El RSI en ${formatNumber(rsi, 0)} refleja dinámica equilibrada.`,
      fr: `La paire ${ticker} évolue à ${fmtP(price)}. L'action des prix autour du VWAP intrajournalier (${fmtP(vwap)}) et du Pivot Journalier (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indique que les acheteurs gardent le contrôle." : "signale un momentum vendeur prédominant."} Le RSI à ${formatNumber(rsi, 0)} confirme la dynamique.`,
      pt: `O par ${ticker} é negociado a ${fmtP(price)}. A ação do preço ao redor do VWAP intradiário (${fmtP(vwap)}) e Pivô Diário (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indica compradores mantendo o controle." : "sinaliza impulso vendedor predominante."} O RSI em ${formatNumber(rsi, 0)} reflete dinâmica equilibrada.`,
      id: `Pasangan ${ticker} diperdagangkan di ${fmtP(price)}. Pergerakan harga di sekitar VWAP intraday (${fmtP(vwap)}) dan Pivot Harian (${fmtP(pivotP)}) ${bias === "BULLISH" ? "menunjukkan pembeli mempertahankan kendali di berbagai sesi." : "menandakan momentum aliran order jual yang dominan."} RSI di ${formatNumber(rsi, 0)} mencerminkan dinamika momentum yang seimbang.`,
    });
  } else if (category === "crypto") {
    summary = pick(lang, {
      tr: `${ticker} 24 saatlik kripto likidite akışında ${fmtP(price)} seviyesindedir (%${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}). 20 günlük EMA (${fmtP(ema20)}) ve 200 günlük trend çizgisi (${fmtP(ema200)}) ${bias === "BULLISH" ? "zincir içi ve teknik birikim yapısını doğrulamaktadır." : "likidite arayışının devam ettiğini göstermektedir."} Wyckoff birikim skoru (${wyckoffScore}/100) piyasa yapısını özetler.`,
      en: `${ticker} is trading at ${fmtP(price)} across 24/7 crypto liquidity pools (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Technical alignment with the 20-day EMA (${fmtP(ema20)}) and 200-day baseline (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirms ongoing structural accumulation." : "reflects liquidity hunting under key moving averages."} Wyckoff structure score is ${wyckoffScore}/100.`,
      es: `${ticker} cotiza a ${fmtP(price)} en los pools de liquidez cripto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). La alineación técnica con la EMA20 (${fmtP(ema20)}) y la EMA200 (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirma acumulación estructural continua." : "refleja búsqueda de liquidez."} Puntuación Wyckoff: ${wyckoffScore}/100.`,
      fr: `${ticker} se négocie à ${fmtP(price)} sur les pools de liquidité crypto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). L'alignement technique avec l'EMA20 (${fmtP(ema20)}) et l'EMA200 (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirme une accumulation structurelle en cours." : "reflète une recherche de liquidité."} Score Wyckoff : ${wyckoffScore}/100.`,
      pt: `${ticker} está negociando a ${fmtP(price)} nos pools de liquidez cripto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). O alinhamento técnico com a EMA20 (${fmtP(ema20)}) e a EMA200 (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirma acumulação estrutural contínua." : "reflete busca por liquidez."} Pontuação Wyckoff: ${wyckoffScore}/100.`,
      id: `${ticker} diperdagangkan di ${fmtP(price)} di seluruh pool likuiditas kripto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Keselarasan teknikal dengan EMA 20 hari (${fmtP(ema20)}) dan garis dasar 200 hari (${fmtP(ema200)}) ${bias === "BULLISH" ? "mengonfirmasi akumulasi struktural yang sedang berlangsung." : "mencerminkan perburuan likuiditas di bawah rata-rata bergerak utama."} Skor struktur Wyckoff adalah ${wyckoffScore}/100.`,
    });
  } else {
    // ── US equities — the plain-language rewrite: price structure, EMA
    // trend/support in natural language (no "Weinstein Stage N"), the
    // stock's own movement character, and — only when it genuinely lines
    // up — a one-line daily/weekly direction confirmation. See CLAUDE-facing
    // spec in the PR/commit this file was rewritten in for the full rules.
    const stageClause = pick(lang, STAGE_LABEL[weinsteinStage] ?? STAGE_LABEL[2]);
    summary = pick(lang, {
      tr: `${ticker} ${fmtP(price)} seviyesinde. ${emaStructurePhrase} Hisse ${stageClause}. ${volatilityShort}${confirmationClause ? ` ${confirmationClause}` : ""}`,
      en: `${ticker} is at ${fmtP(price)}. ${emaStructurePhrase} The stock ${stageClause}. ${volatilityShort}${confirmationClause ? ` ${confirmationClause}` : ""}`,
      es: `${ticker} está en ${fmtP(price)}. ${emaStructurePhrase} La acción ${stageClause}. ${volatilityShort}${confirmationClause ? ` ${confirmationClause}` : ""}`,
      fr: `${ticker} est à ${fmtP(price)}. ${emaStructurePhrase} L'action ${stageClause}. ${volatilityShort}${confirmationClause ? ` ${confirmationClause}` : ""}`,
      pt: `${ticker} está em ${fmtP(price)}. ${emaStructurePhrase} A ação ${stageClause}. ${volatilityShort}${confirmationClause ? ` ${confirmationClause}` : ""}`,
      id: `${ticker} berada di ${fmtP(price)}. ${emaStructurePhrase} Saham ${stageClause}. ${volatilityShort}${confirmationClause ? ` ${confirmationClause}` : ""}`,
    });
  }

  // Key Levels — pivots stay first (unchanged priority order), followed by
  // an EMA support/resistance read for equities. An EMA is only described
  // as "support" when price recently tested it and reclaimed it — not
  // merely because price > EMA today (see rule: observation vs inference).
  let keyLevels = pick(lang, {
    tr: `Üst direnç kümesi: ${fmtP(pivotR1)} | Pivot merkezi: ${fmtP(pivotP)} | Alt destek seviyesi: ${fmtP(pivotS1)}. ${price >= pivotP ? `Fiyatın ${fmtP(pivotP)} pivot seviyesi üzerinde tutunması yukarı yönlü olasılığı güçlendirir.` : `Fiyatın ${fmtP(pivotP)} pivot altında kalması geri çekilme riskini canlı tutar.`}`,
    en: `Upper resistance cluster: ${fmtP(pivotR1)} | Pivot center: ${fmtP(pivotP)} | Key support boundary: ${fmtP(pivotS1)}. ${price >= pivotP ? `Holding above ${fmtP(pivotP)} daily pivot strengthens bullish continuation probability.` : `Trading below ${fmtP(pivotP)} pivot preserves short-term pullback risk.`}`,
    es: `Resistencia superior: ${fmtP(pivotR1)} | Centro pívot: ${fmtP(pivotP)} | Soporte clave: ${fmtP(pivotS1)}. ${price >= pivotP ? `Mantenerse sobre el pívot de ${fmtP(pivotP)} refuerza la probabilidad alcista.` : `Cotizar bajo el pívot de ${fmtP(pivotP)} mantiene el riesgo de retroceso.`}`,
    fr: `Résistance supérieure : ${fmtP(pivotR1)} | Pivot central : ${fmtP(pivotP)} | Support clé : ${fmtP(pivotS1)}. ${price >= pivotP ? `Le maintien au-dessus du pivot à ${fmtP(pivotP)} renforce la probabilité haussière.` : `Évoluer sous le pivot à ${fmtP(pivotP)} maintient le risque de repli.`}`,
    pt: `Resistência superior: ${fmtP(pivotR1)} | Centro pivô: ${fmtP(pivotP)} | Suporte chave: ${fmtP(pivotS1)}. ${price >= pivotP ? `Manter-se acima do pivô de ${fmtP(pivotP)} reforça a probabilidade de alta.` : `Operar abaixo do pivô de ${fmtP(pivotP)} mantém o risco de recuo.`}`,
    id: `Klaster resistensi atas: ${fmtP(pivotR1)} | Pusat pivot: ${fmtP(pivotP)} | Batas support utama: ${fmtP(pivotS1)}. ${price >= pivotP ? `Bertahan di atas pivot harian ${fmtP(pivotP)} memperkuat probabilitas kelanjutan bullish.` : `Diperdagangkan di bawah pivot ${fmtP(pivotP)} mempertahankan risiko pullback jangka pendek.`}`,
  });

  if (category !== "forex" && category !== "commodity") {
    if (price > ema50) {
      const ema50Clause = ema50SupportTested
        ? pick(lang, {
            tr: ` EMA50 (${fmtP(ema50)}) çevresinde son geri çekilmelerde alıcıların yeniden devreye girmesi, bu bölgenin orta vadeli dinamik destek olarak çalıştığını gösteriyor.`,
            en: ` Buyers stepping back in around EMA50 (${fmtP(ema50)}) on recent pullbacks shows this zone acting as a medium-term dynamic support.`,
            es: ` Los compradores volviendo a entrar cerca de la EMA50 (${fmtP(ema50)}) en los últimos retrocesos muestra que esta zona actúa como soporte dinámico de medio plazo.`,
            fr: ` Le retour des acheteurs autour de l'EMA50 (${fmtP(ema50)}) lors des derniers replis montre que cette zone agit comme un support dynamique à moyen terme.`,
            pt: ` Compradores voltando a atuar perto da EMA50 (${fmtP(ema50)}) nos últimos recuos mostra que essa zona funciona como suporte dinâmico de médio prazo.`,
            id: ` Pembeli yang kembali masuk di sekitar EMA50 (${fmtP(ema50)}) pada koreksi terakhir menunjukkan zona ini berfungsi sebagai support dinamis jangka menengah.`,
          })
        : pick(lang, {
            tr: ` Fiyat EMA50'nin (${fmtP(ema50)}) üzerinde seyrediyor ancak bu seviyenin yakın dönemde destek olarak test edildiğine dair güçlü bir sinyal bulunmuyor.`,
            en: ` Price is trading above EMA50 (${fmtP(ema50)}), but there's no strong recent signal that this level has been tested as support.`,
            es: ` El precio cotiza sobre la EMA50 (${fmtP(ema50)}), pero no hay una señal reciente sólida de que este nivel haya sido probado como soporte.`,
            fr: ` Le prix évolue au-dessus de l'EMA50 (${fmtP(ema50)}), mais aucun signal récent solide ne montre que ce niveau a été testé comme support.`,
            pt: ` O preço está negociando acima da EMA50 (${fmtP(ema50)}), mas não há sinal recente forte de que esse nível tenha sido testado como suporte.`,
            id: ` Harga diperdagangkan di atas EMA50 (${fmtP(ema50)}), tetapi belum ada sinyal kuat baru-baru ini bahwa level ini teruji sebagai support.`,
          });
      keyLevels += ema50Clause;
    }

    const ema200Relevant = ema200SupportTested || (ema200 > 0 && price >= ema200 && (price - ema200) / price < 0.06);
    if (ema200Relevant) {
      keyLevels += pick(lang, {
        tr: ` Fiyat uzun vadeli EMA200 (${fmtP(ema200)}) bölgesinin üzerinde kalıyor; son geri çekilmelerde bu seviyenin korunması uzun vadeli trend açısından olumlu.`,
        en: ` Price is holding above the long-term EMA200 (${fmtP(ema200)}) zone; defending this level on recent pullbacks is constructive for the long-term trend.`,
        es: ` El precio se mantiene sobre la zona de la EMA200 de largo plazo (${fmtP(ema200)}); defender este nivel en los últimos retrocesos es constructivo para la tendencia de largo plazo.`,
        fr: ` Le prix se maintient au-dessus de la zone de l'EMA200 long terme (${fmtP(ema200)}) ; défendre ce niveau lors des derniers replis est positif pour la tendance long terme.`,
        pt: ` O preço se mantém acima da zona da EMA200 de longo prazo (${fmtP(ema200)}); defender esse nível nos últimos recuos é construtivo para a tendência de longo prazo.`,
        id: ` Harga bertahan di atas zona EMA200 jangka panjang (${fmtP(ema200)}); mempertahankan level ini pada koreksi terakhir positif bagi tren jangka panjang.`,
      });
    }
  }

  // Volume, Liquidity & Volatility character
  const liquidityVolume = pick(lang, {
    tr: category === "forex"
      ? `Döviz likidite akışı: Gün içi hacim ve spread dengesi standart seans aralığında. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Göreceli Hacim (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "İşlem aktivitesi ortalamanın üzerinde." : "Hacim teyidi ortalama seviyelerde; pozisyon büyüklüğü risk yönetimine göre ayarlanabilir."} ${volatilityLong}`,
    en: category === "forex"
      ? `Forex liquidity flow: Intraday order flow and spread dynamics are in standard session bounds. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Relative Volume (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Trading activity is above average." : "Volume confirmation is moderate; position sizing can be managed according to risk preference."} ${volatilityLong}`,
    es: category === "forex"
      ? `Flujo de liquidez Forex: El flujo de órdenes intradía está en rangos estándar. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volumen Relativo (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "La actividad de negociación está por encima del promedio." : "Confirmación de volumen moderada; gestione la posición según su riesgo."} ${volatilityLong}`,
    fr: category === "forex"
      ? `Flux de liquidité Forex : Flux d'ordres intrajournaliers dans les limites standards. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volume Relatif (RVOL) : ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "L'activité de négociation est supérieure à la moyenne." : "Confirmation de volume modérée ; gérez la taille de position selon votre risque."} ${volatilityLong}`,
    pt: category === "forex"
      ? `Fluxo de liquidez Forex: Fluxo de ordens intradiárias dentro dos limites padrão. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volume Relativo (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "A atividade de negociação está acima da média." : "Confirmação de volume moderada; ajuste o tamanho da posição de acordo com o risco."} ${volatilityLong}`,
    id: category === "forex"
      ? `Aliran likuiditas Forex: Aliran order intraday dan dinamika spread berada dalam batas sesi standar. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volume Relatif (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Aktivitas perdagangan di atas rata-rata." : "Konfirmasi volume moderat; ukuran posisi dapat disesuaikan menurut preferensi risiko."} ${volatilityLong}`,
  });

  // Localized "No Trade Plan Setup" Message
  const noPlanMessage = pick(lang, {
    tr: {
      title: "AKTİF İŞLEM KURGUSU YOK",
      description: "Mevcut fiyat yapısı (Düşüş Trendi / Yüksek Oynaklık) şu an için düşük riskli uzun pozisyon girişi, stop ve hedef kurgusu sunmamaktadır. Koşulların olgunlaşması beklenmelidir.",
    },
    en: {
      title: "NO ACTIVE TRADE SETUP",
      description: "Current price structure (Downtrend / High Volatility) does not offer a low-risk long entry, stop, and target configuration at this time. Wait for conditions to mature.",
    },
    es: {
      title: "SIN CONFIGURACIÓN DE OPERACIÓN ACTIVA",
      description: "La estructura de precios actual (Tendencia Bajista / Alta Volatilidad) no ofrece una configuración de entrada, stop y objetivo de bajo riesgo en este momento. Espere a que maduren las condiciones.",
    },
    fr: {
      title: "PAS DE CONFIGURATION DE TRADE ACTIVE",
      description: "La structure actuelle des prix (Tendance Baissière / Forte Volatilité) n'offre pas de configuration d'entrée, stop et objectif à faible risque pour le moment. Attendez que les conditions mûrissent.",
    },
    pt: {
      title: "SEM CONFIGURAÇÃO DE OPERAÇÃO ATIVA",
      description: "A estrutura de preços atual (Tendência de Baixa / Alta Volatilidade) não oferece uma configuração de entrada, stop e alvo de baixo risco neste momento. Aguarde as condições amadurecerem.",
    },
    id: {
      title: "TIDAK ADA SETUP TRADING AKTIF",
      description: "Struktur harga saat ini (Tren Turun / Volatilitas Tinggi) tidak menawarkan konfigurasi entry, stop, dan target berisiko rendah saat ini. Tunggu hingga kondisi matang.",
    },
  });

  return {
    bias,
    biasLabel,
    assetClassLabel,
    summary,
    keyLevels,
    liquidityVolume,
    noPlanMessage,
  };
}
type AiAiInput = AiCommentaryInput;
