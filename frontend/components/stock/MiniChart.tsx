"use client";

import { useEffect, useRef } from "react";

interface Props {
  symbol: string;
  height?: string;
}

export default function MiniChart({ symbol, height = "180" }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[symbol, symbol + "|1D"]],
      chartOnly: false,
      width: "100%",
      height: height,
      locale: "en",
      colorTheme: "dark",
      autosize: true,
      showVolume: false,
      showMA: false,
      hideDateRanges: true,
      hideMarketStatus: true,
      hideSymbolLogo: true,
      scalePosition: "no",
      scaleMode: "Normal",
      fontFamily: "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
      fontSize: "10",
      noTimeScale: true,
      valuesTracking: "1",
      changeMode: "percent",
      chartType: "area",
      maLineColor: "#2962FF",
      maLineWidth: 1,
      maLength: 9,
      lineWidth: 2,
      lineColor: "#3b82f6",
      topColor: "rgba(59, 130, 246, 0.3)",
      bottomColor: "rgba(59, 130, 246, 0)",
      gridLineColor: "rgba(42, 46, 57, 0)",
      dateFormat: "MMM dd, yyyy",
      timeHoursFormat: "24-h",
    });
    container.current.innerHTML = "";
    container.current.appendChild(script);
  }, [symbol, height]);

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
}
