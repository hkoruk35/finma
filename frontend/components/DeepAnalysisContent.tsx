"use client";

import DeepAnalysisReport from "./DeepAnalysisReport";

interface Props {
  data?: any;
  ticker?: string;
  stockData?: any;
  lang?: "tr" | "en" | "es" | "fr" | "pt";
  locale?: "tr" | "en" | "es" | "fr";
}

const L = (lang: "tr" | "en" | "es" | "fr" | "pt" | string, tr: string, en: string, es?: string, fr?: string) =>
  lang === "tr" ? tr : lang === "es" ? (es || en) : lang === "fr" ? (fr || en) : en;

/**
 * Page-mode wrapper — waits for real stockData before mounting the report.
 * Prevents DeepAnalysisReport from fetching /api/deep-analysis with empty data.
 */
export default function DeepAnalysisContent({ data, ticker, stockData, lang, locale }: Props) {
  const actualTicker = ticker || data?.ticker;
  const actualStockData = stockData || data;
  const actualLang = lang || locale || "en";

  if (!actualTicker) return null;

  const hasData = !!(actualStockData?.price?.current || actualStockData?.technical?.rsi_14);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">
          {L(actualLang, `${actualTicker} verileri yükleniyor...`, `Loading ${actualTicker} data...`, `Cargando datos de ${actualTicker}...`, `Chargement des données de ${actualTicker}...`)}
        </p>
      </div>
    );
  }

  return (
    <DeepAnalysisReport
      ticker={actualTicker}
      stockData={actualStockData}
      lang={actualLang}
      mode="page"
    />
  );
}
