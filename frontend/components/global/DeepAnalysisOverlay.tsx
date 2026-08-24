"use client";

import { useEffect } from "react";

interface Props {
  ticker: string | null;
  locale: "tr" | "en" | "es" | "fr" | "pt" | "id";
  onClose: () => void;
}

/**
 * Opens the ticker's real public page (graphic/chart) in a new browser tab.
 * Renders nothing — just triggers navigation and resets parent state.
 *
 * Not.: Eskiden /global/{locale}/analysis/{ticker} sayfasını açıyordu — o
 * sayfa artık kullanıcıya gösterilmiyor (admin altına taşındı, bkz.
 * app/admin/analysis/[ticker]), bu yüzden hedef gerçek/genel ticker
 * sayfasına (graphic) yönlendirildi ki üye deneyimi kırılmasın.
 */
export default function DeepAnalysisOverlay({ ticker, locale, onClose }: Props) {
  useEffect(() => {
    if (!ticker) return;
    window.open(`/global/${locale}/graphic/${ticker}`, "_blank", "noopener,noreferrer");
    onClose();
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
