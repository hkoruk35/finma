"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import type { AssetInstrument, AssetClassLocale } from "@/lib/assetClasses";
import { formatAssetPrice } from "@/lib/symbols";
import HourlyForecastBadge from "@/components/global/HourlyForecastBadge";

interface QuoteResult {
  price: number | null;
  change_1d: number | null;
}

interface Copy {
  instrument: string;
  price: string;
  change: string;
  forecast: string;
  viewChart: string;
}

const COPY: Record<Locale, Copy> = {
  en: { instrument: "Instrument", price: "Price", change: "24h Change", forecast: "Hourly Forecast", viewChart: "View Chart" },
  tr: { instrument: "Enstrüman", price: "Fiyat", change: "24s Değişim", forecast: "Saatlik Tahmin", viewChart: "Grafiği Aç" },
  es: { instrument: "Instrumento", price: "Precio", change: "Cambio 24h", forecast: "Pronóstico Horario", viewChart: "Ver Gráfico" },
  fr: { instrument: "Instrument", price: "Prix", change: "Variation 24h", forecast: "Prévision Horaire", viewChart: "Voir le Graphique" },
  pt: { instrument: "Instrumento", price: "Preço", change: "Variação 24h", forecast: "Previsão por Hora", viewChart: "Ver Gráfico" },
  id: { instrument: "Instrumen", price: "Harga", change: "Perubahan 24j", forecast: "Perkiraan per Jam", viewChart: "Lihat Grafik" },
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

  useEffect(() => {
    const tickers = instruments.map((i) => i.ticker).join(",");
    if (!tickers) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/quote?tickers=${encodeURIComponent(tickers)}`);
        const data = await res.json();
        if (!cancelled) setQuotes(data ?? {});
      } catch {
        // sessizce yut — bir sonraki polling denemesi kurtaracak
      }
    }

    load();
    const interval = setInterval(load, 30 * 1000); // 30 sn — "7/24 canli" hissi icin yeterince sik, Yahoo'yu bogmayacak kadar seyrek
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [instruments]);

  return (
    <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden">
      {/* Header row — sadece masaüstünde */}
      <div className="hidden md:grid grid-cols-[1.4fr_0.9fr_0.9fr_1.3fr_auto] gap-3 px-5 py-2.5 bg-[#0d131f] text-[10px] font-bold uppercase tracking-wider text-white/40">
        <span>{c.instrument}</span>
        <span className="text-right">{c.price}</span>
        <span className="text-right">{c.change}</span>
        <span>{c.forecast}</span>
        <span />
      </div>

      <div className="divide-y divide-[#1e2a3a]">
        {instruments.map((inst) => {
          const q = quotes[inst.ticker];
          const positive = (q?.change_1d ?? 0) >= 0;
          const priceLabel = q?.price != null ? formatAssetPrice(q.price, inst.ticker, locale) : "—";

          return (
            <Link
              key={inst.ticker}
              href={`/global/${locale}/graphic/${inst.ticker}`}
              className="grid grid-cols-2 md:grid-cols-[1.4fr_0.9fr_0.9fr_1.3fr_auto] gap-2 md:gap-3 items-center px-5 py-3.5 bg-[#0a0e17] hover:bg-[#111826] transition-colors group"
            >
              <span className="text-sm font-semibold text-white">{inst.names[assetLocale] ?? inst.ticker}</span>
              <span className="text-sm font-mono text-white text-right md:text-right">{priceLabel}</span>
              <span
                className={`text-sm font-mono font-semibold text-right col-start-1 md:col-start-3 ${positive ? "!text-[#3fb950]" : "!text-[#f85149]"}`}
              >
                {fmtChange(q?.change_1d)}
              </span>
              <span className="col-start-2 md:col-start-4 row-start-1 md:row-start-auto justify-self-end md:justify-self-start">
                <HourlyForecastBadge ticker={inst.ticker} locale={locale} compact />
              </span>
              <span className="hidden md:inline text-[10px] font-semibold uppercase tracking-wider text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {c.viewChart} →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
