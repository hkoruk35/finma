"use client";

import { useEffect } from "react";

interface Props {
  ticker: string | null;
  locale: "tr" | "en" | "es" | "fr" | "pt";
  onClose: () => void;
}

/**
 * Opens the deep analysis page in a new browser tab.
 * Renders nothing — just triggers navigation and resets parent state.
 */
export default function DeepAnalysisOverlay({ ticker, locale, onClose }: Props) {
  useEffect(() => {
    if (!ticker) return;
    window.open(`/global/${locale}/analysis/${ticker}`, "_blank", "noopener,noreferrer");
    onClose();
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
