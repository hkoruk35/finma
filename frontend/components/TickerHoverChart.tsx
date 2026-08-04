"use client";

import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

const CHART_DETAIL_LABEL: Record<string, string> = {
  en: "Chart Detail",
  tr: "Grafik Detay",
  es: "Detalle del Gráfico",
  fr: "Détail du Graphique",
  pt: "Detalhe do Gráfico",
};

interface Props {
  ticker: string;
  children: ReactNode;
  className?: string;
  detailHref?: string;
  onDetailClick?: () => void;
  detailLabel?: string;
  locale?: string;
}

export default function TickerHoverChart({ ticker, children, className, locale }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const pathLocale = pathname?.match(/^\/global\/(en|tr|es|fr|pt)(\/|$)/)?.[1];
  const loc = locale || pathLocale || "en";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEnter = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    // Dokunmatik cihazlardaki sentetik dokunma (tap) olaylarında popup açılmasın
    if ((e.nativeEvent as PointerEvent)?.pointerType === "touch") return;

    if (timerRef.current) clearTimeout(timerRef.current);
    const r = e.currentTarget.getBoundingClientRect();

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1400;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
    const popupWidth = 430;
    const popupHeight = 270;

    // Sağ kenara yakınsa pencereyi sol tarafa aç
    let x = r.right + 12;
    if (x + popupWidth > viewportWidth - 10) {
      x = Math.max(10, r.left - popupWidth - 12);
    }

    let y = Math.max(10, Math.min(r.top, viewportHeight - popupHeight - 10));

    setPos({ x, y });
  }, []);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPos(null), 400);
  }, []);

  const handlePopupEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handlePopupLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPos(null), 400);
  }, []);

  return (
    <>
      <span
        className={className}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </span>

      {pos && mounted && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={handlePopupEnter}
          onMouseLeave={handlePopupLeave}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: 430,
            zIndex: 99999,
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 8,
            overflow: "hidden",
            pointerEvents: "auto",
            boxShadow: "0 12px 40px rgba(0,0,0,0.8)",
          }}
        >
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#0d1117",
          }}>
            <span style={{ color: "#38bdf8", fontWeight: 800, fontSize: 12 }}>
              {ticker} — 1D Chart
            </span>
            <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 600 }}>
              <a
                href={`/global/${loc}/graphic/${ticker}`}
                style={{ color: "#00d2ff" }}
                className="hover:underline"
              >
                {CHART_DETAIL_LABEL[loc] || CHART_DETAIL_LABEL.en} ↗
              </a>
            </div>
          </div>
          <div style={{ width: 430, height: 220 }}>
            <BogaChartEngine symbol={ticker} interval="D" height={220} compact showToolbar={false} indicators={["ema20"]} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
