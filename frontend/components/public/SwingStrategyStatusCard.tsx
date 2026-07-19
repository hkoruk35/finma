"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

// Bu kart, /graphic/[ticker] sayfasındaki "işlem kurgusu gerekçesi"ni
// swing117_boga.py botunun GERÇEK Power Pullback çıktısıyla besler —
// TickerDetailPanel'in kendi bağımsız (Yahoo Finance'ten yeniden türetilmiş)
// teknik analiz motorundan farklı olarak, burada gösterilen her satır
// doğrudan botun ürettiği JSON alanlarından (entry_status, detail_reasoning,
// factor_scores, selection_reasons, trigger_15m) geliyor. Böylece hisse şu an
// botun aktif 10-swing/10-watchlist havuzundaysa, sayfadaki gerekçe metni
// botun stratejisiyle birebir uyumlu olur.

// detail_reasoning bot tarafından TEK dilde (Türkçe) üretilip JSON'a yazılır
// (ai_summary'nin aksine çok-dilli bir obje değil) — sabit sayıda şablondan
// biri olduğu için (bkz. swing117_boga.py'deki layer4_entry_trigger_15m_hybrid
// + eski V3 yedeğindeki "Hacimli Kırılım" tetiği, hâlâ 2026-07-17'den önce
// girmiş pozisyonlarda donmuş halde duruyor) regex ile tanıyıp hedef dilde
// yeniden kuruyoruz. Bilinmeyen/eşleşmeyen bir metin gelirse olduğu gibi
// (Türkçe) gösterilir — hiçbir zaman veri kaybı/hata olmaz, sadece çeviri
// atlanır.
type ReasoningLang = "tr" | "en" | "es" | "fr" | "pt";

const REASONING_RULES: { re: RegExp; build: (m: RegExpMatchArray, l: ReasoningLang) => string }[] = [
  // V4.0: "Breakout tetiği yakalandı: Hacimli kırılım (1.8x) > direnç ($123.45)"
  {
    re: /^Breakout tetiği yakalandı: Hacimli kırılım \(([\d.]+)x\) > direnç \(\$([\d.]+)\)$/,
    build: ([, rvol, level], l) => ({
      tr: `Breakout tetiği yakalandı: Hacimli kırılım (${rvol}x) > direnç ($${level})`,
      en: `Breakout trigger captured: high-volume breakout (${rvol}x) > resistance ($${level})`,
      es: `Disparador de ruptura capturado: ruptura con alto volumen (${rvol}x) > resistencia ($${level})`,
      fr: `Déclencheur de cassure capturé : cassure à fort volume (${rvol}x) > résistance (${level}$)`,
      pt: `Gatilho de rompimento capturado: rompimento com alto volume (${rvol}x) > resistência ($${level})`,
    }[l]),
  },
  // V4.0: "Spring bounce tetiği yakalandı: RSI:32.1 + MACD yön yukarı"
  {
    re: /^Spring bounce tetiği yakalandı: RSI:([\d.]+) \+ MACD yön yukarı$/,
    build: ([, rsi], l) => ({
      tr: `Spring bounce tetiği yakalandı: RSI:${rsi} + MACD yön yukarı`,
      en: `Spring bounce trigger captured: RSI:${rsi} + MACD turning up`,
      es: `Disparador de rebote (spring) capturado: RSI:${rsi} + MACD girando al alza`,
      fr: `Déclencheur de rebond (spring) capturé : RSI :${rsi} + MACD orienté à la hausse`,
      pt: `Gatilho de repique (spring) capturado: RSI:${rsi} + MACD virando para cima`,
    }[l]),
  },
  // V4.0: "EMA Cross tetiği yakalandı: 15m grafik üzerinde EMA9/20 Golden Cross" (statik, sayı yok)
  {
    re: /^EMA Cross tetiği yakalandı: 15m grafik üzerinde EMA9\/20 Golden Cross$/,
    build: (_m, l) => ({
      tr: `EMA Cross tetiği yakalandı: 15m grafik üzerinde EMA9/20 Golden Cross`,
      en: `EMA Cross trigger captured: EMA9/20 Golden Cross on the 15m chart`,
      es: `Disparador de cruce de EMA capturado: Golden Cross EMA9/20 en el gráfico de 15m`,
      fr: `Déclencheur de croisement d'EMA capturé : Golden Cross EMA9/20 sur le graphique 15m`,
      pt: `Gatilho de cruzamento de EMA capturado: Golden Cross EMA9/20 no gráfico de 15m`,
    }[l]),
  },
  // V4.0: "Power Pullback (5 mum) tetiklendi. RSI reset (42). Hacim 1.6x"
  {
    re: /^Power Pullback \((\d+) mum\) tetiklendi\. RSI reset \((\d+)\)\. Hacim ([\d.]+)x$/,
    build: ([, n, rsi, rvol], l) => ({
      tr: `Power Pullback (${n} mum) tetiklendi. RSI reset (${rsi}). Hacim ${rvol}x`,
      en: `Power Pullback (${n} candles) triggered. RSI reset (${rsi}). Volume ${rvol}x`,
      es: `Power Pullback (${n} velas) activado. RSI reiniciado (${rsi}). Volumen ${rvol}x`,
      fr: `Power Pullback (${n} bougies) déclenché. RSI réinitialisé (${rsi}). Volume ${rvol}x`,
      pt: `Power Pullback (${n} candles) acionado. RSI resetado (${rsi}). Volume ${rvol}x`,
    }[l]),
  },
  // Eski V3: "Hacimli Kırılım (Volume Breakout) yakalandı: Güçlü yükseliş hacmi (8.8x) + Fiyat kırılımı ($399.90 > son 4 mum yüksekliği)"
  {
    re: /^Hacimli Kırılım \(Volume Breakout\) yakalandı: Güçlü yükseliş hacmi \(([\d.]+)x\) \+ Fiyat kırılımı \(\$([\d.]+) > son 4 mum yüksekliği\)$/,
    build: ([, rvol, price], l) => ({
      tr: `Hacimli Kırılım (Volume Breakout) yakalandı: Güçlü yükseliş hacmi (${rvol}x) + Fiyat kırılımı ($${price} > son 4 mum yüksekliği)`,
      en: `Volume Breakout captured: strong bullish volume (${rvol}x) + price breakout ($${price} > last 4-candle high)`,
      es: `Ruptura por volumen capturada: volumen alcista fuerte (${rvol}x) + ruptura de precio ($${price} > máximo de las últimas 4 velas)`,
      fr: `Cassure sur volume capturée : fort volume haussier (${rvol}x) + cassure de prix (${price}$ > plus haut des 4 dernières bougies)`,
      pt: `Rompimento por volume capturado: forte volume de alta (${rvol}x) + rompimento de preço ($${price} > máxima das últimas 4 velas)`,
    }[l]),
  },
  // Eski V3: "Power Pullback tetiklendi: 5 mum + EMA20 teması + RSI reset (42) + BULLISH_ENGULFING + Hacim 1.6x"
  {
    re: /^Power Pullback tetiklendi: (\d+) mum \+ EMA20 teması \+ RSI reset \((\d+)\) \+ (\S+) \+ Hacim ([\d.]+)x$/,
    build: ([, n, rsi, trigType, rvol], l) => ({
      tr: `Power Pullback tetiklendi: ${n} mum + EMA20 teması + RSI reset (${rsi}) + ${trigType} + Hacim ${rvol}x`,
      en: `Power Pullback triggered: ${n} candles + EMA20 touch + RSI reset (${rsi}) + ${trigType} + Volume ${rvol}x`,
      es: `Power Pullback activado: ${n} velas + contacto con EMA20 + RSI reiniciado (${rsi}) + ${trigType} + Volumen ${rvol}x`,
      fr: `Power Pullback déclenché : ${n} bougies + contact EMA20 + RSI réinitialisé (${rsi}) + ${trigType} + Volume ${rvol}x`,
      pt: `Power Pullback acionado: ${n} candles + toque na EMA20 + RSI resetado (${rsi}) + ${trigType} + Volume ${rvol}x`,
    }[l]),
  },
  // V4.0 genel yedek: "Algoritmik teknik kriterler ve momentum analizi sonucunda seçilmiştir."
  {
    re: /^Algoritmik teknik kriterler ve momentum analizi sonucunda seçilmiştir\.$/,
    build: (_m, l) => ({
      tr: `Algoritmik teknik kriterler ve momentum analizi sonucunda seçilmiştir.`,
      en: `Selected based on algorithmic technical criteria and momentum analysis.`,
      es: `Seleccionado según criterios técnicos algorítmicos y análisis de momentum.`,
      fr: `Sélectionné sur la base de critères techniques algorithmiques et d'une analyse du momentum.`,
      pt: `Selecionado com base em critérios técnicos algorítmicos e análise de momentum.`,
    }[l]),
  },
  // Eski V3 genel yedek: "Power Pullback (1D+4H+1H+15m hizalaması) sonucunda seçilmiştir."
  {
    re: /^Power Pullback \(1D\+4H\+1H\+15m hizalaması\) sonucunda seçilmiştir\.$/,
    build: (_m, l) => ({
      tr: `Power Pullback (1D+4H+1H+15m hizalaması) sonucunda seçilmiştir.`,
      en: `Selected based on Power Pullback alignment (1D+4H+1H+15m).`,
      es: `Seleccionado según la alineación Power Pullback (1D+4H+1H+15m).`,
      fr: `Sélectionné sur la base de l'alignement Power Pullback (1D+4H+1H+15m).`,
      pt: `Selecionado com base no alinhamento Power Pullback (1D+4H+1H+15m).`,
    }[l]),
  },
];

function translateDetailReasoning(text: string, locale: Locale): string {
  const l: ReasoningLang = (["tr", "en", "es", "fr", "pt"] as const).includes(locale as ReasoningLang)
    ? (locale as ReasoningLang)
    : "en";
  if (l === "tr") return text;
  for (const rule of REASONING_RULES) {
    const m = text.match(rule.re);
    if (m) return rule.build(m, l);
  }
  return text; // bilinmeyen kalıp — veri kaybı olmasın diye olduğu gibi göster
}

interface SwingPick {
  ticker: string;
  entry_status?: "PENDING" | "ENTERED";
  entry_zone?: { low: number; high: number } | null;
  date_added?: string;
  system_label?: { text: string; color: string };
  detail_reasoning?: string;
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
    title: "BOGA AI Swing Strateji Durumu",
    pendingMessage: "Bu hisse BOGA AI'nin aktif Swing (Power Pullback) havuzunda — teknik olarak alınabilir bölgede. Daha yüksek kârlılık için hassas giriş noktasının (15 dakikalık tetik) oluşması bekleniyor.",
    enteredMessage: "Bu hisse BOGA AI'nin aktif Swing (Power Pullback) havuzunda ve hassas giriş noktası (15 dakikalık tetik) yakalandı.",
    inWatchlist: "Bu hisse şu an Watchlist havuzunda izleniyor — henüz Swing adayı değil",
    notTracked: "Bu hisse şu an BOGA AI'nin aktif tarama havuzunda değil",
    notTrackedNote: "BOGA AI tüm ABD borsasını anlık taramaya devam ediyor — bu hisse Power Pullback kriterlerini (1D trend + 4H kalite + 1H momentum + 15m giriş tetiği) karşıladığında havuza otomatik girer.",
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
    swingLink: "Swing Sayfasında Gör",
    watchlistLink: "Watchlist Sayfasında Gör",
  },
  en: {
    title: "BOGA AI Swing Strategy Status",
    pendingMessage: "This stock is in BOGA AI's active Swing (Power Pullback) pool — technically in a buyable zone. A precise entry point (15-minute trigger) is awaited for higher profitability.",
    enteredMessage: "This stock is in BOGA AI's active Swing (Power Pullback) pool and the precise entry point (15-minute trigger) has been captured.",
    inWatchlist: "This stock is currently being tracked in the Watchlist pool — not yet a Swing candidate",
    notTracked: "This stock is not currently in BOGA AI's active scan pool",
    notTrackedNote: "BOGA AI continuously scans the entire U.S. stock market — this stock will automatically enter the pool once it meets the Power Pullback criteria (1D trend + 4H quality + 1H momentum + 15m entry trigger).",
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
    swingLink: "View on Swing Page",
    watchlistLink: "View on Watchlist Page",
  },
  es: {
    title: "Estado de Estrategia Swing de BOGA AI",
    pendingMessage: "Esta acción está en el pool activo de Swing (Power Pullback) de BOGA AI — técnicamente en una zona comprable. Se espera un punto de entrada preciso (gatillo de 15 minutos) para mayor rentabilidad.",
    enteredMessage: "Esta acción está en el pool activo de Swing (Power Pullback) de BOGA AI y se ha capturado el punto de entrada preciso (gatillo de 15 minutos).",
    inWatchlist: "Esta acción está siendo seguida en el pool de Watchlist — aún no es candidata de Swing",
    notTracked: "Esta acción no está actualmente en el pool de escaneo activo de BOGA AI",
    notTrackedNote: "BOGA AI escanea continuamente todo el mercado de EE. UU. — esta acción entrará automáticamente al pool cuando cumpla los criterios de Power Pullback (tendencia 1D + calidad 4H + momentum 1H + gatillo de entrada 15m).",
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
    swingLink: "Ver en Página Swing",
    watchlistLink: "Ver en Página Watchlist",
  },
  fr: {
    title: "Statut de la Stratégie Swing BOGA AI",
    pendingMessage: "Cette action est dans le pool Swing actif (Power Pullback) de BOGA AI — techniquement dans une zone d'achat. Un point d'entrée précis (déclencheur de 15 minutes) est attendu pour une rentabilité plus élevée.",
    enteredMessage: "Cette action est dans le pool Swing actif (Power Pullback) de BOGA AI et le point d'entrée précis (déclencheur de 15 minutes) a été capturé.",
    inWatchlist: "Cette action est actuellement suivie dans le pool Watchlist — pas encore candidate Swing",
    notTracked: "Cette action n'est pas actuellement dans le pool de scan actif de BOGA AI",
    notTrackedNote: "BOGA AI scanne en continu l'ensemble du marché américain — cette action entrera automatiquement dans le pool dès qu'elle remplira les critères Power Pullback (tendance 1D + qualité 4H + momentum 1H + déclencheur d'entrée 15m).",
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
    swingLink: "Voir sur la Page Swing",
    watchlistLink: "Voir sur la Page Watchlist",
  },
  pt: {
    title: "Status da Estratégia Swing da BOGA AI",
    pendingMessage: "Esta ação está no pool ativo de Swing (Power Pullback) da BOGA AI — tecnicamente em uma zona de compra. Um ponto de entrada preciso (gatilho de 15 minutos) é aguardado para maior lucratividade.",
    enteredMessage: "Esta ação está no pool ativo de Swing (Power Pullback) da BOGA AI e o ponto de entrada preciso (gatilho de 15 minutos) foi capturado.",
    inWatchlist: "Esta ação está sendo monitorada no pool de Watchlist — ainda não é candidata a Swing",
    notTracked: "Esta ação não está atualmente no pool de varredura ativo da BOGA AI",
    notTrackedNote: "A BOGA AI varre continuamente todo o mercado dos EUA — esta ação entrará automaticamente no pool quando atender aos critérios do Power Pullback (tendência 1D + qualidade 4H + momentum 1H + gatilho de entrada 15m).",
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
    swingLink: "Ver na Página Swing",
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

  const factors = swingPick?.factor_scores;

  return (
    <div className="glass-card overflow-hidden mb-4 bg-[#111620] border border-[#253347] rounded-lg p-3.5">
      <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">
        {t.title}
      </div>

      {swingPick ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded"
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
              {t.entryZone}: ${swingPick.entry_zone.low.toFixed(2)} – ${swingPick.entry_zone.high.toFixed(2)}
            </div>
          )}

          {swingPick.detail_reasoning && (
            <p className="text-xs text-white/70 leading-relaxed">
              <span className="text-[#58a6ff] font-bold">{t.reasonLabel}:</span> {translateDetailReasoning(swingPick.detail_reasoning, locale)}
            </p>
          )}

          <div>
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1.5">{t.layers}</div>
            <div className="flex flex-wrap gap-1.5">
              {["1D_Trend", "4H_Quality", "1H_Momentum"].map((key, i) => {
                const label = [t.layer1, t.layer2, t.layer3][i];
                const passed = swingPick.selection_reasons?.includes(key);
                return (
                  <span
                    key={key}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      passed ? "text-green-400 border-green-700/50 bg-green-900/20" : "text-white/30 border-[#253347]"
                    }`}
                  >
                    {passed ? "✓" : "○"} {label}
                  </span>
                );
              })}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  swingPick.entry_status === "ENTERED"
                    ? "text-green-400 border-green-700/50 bg-green-900/20"
                    : "text-amber-400 border-amber-700/50 bg-amber-900/10"
                }`}
              >
                {swingPick.entry_status === "ENTERED" ? `✓ ${t.layer4Entered}` : `◑ ${t.layer4Pending}`}
              </span>
            </div>
          </div>

          {factors && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1">
              {[
                [t.factorTrend, factors.trend_score],
                [t.factorMomentum, factors.momentum_score],
                [t.factorVolatility, factors.volatility_score],
                [t.factorVolume, factors.volume_score],
                [t.factorSector, factors.catalyst_score],
              ].map(([label, val]) => (
                <div key={label as string} className="text-center">
                  <div className="text-[9px] text-white/40 uppercase tracking-wide leading-tight mb-0.5">{label}</div>
                  <div className="text-xs font-mono font-bold text-white/80">{typeof val === "number" ? val.toFixed(1) : "—"}</div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-amber-300/90 leading-relaxed border-t border-[#253347] pt-2.5">
            {t.tradePlanNote}
          </p>

          <Link
            href={`/global/${locale}/swing`}
            className="self-start text-[10px] font-bold text-[#58a6ff] border border-[#58a6ff]/40 bg-[#58a6ff]/10 rounded px-2.5 py-1 hover:bg-[#58a6ff]/20 transition-colors"
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
            className="self-start text-[10px] font-bold text-[#a78bfa] border border-[#a78bfa]/40 bg-[#a78bfa]/10 rounded px-2.5 py-1 hover:bg-[#a78bfa]/20 transition-colors"
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
