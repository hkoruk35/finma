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
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol.includes(":") ? symbol : symbol,
      width: "100%",
      height: height,
      locale: "en",
      dateRange: "3M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
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
