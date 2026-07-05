"use client";

import DeepAnalysisReport from "./DeepAnalysisReport";

interface Props {
  ticker: string;
  stockData: any;
  lang: "tr" | "en";
}

/**
 * Page-mode wrapper — renders DeepAnalysisReport inline (no overlay).
 * Shown when stockData is still loading (null), passes empty object so
 * the report's own loading state takes over once stockData arrives.
 */
export default function DeepAnalysisContent({ ticker, stockData, lang }: Props) {
  if (!ticker) return null;
  return (
    <DeepAnalysisReport
      ticker={ticker}
      stockData={stockData ?? {}}
      lang={lang}
      mode="page"
    />
  );
}
