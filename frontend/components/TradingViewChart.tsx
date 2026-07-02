"use client";

import { useEffect, useRef } from "react";

const EXCHANGE_MAP: Record<string, string> = {
  NMS: "NASDAQ", NasdaqGS: "NASDAQ", NasdaqGM: "NASDAQ", NasdaqCM: "NASDAQ",
  NYQ: "NYSE",   NYSE: "NYSE",
  ASE: "AMEX",
  PCX: "NYSE",
};

function tvSymbol(ticker: string, exchange: string) {
  const prefix = EXCHANGE_MAP[exchange] || "NASDAQ";
  return `${prefix}:${ticker}`;
}

interface Props {
  ticker: string;
  exchange: string;
  interval: "15" | "60" | "D" | "W";
}

declare global {
  interface Window {
    TradingView?: { widget: new (config: object) => void };
  }
}

export default function TradingViewChart({ ticker, exchange, interval }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = `tv_${ticker}_${interval}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    container.id = containerId;

    let mounted = true;

    function initWidget() {
      if (!mounted || !container || !window.TradingView) return;
      try {
        new window.TradingView.widget({
          container_id: containerId,
          width: "100%",
          height: 460,
          symbol: tvSymbol(ticker, exchange),
          interval,
          timezone: "America/New_York",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0d1117",
          enable_publishing: false,
          allow_symbol_change: false,
          save_image: false,
          hide_top_toolbar: false,
          hide_legend: false,
          withdateranges: true,
          studies: ["RSI@tv-basicstudies"],
          overrides: {
            "paneProperties.background": "#0d1117",
            "paneProperties.backgroundType": "solid",
            "scalesProperties.textColor": "#8b949e",
          },
        });
      } catch {
        // Widget init can fail silently if TV script isn't ready
      }
    }

    const existing = document.getElementById("tv-script");
    if (window.TradingView) {
      initWidget();
    } else if (!existing) {
      const script = document.createElement("script");
      script.id = "tv-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      // Script tag exists but TradingView not ready yet — poll briefly
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (window.TradingView) { clearInterval(poll); initWidget(); }
        if (attempts > 20) clearInterval(poll);
      }, 200);
    }

    return () => {
      mounted = false;
      if (container) container.innerHTML = "";
    };
  }, [ticker, exchange, interval, containerId]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      style={{ width: "100%", height: 460, background: "#0d1117", borderRadius: 6 }}
    />
  );
}
