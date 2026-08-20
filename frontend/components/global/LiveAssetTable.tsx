"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import type { AssetInstrument, AssetClassLocale } from "@/lib/assetClasses";
import { formatAssetPrice } from "@/lib/symbols";
import { computeHourlyForecast, type HourlyForecast } from "@/lib/hourlyForecast";
import HourlyForecastBadge from "@/components/global/HourlyForecastBadge";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

interface QuoteResult {
  price: number | null;
  change_1d: number | null;
}

interface ForecastEntry {
  forecast: HourlyForecast | null;
  closes: number[];
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
  forecast: string;
  sortLabel: string;
  sortStrength: string;
  sortChange: string;
  sortVolume: string;
  rangeLabels: Record<RangeTab, string>;
  openFull: string;
}

const COPY: Record<Locale, Copy> = {
  en: {
    instrument: "Instrument", price: "Price", change: "24h Change", forecast: "Hourly Forecast",
    sortLabel: "Sort:", sortStrength: "Signal Strength", sortChange: "Change", sortVolume: "Volume Trend",
    rangeLabels: { "24h": "24h", "7d": "7d", "30d": "30d" },
    openFull: "Open full chart ↗",
  },
  tr: {
    instrument: "Enstrüman", price: "Fiyat", change: "24s Değişim", forecast: "Saatlik Tahmin",
    sortLabel: "Sırala:", sortStrength: "Sinyal Gücü", sortChange: "Değişim", sortVolume: "Hacim Eğilimi",
    rangeLabels: { "24h": "24s", "7d": "7g", "30d": "30g" },
    openFull: "Tam grafikte aç ↗",
  },
  es: {
    instrument: "Instrumento", price: "Precio", change: "Cambio 24h", forecast: "Pronóstico Horario",
    sortLabel: "Ordenar:", sortStrength: "Fuerza de Señal", sortChange: "Cambio", sortVolume: "Tendencia de Volumen",
    rangeLabels: { "24h": "24h", "7d": "7d", "30d": "30d" },
    openFull: "Abrir gráfico completo ↗",
  },
  fr: {
    instrument: "Instrument", price: "Prix", change: "Variation 24h", forecast: "Prévision Horaire",
    sortLabel: "Trier :", sortStrength: "Force du Signal", sortChange: "Variation", sortVolume: "Tendance du Volume",
    rangeLabels: { "24h": "24h", "7d": "7j", "30d": "30j" },
    openFull: "Ouvrir le graphique complet ↗",
  },
  pt: {
    instrument: "Instrumento", price: "Preço", change: "Variação 24h", forecast: "Previsão por Hora",
    sortLabel: "Ordenar:", sortStrength: "Força do Sinal", sortChange: "Variação", sortVolume: "Tendência de Volume",
    rangeLabels: { "24h": "24h", "7d": "7d", "30d": "30d" },
    openFull: "Abrir gráfico completo ↗",
  },
  id: {
    instrument: "Instrumen", price: "Harga", change: "Perubahan 24j", forecast: "Perkiraan per Jam",
    sortLabel: "Urutkan:", sortStrength: "Kekuatan Sinyal", sortChange: "Perubahan", sortVolume: "Tren Volume",
    rangeLabels: { "24h": "24j", "7d": "7h", "30d": "30h" },
    openFull: "Buka grafik lengkap ↗",
  },
};

function fmtChange(v: number | null | undefined) {
  if (v == null) return "—";
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

  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Fiyat/degisim — 30 sn'de bir, ayni zamanda fiyat flash'ini tetikler ──
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

  // ── Saatlik tahmin — tum enstrumanlar icin merkezi olarak cekilir, hem
  // rozette hem sirlamada (sortBy) kullanilir. 5 dk'da bir tazelenir. ──
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
            return [inst.ticker, { forecast, closes, failed: false }] as const;
          } catch {
            return [inst.ticker, { forecast: null, closes: [], failed: true }] as const;
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
      {/* Sıralama kontrolü — varsayılan: en güçlü sinyalden en zayıfa (bkz. lib/hourlyForecast.ts) */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{c.sortLabel}</span>
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
        <div className="hidden md:grid grid-cols-[1.4fr_0.9fr_0.9fr_1.5fr_auto] gap-3 px-5 py-2.5 bg-[#0d131f] text-[10px] font-bold uppercase tracking-wider text-white/40">
          <span>{c.instrument}</span>
          <span className="text-right">{c.price}</span>
          <span className="text-right">{c.change}</span>
          <span>{c.forecast}</span>
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

            return (
              <div key={inst.ticker} className="bg-[#0a0e17]">
                <button
                  type="button"
                  onClick={() => toggleExpand(inst.ticker)}
                  className="w-full grid grid-cols-[1.4fr_auto_auto] md:grid-cols-[1.4fr_0.9fr_0.9fr_1.5fr_auto] gap-2 md:gap-3 items-center px-4 md:px-5 py-3 md:py-3.5 hover:bg-[#111826] transition-colors text-left"
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

                {/* Mobilde forecast rozeti ikinci satıra iner — kart değil, aynı satır grubunun devamı */}
                <div className="md:hidden px-4 pb-2 -mt-1 flex items-center justify-between">
                  <span className={`text-xs font-mono font-semibold ${positive ? "!text-[#3fb950]" : "!text-[#f85149]"}`}>
                    {fmtChange(q?.change_1d)}
                  </span>
                  <HourlyForecastBadge
                    ticker={inst.ticker}
                    locale={locale}
                    compact
                    precomputed={fc ?? { forecast: null, closes: [], failed: false }}
                  />
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
                        className="text-[10px] font-semibold uppercase tracking-wider text-[#3b82f6] hover:text-[#60a5fa] transition-colors whitespace-nowrap"
                      >
                        {c.openFull}
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
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
