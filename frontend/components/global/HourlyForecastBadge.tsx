"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/copy";
import Sparkline from "@/components/global/Sparkline";
import { computeHourlyForecast, nextHourBoundaryLabel, type HourlyForecast } from "@/lib/hourlyForecast";

interface Precomputed {
  forecast: HourlyForecast | null;
  closes: number[];
  failed?: boolean;
}

interface Props {
  ticker: string;
  locale: Locale;
  /** true: tek satır rozet (kategori listesi satırları). false/undefined: tam kart (grafik detay sayfası). */
  compact?: boolean;
  /** Verilirse bileşen kendi fetch'ini yapmaz — çağıran (LiveAssetTable) tüm
   * enstrümanları merkezi olarak tek seferde çekip sıralama için kullanıyor.
   * Verilmezse (GraphicDetailContent gibi tekil kullanımlar) eskisi gibi
   * bağımsız çalışır. */
  precomputed?: Precomputed | null;
}

interface Copy {
  title: string;
  bullish: string;
  bearish: string;
  neutral: string;
  confirmed: string;
  mixed: string;
  low: string;
  volumeRising: string;
  volumeFalling: string;
  volumeFlat: string;
  reasonWithPattern: (pattern: string, volumeTrend: string) => string;
  reasonNoPattern: string;
  disclaimer: string;
  loading: string;
  unavailable: string;
  strength: string;
  validUntil: (time: string) => string;
}

const COPY: Record<Locale, Copy> = {
  en: {
    title: "Hourly Direction Forecast",
    bullish: "Bullish Bias",
    bearish: "Bearish Bias",
    neutral: "Sideways / Undecided",
    confirmed: "Volume Confirmed",
    mixed: "Mixed Signals",
    low: "Low Confidence",
    volumeRising: "rising",
    volumeFalling: "falling",
    volumeFlat: "flat",
    reasonWithPattern: (pattern, vol) => `Latest 15-min candle formed a ${pattern} pattern, and volume is ${vol}.`,
    reasonNoPattern: "No clear 15-min candle pattern right now — this reading is based on volume alone.",
    disclaimer: "Simple technical read, not investment advice.",
    loading: "Analyzing the last few 15-min candles…",
    unavailable: "Forecast unavailable right now.",
    strength: "Signal strength",
    validUntil: (t) => `Valid until ${t}`,
  },
  tr: {
    title: "Saatlik Yön Tahmini",
    bullish: "Yükseliş Eğilimi",
    bearish: "Düşüş Eğilimi",
    neutral: "Yatay / Kararsız",
    confirmed: "Hacim Onaylı",
    mixed: "Karışık Sinyal",
    low: "Düşük Güven",
    volumeRising: "artıyor",
    volumeFalling: "azalıyor",
    volumeFlat: "yatay",
    reasonWithPattern: (pattern, vol) => `Son 15 dakikalık mum ${pattern} formasyonu oluşturdu, hacim ${vol}.`,
    reasonNoPattern: "Şu an net bir 15 dakikalık mum formasyonu yok — bu okuma yalnızca hacme dayanıyor.",
    disclaimer: "Basit bir teknik okumadır, yatırım tavsiyesi değildir.",
    loading: "Son 15 dakikalık mumlar analiz ediliyor…",
    unavailable: "Tahmin şu anda üretilemedi.",
    strength: "Sinyal gücü",
    validUntil: (t) => `${t}'a kadar geçerli`,
  },
  es: {
    title: "Pronóstico de Dirección por Hora",
    bullish: "Sesgo Alcista",
    bearish: "Sesgo Bajista",
    neutral: "Lateral / Indeciso",
    confirmed: "Confirmado por Volumen",
    mixed: "Señales Mixtas",
    low: "Baja Confianza",
    volumeRising: "en aumento",
    volumeFalling: "en descenso",
    volumeFlat: "estable",
    reasonWithPattern: (pattern, vol) => `La última vela de 15 min formó un patrón ${pattern}, y el volumen está ${vol}.`,
    reasonNoPattern: "No hay un patrón de vela de 15 min claro ahora mismo — esta lectura se basa solo en el volumen.",
    disclaimer: "Lectura técnica simple, no es asesoramiento de inversión.",
    loading: "Analizando las últimas velas de 15 min…",
    unavailable: "Pronóstico no disponible en este momento.",
    strength: "Fuerza de la señal",
    validUntil: (t) => `Válido hasta las ${t}`,
  },
  fr: {
    title: "Prévision de Direction Horaire",
    bullish: "Biais Haussier",
    bearish: "Biais Baissier",
    neutral: "Latéral / Indécis",
    confirmed: "Confirmé par le Volume",
    mixed: "Signaux Mixtes",
    low: "Faible Confiance",
    volumeRising: "en hausse",
    volumeFalling: "en baisse",
    volumeFlat: "stable",
    reasonWithPattern: (pattern, vol) => `La dernière bougie de 15 min a formé un motif ${pattern}, et le volume est ${vol}.`,
    reasonNoPattern: "Aucun motif de bougie de 15 min clair en ce moment — cette lecture repose uniquement sur le volume.",
    disclaimer: "Lecture technique simple, pas un conseil en investissement.",
    loading: "Analyse des dernières bougies de 15 min…",
    unavailable: "Prévision indisponible pour le moment.",
    strength: "Force du signal",
    validUntil: (t) => `Valable jusqu'à ${t}`,
  },
  pt: {
    title: "Previsão de Direção por Hora",
    bullish: "Viés de Alta",
    bearish: "Viés de Baixa",
    neutral: "Lateral / Indeciso",
    confirmed: "Confirmado pelo Volume",
    mixed: "Sinais Mistos",
    low: "Baixa Confiança",
    volumeRising: "em alta",
    volumeFalling: "em queda",
    volumeFlat: "estável",
    reasonWithPattern: (pattern, vol) => `A última vela de 15 min formou um padrão ${pattern}, e o volume está ${vol}.`,
    reasonNoPattern: "Nenhum padrão de vela de 15 min claro agora — esta leitura é baseada apenas no volume.",
    disclaimer: "Leitura técnica simples, não é aconselhamento de investimento.",
    loading: "Analisando as últimas velas de 15 min…",
    unavailable: "Previsão indisponível no momento.",
    strength: "Força do sinal",
    validUntil: (t) => `Válido até ${t}`,
  },
  id: {
    title: "Perkiraan Arah per Jam",
    bullish: "Bias Bullish",
    bearish: "Bias Bearish",
    neutral: "Sideways / Belum Jelas",
    confirmed: "Dikonfirmasi Volume",
    mixed: "Sinyal Campuran",
    low: "Keyakinan Rendah",
    volumeRising: "meningkat",
    volumeFalling: "menurun",
    volumeFlat: "stabil",
    reasonWithPattern: (pattern, vol) => `Candle 15 menit terakhir membentuk pola ${pattern}, dan volume ${vol}.`,
    reasonNoPattern: "Belum ada pola candle 15 menit yang jelas saat ini — perkiraan ini hanya berdasarkan volume.",
    disclaimer: "Pembacaan teknis sederhana, bukan nasihat investasi.",
    loading: "Menganalisis candle 15 menit terakhir…",
    unavailable: "Perkiraan belum tersedia saat ini.",
    strength: "Kekuatan sinyal",
    validUntil: (t) => `Berlaku hingga ${t}`,
  },
};

const DIRECTION_COLOR: Record<HourlyForecast["direction"], string> = {
  bullish: "#22c55e",
  bearish: "#f85149",
  neutral: "#94a3b8",
};

const DIRECTION_ARROW: Record<HourlyForecast["direction"], string> = {
  bullish: "▲",
  bearish: "▼",
  neutral: "⇄",
};

/** Yön + güç barı + kanıt (mini grafik) tek görsel birim olarak — 2026-08-20
 * geri bildirimi: "beş satırın beşinde de aynı rozet varsa hiçbiri bir şey
 * söylemiyor." Renk sadece yöne bağlı (arka plan/çerçeve rengi yok, "renk
 * enflasyonu" olmasın diye). */
function StrengthBar({ strength, color }: { strength: number; color: string }) {
  return (
    <span className="inline-block w-10 h-1 rounded-full bg-white/10 overflow-hidden align-middle">
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${strength}%`, backgroundColor: color }}
      />
    </span>
  );
}

export default function HourlyForecastBadge({ ticker, locale, compact, precomputed }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const [selfForecast, setSelfForecast] = useState<HourlyForecast | null>(null);
  const [selfCloses, setSelfCloses] = useState<number[]>([]);
  const [selfFailed, setSelfFailed] = useState(false);

  const isControlled = precomputed !== undefined;
  const forecast = isControlled ? precomputed?.forecast ?? null : selfForecast;
  const closes = isControlled ? precomputed?.closes ?? [] : selfCloses;
  const failed = isControlled ? !!precomputed?.failed : selfFailed;

  useEffect(() => {
    if (isControlled) return; // çağıran veriyi kendisi sağlıyor — bağımsız fetch atlanır
    if (!ticker) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/chart-data?ticker=${encodeURIComponent(ticker)}&timeframe=15&indicators=candlePat,obv`);
        const data = await res.json();
        if (cancelled) return;
        // /api/chart-data indikatorleri { bars, indicators: { candlePat, obv, ... }, sr } seklinde dondurur — duz degil.
        setSelfForecast(computeHourlyForecast(data?.indicators?.candlePat ?? [], data?.indicators?.obv ?? []));
        setSelfCloses((data?.bars ?? []).map((b: { close: number }) => b.close));
        setSelfFailed(false);
      } catch {
        if (!cancelled) setSelfFailed(true);
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000); // 5 dk'da bir tazele — 15dk barlarin yeni bar acmasi icin yeterli sıklık
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, isControlled]);

  if (failed) {
    return compact ? null : (
      <p className="text-xs text-white/30">{c.unavailable}</p>
    );
  }

  if (!forecast) {
    return compact ? (
      <span className="text-[10px] text-white/30">…</span>
    ) : (
      <p className="text-xs text-white/40">{c.loading}</p>
    );
  }

  const color = DIRECTION_COLOR[forecast.direction];
  const arrow = DIRECTION_ARROW[forecast.direction];
  const directionLabel = forecast.direction === "bullish" ? c.bullish : forecast.direction === "bearish" ? c.bearish : c.neutral;
  const confidenceLabel = forecast.confidence === "confirmed" ? c.confirmed : forecast.confidence === "mixed" ? c.mixed : c.low;
  const volumeLabel = forecast.volumeTrend === "rising" ? c.volumeRising : forecast.volumeTrend === "falling" ? c.volumeFalling : c.volumeFlat;
  const reason = forecast.patternName ? c.reasonWithPattern(forecast.patternName, volumeLabel) : c.reasonNoPattern;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2" title={reason}>
        <Sparkline data={closes.slice(-24)} color={color} width={32} height={14} />
        <span className="inline-flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap" style={{ color }}>
            <span>{arrow}</span>
            <span>{directionLabel}</span>
          </span>
          <StrengthBar strength={forecast.strength} color={color} />
        </span>
      </span>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0d1117] border border-[#1e2a3a] p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">{c.title}</h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
          <span>{arrow}</span>
          <span>{directionLabel}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <Sparkline data={closes.slice(-24)} color={color} width={72} height={24} />
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
            <span>{c.strength}</span>
            <span>{forecast.strength}/100</span>
          </div>
          <span className="inline-block w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${forecast.strength}%`, backgroundColor: color }}
            />
          </span>
        </div>
      </div>
      <p className="text-sm text-white/70 leading-relaxed mb-2">{reason}</p>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{confidenceLabel}</span>
        <span className="text-[10px] text-white/25">{c.validUntil(nextHourBoundaryLabel())} · {c.disclaimer}</span>
      </div>
    </div>
  );
}
