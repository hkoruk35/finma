"use client";

import DeepAnalysisReport from "./DeepAnalysisReport";

interface Props {
  ticker: string;
  stockData: any;
  lang: "tr" | "en";
}

const L = (lang: "tr" | "en", tr: string, en: string) => lang === "en" ? en : tr;

/**
 * Page-mode wrapper — waits for real stockData before mounting the report.
 * Prevents DeepAnalysisReport from fetching /api/deep-analysis with empty data.
 */
export default function DeepAnalysisContent({ ticker, stockData, lang }: Props) {
  if (!ticker) return null;

  const hasData = !!(stockData?.price?.current || stockData?.technical?.rsi_14);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">
          {L(lang, `${ticker} verileri yükleniyor...`, `Loading ${ticker} data...`)}
        </p>
      </div>
    );
  }

  return (
    <DeepAnalysisReport
      ticker={ticker}
      stockData={stockData}
      lang={lang}
      mode="page"
    />
  );
}
