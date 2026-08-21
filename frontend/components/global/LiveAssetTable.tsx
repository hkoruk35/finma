"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import type { AssetInstrument, AssetClassLocale } from "@/lib/assetClasses";
import { formatAssetPrice } from "@/lib/symbols";
import { computeHourlyForecast, compute1hChangePct, displayDirection, type HourlyForecast } from "@/lib/hourlyForecast";
import { formatRelativeUpdate } from "@/lib/relativeTime";
import { localeUpperCase } from "@/lib/localeCase";
import HourlyForecastBadge from "@/components/global/HourlyForecastBadge";
import Sparkline from "@/components/global/Sparkline";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

interface QuoteResult {
  price: number | null;
  change_1d: number | null;
}

interface ForecastEntry {
  forecast: HourlyForecast | null;
  closes: number[];
  change1h: number | null;
  failed?: boolean;
}

type SortBy = "strength" | "change" | "volume";
type RangeTab = "24h" | "7d" | "30d";

const RANGE_CONFIG: Record<RangeTab, { timeframe: string; windowDays: number }> = {
  "24h": { timeframe: "15", windowDays: 1 },
  "7d": { timeframe: "60", windowDays: 7 },
  "30d": { timeframe: "D", windowDays: 30 },
};

interface Copy {
  instrument: string;
  price: string;
  change: string;
  change1h: string;
  chart: string;
  forecast: string;
  sortLabel: string;
  sortStrength: string;
  sortChange: string;
  sortVolume: string;
  rangeLabels: Record<RangeTab, string>;
  openFull: string;
  riskOn: string;
  riskOff: string;
  riskMixed: string;
  /** Gerçek eşik-tabanlı sayım — "8/8 yukarı" gibi ham sayıya bakmadan
   * displayDirection() eşiğinden geçenleri sayar (bkz. lib/hourlyForecast.ts).
   * 2026-08-20 kullanıcı geri bildirimi: özet başlık tablo verisiyle
   * çelişmemeli. */
  tripleCount: (up: number, down: number, neutral: number) => string;
  /** Gerçek, biriktirilen (resolve-on-visit) isabet oranı — bkz.
   * app/api/forecast-accuracy. sampleSize yeterince büyümeden gösterilmez. */
  accuracyLabel: (pct: number, n: number) => string;
  updatedPrefix: string;
}

const COPY: Record<Locale, Copy> = {
  en: {
    instrument: "Instrument", price: "Price", change: "24h", change1h: "1h", chart: "Chart", forecast: "Hourly Forecast",
    sortLabel: "Sort:", sortStrength: "Signal Strength", sortChange: "Change", sortVolume: "Volume Trend",
    rangeLabels: { "24h": "24h", "7d": "7d", "30d": "30d" },
    openFull: "Open full chart ↗",
    riskOn: "Risk-On", riskOff: "Risk-Off", riskMixed: "Mixed Outlook",
    tripleCount: (up, down, neutral) => `${up} up · ${down} down · ${neutral} flat`,
    accuracyLabel: (pct, n) => `${pct}% of the last 30h forecasts hit · ${n} forecasts`,
    updatedPrefix: "Updated",
  },
  tr: {
    instrument: "Enstrüman", price: "Fiyat", change: "24s", change1h: "1s", chart: "Grafik", forecast: "Saatlik Tahmin",
    sortLabel: "Sırala:", sortStrength: "Sinyal Gücü", sortChange: "Değişim", sortVolume: "Hacim Eğilimi",
    rangeLabels: { "24h": "24s", "7d": "7g", "30d": "30g" },
    openFull: "Tam grafikte aç ↗",
    riskOn: "Risk İştahı Açık", riskOff: "Risk İştahı Kapalı", riskMixed: "Karışık Görünüm",
    tripleCount: (up, down, neutral) => `${up} yukarı · ${down} aşağı · ${neutral} yönsüz`,
    accuracyLabel: (pct, n) => `Son 30 saatlik tahminlerin %${pct}'i tuttu · ${n} tahmin`,
    updatedPrefix: "Güncellendi",
  },
  es: {
    instrument: "Instrumento", price: "Precio", change: "24h", change1h: "1h", chart: "Gráfico", forecast: "Pronóstico Horario",
    sortLabel: "Ordenar:", sortStrength: "Fuerza de Señal", sortChange: "Cambio", sortVolume: "Tendencia de Volumen",
    rangeLabels: { "24h": "24h", "7d": "7d", "30d": "30d" },
    openFull: "Abrir gráfico completo ↗",
    riskOn: "Apetito de Riesgo Alto", riskOff: "Apetito de Riesgo Bajo", riskMixed: "Panorama Mixto",
    tripleCount: (up, down, neutral) => `${up} al alza · ${down} a la baja · ${neutral} lateral`,
    accuracyLabel: (pct, n) => `El ${pct}% de los pronósticos de las últimas 30h acertó · ${n} pronósticos`,
    updatedPrefix: "Actualizado",
  },
  fr: {
    instrument: "Instrument", price: "Prix", change: "24h", change1h: "1h", chart: "Graphique", forecast: "Prévision Horaire",
    sortLabel: "Trier :", sortStrength: "Force du Signal", sortChange: "Variation", sortVolume: "Tendance du Volume",
    rangeLabels: { "24h": "24h", "7d": "7j", "30d": "30j" },
    openFull: "Ouvrir le graphique complet ↗",
    riskOn: "Appétit pour le Risque", riskOff: "Aversion au Risque", riskMixed: "Perspective Mixte",
    tripleCount: (up, down, neutral) => `${up} en hausse · ${down} en baisse · ${neutral} stables`,
    accuracyLabel: (pct, n) => `${pct}% des prévisions des dernières 30h se sont réalisées · ${n} prévisions`,
    updatedPrefix: "Mis à jour",
  },
  pt: {
    instrument: "Instrumento", price: "Preço", change: "24h", change1h: "1h", chart: "Gráfico", forecast: "Previsão por Hora",
    sortLabel: "Ordenar:", sortStrength: "Força do Sinal", sortChange: "Variação", sortVolume: "Tendência de Volume",
    rangeLabels: { "24h": "24h", "7d": "7d", "30d": "30d" },
    openFull: "Abrir gráfico completo ↗",
    riskOn: "Apetite por Risco Alto", riskOff: "Apetite por Risco Baixo", riskMixed: "Panorama Misto",
    tripleCount: (up, down, neutral) => `${up} em alta · ${down} em baixa · ${neutral} estáveis`,
    accuracyLabel: (pct, n) => `${pct}% das previsões das últimas 30h acertaram · ${n} previsões`,
    updatedPrefix: "Atualizado",
  },
  id: {
    instrument: "Instrumen", price: "Harga", change: "24j", change1h: "1j", chart: "Grafik", forecast: "Perkiraan per Jam",
    sortLabel: "Urutkan:", sortStrength: "Kekuatan Sinyal", sortChange: "Perubahan", sortVolume: "Tren Volume",
    rangeLabels: { "24h": "24j", "7d": "7h", "30d": "30h" },
    openFull: "Buka grafik lengkap ↗",
    riskOn: "Selera Risiko Tinggi", riskOff: "Selera Risiko Rendah", riskMixed: "Pandangan Campuran",
    tripleCount: (up, down, neutral) => `${up} naik · ${down} turun · ${neutral} datar`,
    accuracyLabel: (pct, n) => `${pct}% perkiraan 30 jam terakhir tepat · ${n} perkiraan`,
    updatedPrefix: "Diperbarui",
  },
};

function fmtChange(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// 1 saatlik değişim çoğu zaman |değer| < %0,05 gibi ondalık gürültü —
// "+0,01%" gibi bir sayı hiçbir şey söylemiyor. 2026-08-20 kullanıcı
// geri bildirimi: bu durumda "—" bas (ya da baz puana çevir; burada
// bastırmayı seçtik — sütun zaten çok dar, "bp" eki daha da sıkışırdı).
const CHANGE_1H_NOISE_THRESHOLD = 0.05;

function isChange1hNoise(v: number | null | undefined): boolean {
  return v != null && Math.abs(v) < CHANGE_1H_NOISE_THRESHOLD;
}

function fmtChange1h(v: number | null | undefined) {
  if (v == null || isChange1hNoise(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function LiveAssetTable({
  instruments,
  locale,
}: {
  instruments: AssetInstrument[];
  locale: Locale;
}) {
  const c = COPY[locale] ?? COPY.en;
  const assetLocale = locale as AssetClassLocale;
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({});
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});
  const [sortBy, setSortBy] = useState<SortBy>("strength");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [rangeTab, setRangeTab] = useState<RangeTab>("24h");
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<{ hitRate: number | null; sampleSize: number } | null>(null);
  const [, forceTick] = useState(0);

  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // "11dk önce" etiketinin canlı kalması için — yeni veri gelmese de periyodik yeniden çizim.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fiyat/degisim — 30 sn'de bir, ayni zamanda fiyat flash'ini ve "son guncelleme" damgasini tetikler ──
  useEffect(() => {
    const tickers = instruments.map((i) => i.ticker).join(",");
    if (!tickers) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/quote?tickers=${encodeURIComponent(tickers)}`);
        const data: Record<string, QuoteResult> = await res.json();
        if (cancelled || !data) return;

        const changedTickers: { ticker: string; dir: "up" | "down" }[] = [];
        for (const inst of instruments) {
          const newPrice = data[inst.ticker]?.price;
          const oldPrice = prevPricesRef.current[inst.ticker];
          if (typeof newPrice === "number" && typeof oldPrice === "number" && newPrice !== oldPrice) {
            changedTickers.push({ ticker: inst.ticker, dir: newPrice > oldPrice ? "up" : "down" });
          }
          if (typeof newPrice === "number") prevPricesRef.current[inst.ticker] = newPrice;
        }

        setQuotes(data);
        setLastUpdatedMs(Date.now());

        if (changedTickers.length) {
          setFlash((prev) => {
            const next = { ...prev };
            changedTickers.forEach(({ ticker, dir }) => { next[ticker] = dir; });
            return next;
          });
          changedTickers.forEach(({ ticker }) => {
            clearTimeout(flashTimeoutsRef.current[ticker]);
            flashTimeoutsRef.current[ticker] = setTimeout(() => {
              setFlash((prev) => ({ ...prev, [ticker]: null }));
            }, 500);
          });
        }
      } catch {
        // sessizce yut — bir sonraki polling denemesi kurtaracak
      }
    }

    load();
    const interval = setInterval(load, 30 * 1000); // 30 sn — "7/24 canli" hissi icin yeterince sik, Yahoo'yu bogmayacak kadar seyrek
    return () => {
      cancelled = true;
      clearInterval(interval);
      Object.values(flashTimeoutsRef.current).forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments]);

  // ── Saatlik tahmin + 1s değişim — tum enstrumanlar icin merkezi olarak
  // cekilir (ayni /api/chart-data cevabindaki bars'tan 1s degisim de
  // turetilir, ekstra istek gerekmez), hem rozette hem siralamada
  // kullanilir. 5 dk'da bir tazelenir. ──
  useEffect(() => {
    let cancelled = false;

    async function loadForecasts() {
      const entries = await Promise.all(
        instruments.map(async (inst) => {
          try {
            const res = await fetch(
              `/api/chart-data?ticker=${encodeURIComponent(inst.ticker)}&timeframe=15&indicators=candlePat,obv`
            );
            const data = await res.json();
            const forecast = computeHourlyForecast(data?.indicators?.candlePat ?? [], data?.indicators?.obv ?? []);
            const closes: number[] = (data?.bars ?? []).map((b: { close: number }) => b.close);
            const change1h = compute1hChangePct(closes);

            // Isabet-oranı takibi (resolve-on-visit, cron yok) — sadece
            // yönlü (yönsüz olmayan) tahminler için, bilinen bir güncel
            // fiyatla birlikte. Sonucu beklenmiyor/yutuluyor: başarısız
            // olursa tabloyu etkilemesin. bkz. app/api/forecast-accuracy.
            const shownDir = displayDirection(forecast);
            const currentPrice = prevPricesRef.current[inst.ticker];
            if (shownDir !== "neutral" && typeof currentPrice === "number") {
              fetch("/api/forecast-accuracy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ticker: inst.ticker,
                  direction: shownDir,
                  strength: forecast.strength,
                  price: currentPrice,
                }),
              }).catch(() => {});
            }

            return [inst.ticker, { forecast, closes, change1h, failed: false }] as const;
          } catch {
            return [inst.ticker, { forecast: null, closes: [], change1h: null, failed: true }] as const;
          }
        })
      );
      if (cancelled) return;
      setForecasts(Object.fromEntries(entries));
    }

    loadForecasts();
    const interval = setInterval(loadForecasts, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments]);

  // ── Gerçek, biriktirilen isabet oranı — sayfa/enstrüman bağımsız, site
  // genelinde tek bir havuzdan (bkz. app/api/forecast-accuracy GET). ──
  useEffect(() => {
    let cancelled = false;

    async function loadAccuracy() {
      try {
        const res = await fetch("/api/forecast-accuracy");
        const data = await res.json();
        if (!cancelled) setAccuracy(data);
      } catch {
        // sessizce yut — satır zaten yeterli örnek olmadan gösterilmiyor
      }
    }

    loadAccuracy();
    const interval = setInterval(loadAccuracy, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const sortedInstruments = useMemo(() => {
    const arr = [...instruments];
    arr.sort((a, b) => {
      if (sortBy === "change") {
        const ca = quotes[a.ticker]?.change_1d ?? -Infinity;
        const cb = quotes[b.ticker]?.change_1d ?? -Infinity;
        return cb - ca;
      }
      if (sortBy === "volume") {
        const va = forecasts[a.ticker]?.forecast?.volumeMagnitudePct ?? -Infinity;
        const vb = forecasts[b.ticker]?.forecast?.volumeMagnitudePct ?? -Infinity;
        return vb - va;
      }
      const sa = forecasts[a.ticker]?.forecast?.strength ?? -Infinity;
      const sb = forecasts[b.ticker]?.forecast?.strength ?? -Infinity;
      return sb - sa;
    });
    return arr;
  }, [instruments, sortBy, quotes, forecasts]);

  // Ham forecast.direction DEĞİL — displayDirection() eşiği (bkz.
  // lib/hourlyForecast.ts NEUTRAL_THRESHOLD). 2026-08-20 kritik geri
  // bildirim: özet çubuğu "8/8 yukarı" derken tablo gerçek negatif
  // hareketler gösteriyordu — başlık kendi verisiyle çelişiyordu. Artık
  // sayım da eşiğe göre, tablonun kendisiyle aynı kaynaktan.
  const { bullishCount, bearishCount, neutralCount, haveForecasts } = useMemo(() => {
    let bull = 0, bear = 0, neutral = 0, have = 0;
    for (const inst of instruments) {
      const forecast = forecasts[inst.ticker]?.forecast;
      if (!forecast) continue;
      have++;
      const dir = displayDirection(forecast);
      if (dir === "bullish") bull++;
      else if (dir === "bearish") bear++;
      else neutral++;
    }
    return { bullishCount: bull, bearishCount: bear, neutralCount: neutral, haveForecasts: have };
  }, [instruments, forecasts]);

  const sentiment = bearishCount > bullishCount ? "off" : bullishCount > bearishCount ? "on" : "mixed";
  const sentimentColor = sentiment === "on" ? "#22c55e" : sentiment === "off" ? "#f85149" : "#94a3b8";
  const sentimentLabel = sentiment === "on" ? c.riskOn : sentiment === "off" ? c.riskOff : c.riskMixed;
  const { relative, clock } = formatRelativeUpdate(lastUpdatedMs, locale);

  // Sahte sayı basmamak için minimum örneklem — bkz. app/api/forecast-accuracy.
  const MIN_ACCURACY_SAMPLE = 5;
  const showAccuracy = !!accuracy && accuracy.hitRate != null && accuracy.sampleSize >= MIN_ACCURACY_SAMPLE;

  function toggleExpand(ticker: string) {
    if (expandedTicker === ticker) {
      setExpandedTicker(null);
    } else {
      setExpandedTicker(ticker);
      setRangeTab("24h");
    }
  }

  return (
    <div>
      {/* Ozet cubuk — genel egilim + son guncelleme zamani, tek bakista */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 mb-2 rounded-xl bg-[#0d131f] border border-[#1e2a3a]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: sentimentColor }} />
          <span className="text-xs font-semibold" style={{ color: sentimentColor }}>{sentimentLabel}</span>
          {haveForecasts > 0 && (
            <span className="text-xs text-white/40">· {c.tripleCount(bullishCount, bearishCount, neutralCount)}</span>
          )}
        </div>
        <span className="text-[10px] text-white/30 tabular-nums">
          {c.updatedPrefix} {relative}{clock ? ` · ${clock}` : ""}
        </span>
      </div>

      {/* Sıralama kontrolü — varsayılan: en güçlü sinyalden en zayıfa (bkz. lib/hourlyForecast.ts) */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] font-bold tracking-wider text-white/40">{localeUpperCase(c.sortLabel, locale)}</span>
        <div className="flex gap-1">
          {([
            ["strength", c.sortStrength],
            ["change", c.sortChange],
            ["volume", c.sortVolume],
          ] as [SortBy, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                sortBy === key
                  ? "bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/40"
                  : "bg-transparent text-white/40 border border-transparent hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden">
        {/* Header row — sadece masaüstünde */}
        <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_0.9fr_1.2fr_auto] gap-3 px-5 py-2.5 bg-[#0d131f] text-[10px] font-bold tracking-wider text-white/40">
          <span>{localeUpperCase(c.instrument, locale)}</span>
          <span className="text-right">{localeUpperCase(c.price, locale)}</span>
          <span className="text-right">{localeUpperCase(c.change, locale)}</span>
          <span className="text-right">{localeUpperCase(c.change1h, locale)}</span>
          <span>{localeUpperCase(c.chart, locale)}</span>
          <span>{localeUpperCase(c.forecast, locale)}</span>
          <span />
        </div>

        <div className="divide-y divide-[#1e2a3a]">
          {sortedInstruments.map((inst) => {
            const q = quotes[inst.ticker];
            const positive = (q?.change_1d ?? 0) >= 0;
            const priceLabel = q?.price != null ? formatAssetPrice(q.price, inst.ticker, locale) : "—";
            const flashDir = flash[inst.ticker];
            const isExpanded = expandedTicker === inst.ticker;
            const fc = forecasts[inst.ticker];
            const range = RANGE_CONFIG[rangeTab];
            // Sparkline rengi de GÖSTERİLEN yöne göre (displayDirection) —
            // ham model yönüne göre boyarsak düşük güvenli/yönsüz bir
            // tahmin yeşil/kırmızı gösterip yanıltabilir.
            const shownDir = fc?.forecast ? displayDirection(fc.forecast) : null;
            const sparkColor = shownDir === "bullish" ? "#22c55e" : shownDir === "bearish" ? "#f85149" : "#64748b";
            const change1hNoise = isChange1hNoise(fc?.change1h);
            const change1hPositive = (fc?.change1h ?? 0) >= 0;

            return (
              <div key={inst.ticker} className="bg-[#0a0e17]">
                <button
                  type="button"
                  onClick={() => toggleExpand(inst.ticker)}
                  className="w-full grid grid-cols-[1.4fr_auto_auto] md:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_0.9fr_1.2fr_auto] gap-2 md:gap-3 items-center px-4 md:px-5 py-3 md:py-3.5 hover:bg-[#111826] transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-white truncate">{inst.names[assetLocale] ?? inst.ticker}</span>
                  <span
                    className={`text-sm font-mono text-white text-right rounded px-1.5 -mx-1.5 transition-colors duration-300 ${
                      flashDir === "up" ? "bg-[#22c55e]/25" : flashDir === "down" ? "bg-[#f85149]/25" : "bg-transparent"
                    }`}
                  >
                    {priceLabel}
                  </span>
                  <span className={`hidden md:inline text-sm font-mono font-semibold text-right ${positive ? "!text-[#3fb950]" : "!text-[#f85149]"}`}>
                    {fmtChange(q?.change_1d)}
                  </span>
                  <span className={`hidden md:inline text-sm font-mono font-semibold text-right ${change1hNoise ? "!text-white/30" : change1hPositive ? "!text-[#3fb950]" : "!text-[#f85149]"}`}>
                    {fmtChange1h(fc?.change1h)}
                  </span>
                  <span className="hidden md:flex items-center">
                    {fc?.closes?.length ? (
                      <Sparkline data={fc.closes.slice(-24)} color={sparkColor} width={64} height={24} fillOpacity={0.12} />
                    ) : (
                      <span className="text-[10px] text-white/20">…</span>
                    )}
                  </span>
                  <span className="hidden md:flex">
                    <HourlyForecastBadge
                      ticker={inst.ticker}
                      locale={locale}
                      compact
                      precomputed={fc ?? { forecast: null, closes: [], failed: false }}
                    />
                  </span>
                  <span className={`text-white/30 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                </button>

                {/* Mobilde ikinci satır: 24s / 1s / saatlik yön — kart değil, aynı satır grubunun devamı */}
                <div className="md:hidden px-4 pb-2.5 -mt-1 flex items-center gap-3">
                  {fc?.closes?.length ? (
                    <Sparkline data={fc.closes.slice(-24)} color={sparkColor} width={40} height={18} fillOpacity={0.12} />
                  ) : null}
                  <span className={`text-xs font-mono font-semibold ${positive ? "!text-[#3fb950]" : "!text-[#f85149]"}`}>
                    {c.change} {fmtChange(q?.change_1d)}
                  </span>
                  <span className={`text-xs font-mono font-semibold ${change1hNoise ? "!text-white/30" : change1hPositive ? "!text-[#3fb950]" : "!text-[#f85149]"}`}>
                    {c.change1h} {fmtChange1h(fc?.change1h)}
                  </span>
                  <span className="ml-auto">
                    <HourlyForecastBadge
                      ticker={inst.ticker}
                      locale={locale}
                      compact
                      precomputed={fc ?? { forecast: null, closes: [], failed: false }}
                    />
                  </span>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#1e2a3a] bg-[#070a10] px-4 md:px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex gap-1">
                        {(Object.keys(RANGE_CONFIG) as RangeTab[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => setRangeTab(key)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                              rangeTab === key
                                ? "bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/40"
                                : "bg-transparent text-white/40 border border-transparent hover:text-white/70"
                            }`}
                          >
                            {c.rangeLabels[key]}
                          </button>
                        ))}
                      </div>
                      <Link
                        href={`/global/${locale}/graphic/${inst.ticker}`}
                        className="text-[10px] font-semibold tracking-wider text-[#3b82f6] hover:text-[#60a5fa] transition-colors whitespace-nowrap"
                      >
                        {localeUpperCase(c.openFull, locale)}
                      </Link>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-[#1e2a3a]">
                      <BogaChartEngine
                        key={`${inst.ticker}-${rangeTab}`}
                        symbol={inst.ticker}
                        lang={locale}
                        compact
                        showToolbar={false}
                        height={260}
                        defaultTimeframe={range.timeframe}
                        compactWindowDays={range.windowDays}
                        premiumGate={false}
                        // Mini akordiyon grafiğin varsayılanı ema50+volume idi —
                        // 2026-08-20 kullanıcı geri bildirimi: alttaki boş hacim
                        // paneli ("0" etiketli) mini görünümde gereksiz, kaldır ki
                        // grafik nefes alsın. EMA50 çizgisi kalsın, sadece hacim gitsin.
                        indicators={["ema50"]}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gerçek, biriktirilen isabet oranı — asıl farklılaştırıcı (bkz.
         app/api/forecast-accuracy). Yeterli örneklem birikmeden gösterilmez;
         sahte/tahmini bir sayı basmıyoruz. */}
      {showAccuracy && accuracy && (
        <div className="px-4 py-2.5 mt-2 rounded-xl bg-[#0d131f] border border-[#1e2a3a]">
          <span className="text-[11px] text-white/40 tabular-nums">
            {c.accuracyLabel(Math.round(accuracy.hitRate! * 100), accuracy.sampleSize)}
          </span>
        </div>
      )}
    </div>
  );
}
