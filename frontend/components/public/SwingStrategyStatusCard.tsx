"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { formatNumber } from "@/lib/formatNumber";

// Bu kart, /graphic/[ticker] sayfasındaki "işlem kurgusu gerekçesi"ni
// swing117_boga.py botunun GERÇEK Power Pullback çıktısıyla besler —
// TickerDetailPanel'in kendi bağımsız (Yahoo Finance'ten yeniden türetilmiş)
// teknik analiz motorundan farklı olarak, burada gösterilen her satır
// doğrudan botun ürettiği JSON alanlarından (entry_status, detail_reasoning,
// factor_scores, selection_reasons, trigger_15m) geliyor. Böylece hisse şu an
// botun aktif 10-swing/10-watchlist havuzundaysa, sayfadaki gerekçe metni
// botun stratejisiyle birebir uyumlu olur.

// Gerekçe cümlesi YAPISAL veriden (trigger_detail: tip + sayılar) kurulur —
// botun ürettiği Türkçe cümleyi (detail_reasoning) AYRIŞTIRMIYORUZ, çünkü
// metin ayrıştırma "tanımadığım bir kalıp gelirse" diye bir başarısızlık
// ihtimali taşır. trigger_detail, swing117_boga.py'nin layer4_entry_trigger_
// 15m_hybrid'in ZATEN hesapladığı sayıları (rvol/level/rsi/n_candles) doğrudan
// JSON'a yazmasıyla gelir (bkz. swing117_boga.py "trigger_detail" ataması) —
// burada sadece TİP'e göre doğru cümle şablonu seçilip sayılar yerleştirilir.
// Bilinen 5 tip dışında bir tip gelirse (örn. ileride yeni bir tetik eklenip
// burası güncellenmezse) kesinlikle YANLIŞ dilde metin göstermek yerine
// gerekçe satırı hiç gösterilmez (bkz. render'daki kontrol).
export interface TriggerDetail {
  type: string;
  rvol: number | null;
  level: number | null;
  rsi: number | null;
  n_candles: number | null;
  price: number | null;
}

type ReasoningLang = "tr" | "en" | "es" | "fr" | "pt";

const CANDLE_TYPE_LABEL: Record<string, Record<ReasoningLang, string>> = {
  BULLISH_ENGULFING: {
    tr: "Boğa Yutan Mum", en: "bullish engulfing candle", es: "vela envolvente alcista",
    fr: "bougie enveloppante haussière", pt: "candle de engolfo de alta",
  },
  BREAKOUT_CANDLE: {
    tr: "Kırılım Mumu", en: "breakout candle", es: "vela de ruptura",
    fr: "bougie de cassure", pt: "candle de rompimento",
  },
};

function buildReasoningSentence(td: TriggerDetail, l: ReasoningLang): string | null {
  switch (td.type) {
    case "15M_BREAKOUT":
      if (td.rvol == null || td.level == null) return null;
      return {
        tr: `Breakout tetiği yakalandı: Hacimli kırılım (${formatNumber(td.rvol, 1)}x) > direnç ($${formatNumber(td.level, 2)})`,
        en: `Breakout trigger captured: high-volume breakout (${formatNumber(td.rvol, 1)}x) > resistance ($${formatNumber(td.level, 2)})`,
        es: `Disparador de ruptura capturado: ruptura con alto volumen (${formatNumber(td.rvol, 1)}x) > resistencia ($${formatNumber(td.level, 2)})`,
        fr: `Déclencheur de cassure capturé : cassure à fort volume (${formatNumber(td.rvol, 1)}x) > résistance (${formatNumber(td.level, 2)}$)`,
        pt: `Gatilho de rompimento capturado: rompimento com alto volume (${formatNumber(td.rvol, 1)}x) > resistência ($${formatNumber(td.level, 2)})`,
      }[l];
    case "15M_SPRING_BOUNCE":
      if (td.rsi == null) return null;
      return {
        tr: `Spring bounce tetiği yakalandı: RSI:${formatNumber(td.rsi, 1)} + MACD yön yukarı`,
        en: `Spring bounce trigger captured: RSI:${formatNumber(td.rsi, 1)} + MACD turning up`,
        es: `Disparador de rebote (spring) capturado: RSI:${formatNumber(td.rsi, 1)} + MACD girando al alza`,
        fr: `Déclencheur de rebond (spring) capturé : RSI :${formatNumber(td.rsi, 1)} + MACD orienté à la hausse`,
        pt: `Gatilho de repique (spring) capturado: RSI:${formatNumber(td.rsi, 1)} + MACD virando para cima`,
      }[l];
    case "15M_EMA_CROSS":
      return {
        tr: `EMA Cross tetiği yakalandı: 15m grafik üzerinde EMA9/20 Golden Cross`,
        en: `EMA Cross trigger captured: EMA9/20 Golden Cross on the 15m chart`,
        es: `Disparador de cruce de EMA capturado: Golden Cross EMA9/20 en el gráfico de 15m`,
        fr: `Déclencheur de croisement d'EMA capturé : Golden Cross EMA9/20 sur le graphique 15m`,
        pt: `Gatilho de cruzamento de EMA capturado: Golden Cross EMA9/20 no gráfico de 15m`,
      }[l];
    case "BULLISH_ENGULFING":
    case "BREAKOUT_CANDLE": {
      if (td.n_candles == null || td.rsi == null || td.rvol == null) return null;
      const candleLabel = CANDLE_TYPE_LABEL[td.type][l];
      return {
        tr: `Power Pullback (${td.n_candles} mum) tetiklendi. RSI reset (${formatNumber(td.rsi, 0)}). ${candleLabel}. Hacim ${formatNumber(td.rvol, 1)}x`,
        en: `Power Pullback (${td.n_candles} candles) triggered. RSI reset (${formatNumber(td.rsi, 0)}). ${candleLabel}. Volume ${formatNumber(td.rvol, 1)}x`,
        es: `Power Pullback (${td.n_candles} velas) activado. RSI reiniciado (${formatNumber(td.rsi, 0)}). ${candleLabel}. Volumen ${formatNumber(td.rvol, 1)}x`,
        fr: `Power Pullback (${td.n_candles} bougies) déclenché. RSI réinitialisé (${formatNumber(td.rsi, 0)}). ${candleLabel}. Volume ${formatNumber(td.rvol, 1)}x`,
        pt: `Power Pullback (${td.n_candles} candles) acionado. RSI resetado (${formatNumber(td.rsi, 0)}). ${candleLabel}. Volume ${formatNumber(td.rvol, 1)}x`,
      }[l];
    }
    case "VOLUME_BREAKOUT":
      if (td.rvol == null || td.price == null) return null;
      return {
        tr: `Hacimli Kırılım yakalandı: Güçlü yükseliş hacmi (${formatNumber(td.rvol, 1)}x) + Fiyat kırılımı ($${formatNumber(td.price, 2)} > son 4 mum yüksekliği)`,
        en: `Volume Breakout captured: strong bullish volume (${formatNumber(td.rvol, 1)}x) + price breakout ($${formatNumber(td.price, 2)} > last 4-candle high)`,
        es: `Ruptura por volumen capturada: volumen alcista fuerte (${formatNumber(td.rvol, 1)}x) + ruptura de precio ($${formatNumber(td.price, 2)} > máximo de las últimas 4 velas)`,
        fr: `Cassure sur volume capturée : fort volume haussier (${formatNumber(td.rvol, 1)}x) + cassure de prix (${formatNumber(td.price, 2)}$ > plus haut des 4 dernières bougies)`,
        pt: `Rompimento por volume capturado: forte volume de alta (${formatNumber(td.rvol, 1)}x) + rompimento de preço ($${formatNumber(td.price, 2)} > máxima das últimas 4 velas)`,
      }[l];
    default:
      return null; // bilinmeyen/yeni bir tip — yanlış dilde göstermektense hiç gösterme
  }
}

function translateDetailReasoning(triggerDetail: TriggerDetail | null | undefined, locale: Locale): string | null {
  if (!triggerDetail || !triggerDetail.type) return null;
  const l: ReasoningLang = (["tr", "en", "es", "fr", "pt"] as const).includes(locale as ReasoningLang)
    ? (locale as ReasoningLang)
    : "en";
  return buildReasoningSentence(triggerDetail, l);
}

interface SwingPick {
  ticker: string;
  entry_status?: "PENDING" | "ENTERED";
  entry_zone?: { low: number; high: number } | null;
  date_added?: string;
  system_label?: { text: string; color: string };
  detail_reasoning?: string;
  trigger_detail?: TriggerDetail | null;
  selection_reasons?: string[];
  factor_scores?: {
    trend_score?: number;
    momentum_score?: number;
    volatility_score?: number;
    volume_score?: number;
    catalyst_score?: number;
  };
  score?: number;
}

const T: Record<Locale, {
  title: string; pendingMessage: string; enteredMessage: string; inWatchlist: string; notTracked: string;
  notTrackedNote: string; entered: string; pending: string; entryZone: string;
  dateAdded: string; reasonLabel: string; layers: string; tradePlanNote: string;
  layer1: string; layer2: string; layer3: string; layer4Pending: string; layer4Entered: string;
  factorTrend: string; factorMomentum: string; factorVolatility: string; factorVolume: string; factorSector: string;
  swingLink: string; watchlistLink: string;
}> = {
  tr: {
    title: "BogaStock.com Trend Strateji Durumu",
    pendingMessage: "Bu hisse BogaStock.com analiz sisteminin Trend takip listesinde ve izleme aşamasında. Karlı bir fırsat için uygun setup/formasyon oluşması bekleniyor.",
    enteredMessage: "Bu hisse BogaStock.com analiz sisteminin Trend takip listesinde ve uygun alım setup'ı (giriş sinyali) oluştu.",
    inWatchlist: "Bu hisse şu an Trend Adayları arasında izleniyor — uygun teknik şartlar olgunlaştığında Trend Listesi'ne alınabilir.",
    notTracked: "Bu hisse için BogaStock.com sisteminde henüz aktif bir swing setup'ı veya tetikleyici formasyon oluşmamış olabilir.",
    notTrackedNote: "BogaStock.com analiz sistemi ABD borsalarını düzenli olarak taramaya devam ediyor. Hisse, sistemin aradığı teknik kırılım ve momentum kriterlerini karşıladığında otomatik olarak takibe alınır.",
    entered: "Giriş Zone",
    pending: "Bekle",
    entryZone: "Giriş Bölgesi",
    dateAdded: "Havuza eklenme",
    reasonLabel: "Gerekçe",
    layers: "Katman Onayı",
    tradePlanNote: "Aşağıdaki işlem planımızdaki Giriş, Hedef ve Stop Loss bölgelerine göre risk durumunuzu ayarlayarak pozisyon açabilirsiniz.",
    layer1: "1D Trend",
    layer2: "4H Kalite",
    layer3: "1H Momentum",
    layer4Pending: "15m Tetik: Bekleniyor",
    layer4Entered: "15m Tetik: Yakalandı",
    factorTrend: "4H Trend Kalitesi",
    factorMomentum: "RS Gücü",
    factorVolatility: "Pullback Kalitesi",
    factorVolume: "1H RVOL",
    factorSector: "Sektör Momentumu",
    swingLink: "Trend Sayfasında Gör",
    watchlistLink: "Watchlist Sayfasında Gör",
  },
  en: {
    title: "BogaStock.com Trend Strategy Status",
    pendingMessage: "This stock is in the BogaStock.com Trend list and is currently being monitored. We are waiting for a proper setup/formation to develop for a profitable opportunity.",
    enteredMessage: "This stock is in the BogaStock.com Trend list and a valid entry setup has been triggered.",
    inWatchlist: "This stock is currently being tracked as a Trend Candidate — it may join the Trend List once technical conditions mature.",
    notTracked: "An active swing setup or triggering formation may not have formed for this stock yet in the BogaStock.com system.",
    notTrackedNote: "The BogaStock.com analysis system continuously scans the U.S. stock market. The stock will automatically be tracked once it meets the required technical breakout and momentum criteria.",
    entered: "Entry Zone",
    pending: "Wait",
    entryZone: "Entry Zone",
    dateAdded: "Added to pool",
    reasonLabel: "Rationale",
    layers: "Layer Confirmation",
    tradePlanNote: "Based on the Entry, Target and Stop Loss zones in our trade plan below, you can open a position while adjusting your risk accordingly.",
    layer1: "1D Trend",
    layer2: "4H Quality",
    layer3: "1H Momentum",
    layer4Pending: "15m Trigger: Pending",
    layer4Entered: "15m Trigger: Captured",
    factorTrend: "4H Trend Quality",
    factorMomentum: "RS Strength",
    factorVolatility: "Pullback Quality",
    factorVolume: "1H RVOL",
    factorSector: "Sector Momentum",
    swingLink: "View on Trend Page",
    watchlistLink: "View on Watchlist Page",
  },
  es: {
    title: "Estado de Estrategia de Tendencia de BogaStock.com",
    pendingMessage: "Esta acción está en la lista de Tendencia de BogaStock.com y está siendo monitoreada. Esperamos que se desarrolle un setup/formación adecuado para una oportunidad rentable.",
    enteredMessage: "Esta acción está en la lista de Tendencia de BogaStock.com y se ha activado un setup de entrada válido.",
    inWatchlist: "Esta acción está siendo seguida actualmente como Candidata a Tendencia — podría unirse a la Lista de Tendencia cuando maduren las condiciones técnicas.",
    notTracked: "Es posible que aún no se haya formado un setup de swing activo o una formación de activación para esta acción en el sistema de BogaStock.com.",
    notTrackedNote: "El sistema de análisis de BogaStock.com escanea continuamente el mercado de EE. UU. La acción será rastreada automáticamente una vez que cumpla con los criterios técnicos requeridos de ruptura y momento.",
    entered: "Zona de Entrada",
    pending: "Esperar",
    entryZone: "Zona de Entrada",
    dateAdded: "Añadido al pool",
    reasonLabel: "Justificación",
    layers: "Confirmación de Capas",
    tradePlanNote: "Según las zonas de Entrada, Objetivo y Stop Loss de nuestro plan de operación a continuación, puede abrir una posición ajustando su riesgo en consecuencia.",
    layer1: "Tendencia 1D",
    layer2: "Calidad 4H",
    layer3: "Momentum 1H",
    layer4Pending: "Gatillo 15m: Pendiente",
    layer4Entered: "Gatillo 15m: Capturado",
    factorTrend: "Calidad de Tendencia 4H",
    factorMomentum: "Fuerza RS",
    factorVolatility: "Calidad de Pullback",
    factorVolume: "RVOL 1H",
    factorSector: "Momentum Sectorial",
    swingLink: "Ver en Página de Tendencia",
    watchlistLink: "Ver en Página Watchlist",
  },
  fr: {
    title: "Statut de la Stratégie Tendance BogaStock.com",
    pendingMessage: "Cette action figure dans la liste Tendance de BogaStock.com et est actuellement surveillée. Nous attendons qu'un setup/formation approprié se développe pour une opportunité rentable.",
    enteredMessage: "Cette action figure dans la liste Tendance de BogaStock.com et un setup d'entrée valide a été déclenché.",
    inWatchlist: "Cette action est actuellement suivie en tant que Candidate Tendance — elle pourrait rejoindre la Liste Tendance une fois les conditions techniques mûries.",
    notTracked: "Un setup de swing actif ou une formation de déclenchement pourrait ne pas encore s'être formé pour cette action dans le système BogaStock.com.",
    notTrackedNote: "Le système d'analyse BogaStock.com scanne en continu le marché boursier américain. L'action sera automatiquement suivie une fois qu'elle remplira les critères techniques requis de cassure et de momentum.",
    entered: "Zone d'Entrée",
    pending: "Attendre",
    entryZone: "Zone d'Entrée",
    dateAdded: "Ajouté au pool",
    reasonLabel: "Justification",
    layers: "Confirmation des Couches",
    tradePlanNote: "Selon les zones d'Entrée, d'Objectif et de Stop Loss de notre plan de trading ci-dessous, vous pouvez ouvrir une position en ajustant votre risque en conséquence.",
    layer1: "Tendance 1D",
    layer2: "Qualité 4H",
    layer3: "Momentum 1H",
    layer4Pending: "Déclencheur 15m : En attente",
    layer4Entered: "Déclencheur 15m : Capturé",
    factorTrend: "Qualité Tendance 4H",
    factorMomentum: "Force RS",
    factorVolatility: "Qualité du Pullback",
    factorVolume: "RVOL 1H",
    factorSector: "Momentum Sectoriel",
    swingLink: "Voir sur la Page Tendance",
    watchlistLink: "Voir sur la Page Watchlist",
  },
  pt: {
    title: "Status da Estratégia de Tendência da BogaStock.com",
    pendingMessage: "Esta ação está na lista de Tendência da BogaStock.com e está sendo monitorada. Estamos aguardando que um setup/formação adequado se desenvolva para uma oportunidade lucrativa.",
    enteredMessage: "Esta ação está na lista de Tendência da BogaStock.com e um setup de entrada válido foi acionado.",
    inWatchlist: "Esta ação está sendo rastreada atualmente como Candidata à Tendência — ela pode entrar na Lista de Tendência assim que as condições técnicas amadurecerem.",
    notTracked: "Um setup de swing ativo ou uma formação de gatilho pode ainda não ter se formado para esta ação no sistema da BogaStock.com.",
    notTrackedNote: "O sistema de análise da BogaStock.com varre continuamente o mercado de ações dos EUA. A ação será rastreada automaticamente assim que atender aos critérios técnicos exigidos de rompimento e momentum.",
    entered: "Zona de Entrada",
    pending: "Aguardar",
    entryZone: "Zona de Entrada",
    dateAdded: "Adicionado ao pool",
    reasonLabel: "Justificativa",
    layers: "Confirmação de Camadas",
    tradePlanNote: "Com base nas zonas de Entrada, Alvo e Stop Loss do nosso plano de operação abaixo, você pode abrir uma posição ajustando seu risco de acordo.",
    layer1: "Tendência 1D",
    layer2: "Qualidade 4H",
    layer3: "Momentum 1H",
    layer4Pending: "Gatilho 15m: Pendente",
    layer4Entered: "Gatilho 15m: Capturado",
    factorTrend: "Qualidade Tendência 4H",
    factorMomentum: "Força RS",
    factorVolatility: "Qualidade do Pullback",
    factorVolume: "RVOL 1H",
    factorSector: "Momentum Setorial",
    swingLink: "Ver na Página de Tendência",
    watchlistLink: "Ver na Página Watchlist",
  },
};

export default function SwingStrategyStatusCard({ ticker, locale }: { ticker: string; locale: Locale }) {
  const t = T[locale] ?? T.en;
  const [swingPick, setSwingPick] = useState<SwingPick | null | undefined>(undefined);
  const [watchPick, setWatchPick] = useState<SwingPick | null | undefined>(undefined);

  useEffect(() => {
    if (!ticker) return;
    let active = true;

    fetch("/api/swing-picks?min=10")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const found = (d?.picks ?? []).find((p: SwingPick) => p.ticker === ticker);
        setSwingPick(found ?? null);
      })
      .catch(() => active && setSwingPick(null));

    fetch("/api/watchlist-picks")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const found = (d?.picks ?? []).find((p: SwingPick) => p.ticker === ticker);
        setWatchPick(found ?? null);
      })
      .catch(() => active && setWatchPick(null));

    return () => {
      active = false;
    };
  }, [ticker]);

  if (swingPick === undefined || watchPick === undefined) {
    return null; // henüz yükleniyor — bir önceki panel zaten yükleniyor göstergesi veriyor
  }

  return (
    <div className="glass-card overflow-hidden mb-4 bg-[#111620] border border-[#253347] rounded-lg p-3.5">
      <div className="text-xs text-white/40 uppercase tracking-widest font-medium mb-2.5 pb-2 border-b border-[#58a6ff]/30">
        {t.title}
      </div>

      {swingPick ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block text-[10px] font-medium px-2 py-0.5 rounded"
              style={{
                color: swingPick.entry_status === "ENTERED" ? "#3fb950" : "#8b949e",
                background: swingPick.entry_status === "ENTERED" ? "#3fb95022" : "#8b949e18",
                border: `1px solid ${swingPick.entry_status === "ENTERED" ? "#3fb95055" : "#8b949e33"}`,
              }}
            >
              {swingPick.entry_status === "ENTERED" ? t.entered : t.pending}
            </span>
            {swingPick.date_added && (
              <span className="text-[10px] text-white/40">{t.dateAdded}: {swingPick.date_added}</span>
            )}
          </div>

          <p className="text-xs text-white/80 leading-relaxed">
            {swingPick.entry_status === "ENTERED" ? t.enteredMessage : t.pendingMessage}
          </p>

          {swingPick.entry_status === "ENTERED" && swingPick.entry_zone && (
            <div className="text-xs text-green-400">
              {t.entryZone}: ${formatNumber(swingPick.entry_zone.low, 2)} – ${formatNumber(swingPick.entry_zone.high, 2)}
            </div>
          )}

          {(() => {
            // TR: bot zaten Türkçe üretiyor, doğrudan göster. Diğer diller:
            // SADECE yapısal trigger_detail'den kurulan cümleyi göster —
            // trigger_detail yoksa/tipi tanınmıyorsa gerekçe satırını hiç
            // gösterme (yanlış dilde metin göstermektense göstermemek yeğdir).
            const reasoningText =
              locale === "tr"
                ? swingPick.detail_reasoning
                : translateDetailReasoning(swingPick.trigger_detail, locale);
            if (!reasoningText) return null;
            return (
              <p className="text-xs text-white/70 leading-relaxed">
                <span className="text-[#58a6ff] font-medium">{t.reasonLabel}:</span> {reasoningText}
              </p>
            );
          })()}

          <p className="text-xs text-amber-300/90 leading-relaxed border-t border-[#253347] pt-2.5">
            {t.tradePlanNote}
          </p>

          <Link
            href={`/global/${locale}/swing`}
            className="self-start text-[10px] font-medium text-[#58a6ff] border border-[#58a6ff]/40 bg-[#58a6ff]/10 rounded px-2.5 py-1 hover:bg-[#58a6ff]/20 transition-colors"
          >
            {t.swingLink} ↗
          </Link>
        </div>
      ) : watchPick ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/70">{t.inWatchlist}</span>
            {watchPick.date_added && (
              <span className="text-[10px] text-white/40">{t.dateAdded}: {watchPick.date_added}</span>
            )}
          </div>
          <Link
            href={`/global/${locale}/watchlist`}
            className="self-start text-[10px] font-medium text-[#a78bfa] border border-[#a78bfa]/40 bg-[#a78bfa]/10 rounded px-2.5 py-1 hover:bg-[#a78bfa]/20 transition-colors"
          >
            {t.watchlistLink} ↗
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-white/60">{t.notTracked}</span>
          <span className="text-[11px] text-white/40 leading-relaxed">{t.notTrackedNote}</span>
        </div>
      )}
    </div>
  );
}
