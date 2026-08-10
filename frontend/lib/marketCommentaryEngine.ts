import { AssetCategory, formatAssetPrice } from "./symbols";
import { formatNumber } from "@/lib/formatNumber";

export type CommentaryLang = "tr" | "en" | "es" | "fr" | "pt";

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

  // Asset Class Badges
  const assetClassLabel = pick(lang, {
    tr: category === "forex" ? "DÖVİZ PARİTESİ" : category === "commodity" ? "EMTIA PİYASASI" : category === "crypto" ? "KRİPTO VARLIK" : "ABD HİSSESİ",
    en: category === "forex" ? "CURRENCY PAIR" : category === "commodity" ? "COMMODITY MARKET" : category === "crypto" ? "CRYPTO ASSET" : "US EQUITY",
    es: category === "forex" ? "PAR DE DIVISAS" : category === "commodity" ? "MATERIA PRIMA" : category === "crypto" ? "CRIPTOMONEDA" : "ACCIÓN DE EE. UU.",
    fr: category === "forex" ? "PAIRE DE DEVISES" : category === "commodity" ? "MATIÈRE PREMIÈRE" : category === "crypto" ? "CRYPTO-ACTIF" : "ACTION AMÉRICAINE",
    pt: category === "forex" ? "PAR DE MOEDAS" : category === "commodity" ? "COMMODITY" : category === "crypto" ? "CRIPTOATIVO" : "AÇÃO DOS EUA",
  });

  // Bias Badges
  const biasLabelMap: Record<AiMarketCommentary["bias"], Record<CommentaryLang, string>> = {
    BULLISH: {
      tr: "BOĞA EĞİLİMLİ ↗",
      en: "BULLISH BIAS ↗",
      es: "SESGO ALCISTA ↗",
      fr: "BIAIS HAUSSIER ↗",
      pt: "TENDÊNCIA DE ALTA ↗",
    },
    BEARISH: {
      tr: "AYI EĞİLİMLİ ↘",
      en: "BEARISH BIAS ↘",
      es: "SESGO BAJISTA ↘",
      fr: "BIAIS BAISSIER ↘",
      pt: "TENDÊNCIA DE BAIXA ↘",
    },
    BREAKOUT_WATCH: {
      tr: "KIRILIM TAKİBİ ⚡",
      en: "BREAKOUT WATCH ⚡",
      es: "VIGILANCIA DE RUPTURA ⚡",
      fr: "SURVEILLANCE DE CASSAURE ⚡",
      pt: "MONITORANDO RUPTURA ⚡",
    },
    NEUTRAL: {
      tr: "NÖTR / SIKIŞMA ⇄",
      en: "NEUTRAL / CONSOLIDATION ⇄",
      es: "NEUTRAL / CONSOLIDACIÓN ⇄",
      fr: "NEUTRE / CONSOLIDATION ⇄",
      pt: "NEUTRO / CONSOLIDAÇÃO ⇄",
    },
  };

  const biasLabel = pick(lang, biasLabelMap[bias]);

  // Asset-specific Narrative Generation
  let summary = "";
  if (category === "commodity") {
    summary = pick(lang, {
      tr: `${ticker} spot piyasada ${fmtP(price)} seviyesinde işlem görmektedir (%${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}). Fiyatın 20 günlük EMA (${fmtP(ema20)}) ve VWAP (${fmtP(vwap)}) üzerindeki konumu ${bias === "BULLISH" ? "kurumsal alım baskısının ve makro yükseliş trendinin korunduğunu gösterir." : "makro satıcıların etkisinde dengelenme aradığını göstermektedir."} ATR% %${formatNumber(atrPct, 2)} ile emtia volatilitesinin aktif olduğunu doğrulamaktadır.`,
      en: `${ticker} is trading at ${fmtP(price)} in spot markets (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Price relative to the 20-day EMA (${fmtP(ema20)}) and VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indicates sustained institutional buying pressure and macro uptrend alignment." : "suggests market participants are absorbing supply below key dynamic resistance."} ATR% at ${formatNumber(atrPct, 2)}% reflects active commodity volatility.`,
      es: `${ticker} cotiza a ${fmtP(price)} en los mercados al contado (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). El precio con respecto a la EMA20 (${fmtP(ema20)}) y VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indica una presión compradora institucional sostenida y alineación de tendencia macro." : "sugiere consolidación bajo resistencia dinámica."} El ATR% de ${formatNumber(atrPct, 2)}% refleja volatilidad activa.`,
      fr: `${ticker} se négocie à ${fmtP(price)} sur les marchés au comptant (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Le prix par rapport à l'EMA20 (${fmtP(ema20)}) et au VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indique une pression acheteuse institutionnelle soutenue et un alignement haussier macro." : "suggère une absorption de l'offre sous résistance."} L'ATR% à ${formatNumber(atrPct, 2)}% reflète une volatilité active.`,
      pt: `${ticker} está negociando a ${fmtP(price)} nos mercados à vista (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). O preço em relação à EMA20 (${fmtP(ema20)}) e VWAP (${fmtP(vwap)}) ${bias === "BULLISH" ? "indica pressão compradora institucional sustentada e alinhamento de tendência de alta." : "sugere consolidação sob resistência dinâmica."} O ATR% em ${formatNumber(atrPct, 2)}% reflete volatilidade ativa.`,
    });
  } else if (category === "forex") {
    summary = pick(lang, {
      tr: `${ticker} paritesi ${fmtP(price)} seviyesinde seyretmektedir. Gün içi VWAP (${fmtP(vwap)}) ve pivot seviyesi (${fmtP(pivotP)}) etrafındaki fiyatlama, ${bias === "BULLISH" ? "alıcıların üst üste seanslarda kontrolü elinde tuttuğuna işaret etmektedir." : "satıcı ağırlıklı momentumun devam ettiğine işaret etmektedir."} RSI (${formatNumber(rsi, 0)}) dengeli ivmeyi desteklemektedir.`,
      en: `${ticker} currency pair is trading at ${fmtP(price)}. Price action around intraday VWAP (${fmtP(vwap)}) and Daily Pivot (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indicates buyers maintaining control across sessions." : "signals prevailing downside order flow momentum."} RSI at ${formatNumber(rsi, 0)} reflects balanced momentum dynamics.`,
      es: `El par ${ticker} cotiza a ${fmtP(price)}. La acción del precio alrededor del VWAP intradía (${fmtP(vwap)}) y el Pívot Diario (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indica que los compradores mantienen el control en las sesiones." : "señala impulso vendedor predominante."} El RSI en ${formatNumber(rsi, 0)} refleja dinámica equilibrada.`,
      fr: `La paire ${ticker} évolue à ${fmtP(price)}. L'action des prix autour du VWAP intrajournalier (${fmtP(vwap)}) et du Pivot Journalier (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indique que les acheteurs gardent le contrôle." : "signale un momentum vendeur prédominant."} Le RSI à ${formatNumber(rsi, 0)} confirme la dynamique.`,
      pt: `O par ${ticker} é negociado a ${fmtP(price)}. A ação do preço ao redor do VWAP intradiário (${fmtP(vwap)}) e Pivô Diário (${fmtP(pivotP)}) ${bias === "BULLISH" ? "indica compradores mantendo o controle." : "sinaliza impulso vendedor predominante."} O RSI em ${formatNumber(rsi, 0)} reflete dinâmica equilibrada.`,
    });
  } else if (category === "crypto") {
    summary = pick(lang, {
      tr: `${ticker} 24 saatlik kripto likidite akışında ${fmtP(price)} seviyesindedir (%${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}). 20 günlük EMA (${fmtP(ema20)}) ve 200 günlük trend çizgisi (${fmtP(ema200)}) ${bias === "BULLISH" ? "zincir içi ve teknik birikim yapısını doğrulamaktadır." : "likidite arayışının devam ettiğini göstermektedir."} Wyckoff birikim skoru (${wyckoffScore}/100) piyasa yapısını özetler.`,
      en: `${ticker} is trading at ${fmtP(price)} across 24/7 crypto liquidity pools (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). Technical alignment with the 20-day EMA (${fmtP(ema20)}) and 200-day baseline (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirms ongoing structural accumulation." : "reflects liquidity hunting under key moving averages."} Wyckoff structure score is ${wyckoffScore}/100.`,
      es: `${ticker} cotiza a ${fmtP(price)} en los pools de liquidez cripto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). La alineación técnica con la EMA20 (${fmtP(ema20)}) y la EMA200 (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirma acumulación estructural continua." : "refleja búsqueda de liquidez."} Puntuación Wyckoff: ${wyckoffScore}/100.`,
      fr: `${ticker} se négocie à ${fmtP(price)} sur les pools de liquidité crypto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). L'alignement technique avec l'EMA20 (${fmtP(ema20)}) et l'EMA200 (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirme une accumulation structurelle en cours." : "reflète une recherche de liquidité."} Score Wyckoff : ${wyckoffScore}/100.`,
      pt: `${ticker} está negociando a ${fmtP(price)} nos pools de liquidez cripto 24/7 (${changePct > 0 ? "+" : ""}${formatNumber(changePct, 2)}%). O alinhamento técnico com a EMA20 (${fmtP(ema20)}) e a EMA200 (${fmtP(ema200)}) ${bias === "BULLISH" ? "confirma acumulação estrutural contínua." : "reflete busca por liquidez."} Pontuação Wyckoff: ${wyckoffScore}/100.`,
    });
  } else {
    summary = pick(lang, {
      tr: `${ticker} hissesi ${fmtP(price)} seviyesindedir. EMA20 (${fmtP(ema20)}) ve EMA50 (${fmtP(ema50)}) ilişkisi, Weinstein Aşama ${weinsteinStage} yapısı ile uyumlu olarak ${bias === "BULLISH" ? "pozitif trend ivmesini korumaktadır." : "konsolidasyon ve seviye takibi gerektirmektedir."}`,
      en: `${ticker} is trading at ${fmtP(price)}. The EMA20 (${fmtP(ema20)}) and EMA50 (${fmtP(ema50)}) structure in Weinstein Stage ${weinsteinStage} ${bias === "BULLISH" ? "supports positive momentum continuation." : "requires confirmation near key dynamic supports."}`,
      es: `${ticker} cotiza a ${fmtP(price)}. La estructura de la EMA20 (${fmtP(ema20)}) y EMA50 (${fmtP(ema50)}) en Etapa Weinstein ${weinsteinStage} ${bias === "BULLISH" ? "respalda la continuación del impulso positivo." : "requiere confirmación cerca de soportes dinámicos."}`,
      fr: `${ticker} évolue à ${fmtP(price)}. La structure de l'EMA20 (${fmtP(ema20)}) et de l'EMA50 (${fmtP(ema50)}) en Étape Weinstein ${weinsteinStage} ${bias === "BULLISH" ? "soutient la poursuite du momentum positif." : "nécessite une confirmation."}`,
      pt: `${ticker} está cotado a ${fmtP(price)}. A estrutura da EMA20 (${fmtP(ema20)}) e EMA50 (${fmtP(ema50)}) na Estágio Weinstein ${weinsteinStage} ${bias === "BULLISH" ? "suporta a continuação do impulso positivo." : "requer confirmação."}`,
    });
  }

  // Key Levels
  const keyLevels = pick(lang, {
    tr: `Üst direnç kümesi: ${fmtP(pivotR1)} | Pivot merkezi: ${fmtP(pivotP)} | Alt destek seviyesi: ${fmtP(pivotS1)}. ${price >= pivotP ? `Fiyatın ${fmtP(pivotP)} pivot seviyesi üzerinde tutunması yukarı yönlü olasılığı güçlendirir.` : `Fiyatın ${fmtP(pivotP)} pivot altında kalması geri çekilme riskini canlı tutar.`}`,
    en: `Upper resistance cluster: ${fmtP(pivotR1)} | Pivot center: ${fmtP(pivotP)} | Key support boundary: ${fmtP(pivotS1)}. ${price >= pivotP ? `Holding above ${fmtP(pivotP)} daily pivot strengthens bullish continuation probability.` : `Trading below ${fmtP(pivotP)} pivot preserves short-term pullback risk.`}`,
    es: `Resistencia superior: ${fmtP(pivotR1)} | Centro pívot: ${fmtP(pivotP)} | Soporte clave: ${fmtP(pivotS1)}. ${price >= pivotP ? `Mantenerse sobre el pívot de ${fmtP(pivotP)} refuerza la probabilidad alcista.` : `Cotizar bajo el pívot de ${fmtP(pivotP)} mantiene el riesgo de retroceso.`}`,
    fr: `Résistance supérieure : ${fmtP(pivotR1)} | Pivot central : ${fmtP(pivotP)} | Support clé : ${fmtP(pivotS1)}. ${price >= pivotP ? `Le maintien au-dessus du pivot à ${fmtP(pivotP)} renforce la probabilité haussière.` : `Évoluer sous le pivot à ${fmtP(pivotP)} maintient le risque de repli.`}`,
    pt: `Resistência superior: ${fmtP(pivotR1)} | Centro pivô: ${fmtP(pivotP)} | Suporte chave: ${fmtP(pivotS1)}. ${price >= pivotP ? `Manter-se acima do pivô de ${fmtP(pivotP)} reforça a probabilidade de alta.` : `Operar abaixo do pivô de ${fmtP(pivotP)} mantém o risco de recuo.`}`,
  });

  // Liquidity & Volume
  const liquidityVolume = pick(lang, {
    tr: category === "forex"
      ? `Döviz likidite akışı: Gün içi hacim ve spread dengesi standart seans aralığında. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Göreceli Hacim (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Piyasa katılımı ortalamanın üzerinde ve kurumsal emir akışı aktif." : "Hacim teyidi ortalama seviyelerde, pozisyon büyüklüğü risk yönetimine göre ayarlanabilir."}`,
    en: category === "forex"
      ? `Forex liquidity flow: Intraday order flow and spread dynamics are in standard session bounds. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Relative Volume (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Market participation is above average with active institutional order flow." : "Volume confirmation is moderate; position sizing can be managed according to risk preference."}`,
    es: category === "forex"
      ? `Flujo de liquidez Forex: El flujo de órdenes intradía está en rangos estándar. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volumen Relativo (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Participación de mercado por encima del promedio con flujo institucional activo." : "Confirmación de volumen moderada; gestione la posición según su riesgo."}`,
    fr: category === "forex"
      ? `Flux de liquidité Forex : Flux d'ordres intrajournaliers dans les limites standards. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volume Relatif (RVOL) : ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Participation au marché supérieure à la moyenne avec flux institutionnel actif." : "Confirmation de volume modérée ; gérez la taille de position selon votre risque."}`,
    pt: category === "forex"
      ? `Fluxo de liquidez Forex: Fluxo de ordens intradiárias dentro dos limites padrão. RVOL: ${formatNumber(rvol, 2)}x.`
      : `Volume Relativo (RVOL): ${formatNumber(rvol, 2)}x. ${rvol >= 1.5 ? "Participação de mercado acima da média com fluxo institucional ativo." : "Confirmação de volume moderada; ajuste o tamanho da posição de acordo com o risco."}`,
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
