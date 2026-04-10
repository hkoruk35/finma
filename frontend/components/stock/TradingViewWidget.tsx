"use client";

import React, { useEffect, useRef } from 'react';

let tvScriptLoadingPromise: Promise<void> | null = null;

interface Props {
  symbol: string;
}

// Tickers in our 100-stock universe that trade on NASDAQ.
// Everything else defaults to NYSE. TradingView needs the correct
// exchange prefix or the widget shows "Symbol not found".
const NASDAQ_TICKERS = new Set([
  "AAPL", "ABNB", "ADBE", "AMAT", "AMD", "AMZN", "AVGO",
  "BKNG", "CHTR", "CMCSA", "COIN", "COST", "EXC", "FANG",
  "GOOGL", "INTU", "ISRG", "LRCX", "META", "MSFT", "MSTR",
  "MU", "NFLX", "NVDA", "PANW", "PEP", "PYPL", "QCOM",
  "SBUX", "SMCI", "SPOT", "TMUS", "TSLA", "TXN",
]);

function getExchange(ticker: string): string {
  return NASDAQ_TICKERS.has(ticker.toUpperCase()) ? "NASDAQ" : "NYSE";
}

export default function TradingViewWidget({ symbol }: Props) {
  const exchange = getExchange(symbol);
  const onLoadScriptRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onLoadScriptRef.current = createWidget;

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-loading-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => onLoadScriptRef.current && onLoadScriptRef.current());

    return () => {
      onLoadScriptRef.current = null;
    };

    function createWidget() {
      if (document.getElementById('tradingview_widget') && 'TradingView' in window) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: `${exchange}:${symbol}`,
          interval: "60",
          timezone: "America/New_York",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#131722",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: "tradingview_widget",
        });
      }
    }
  }, [symbol]);

  return (
    <div className='tradingview-widget-container' style={{ height: "calc(100vh - 250px)", minHeight: "300px", maxHeight: "550px", width: "100%" }}>
      <div id='tradingview_widget' style={{ height: "calc(100% - 32px)", width: "100%" }} />
      <div className="tradingview-widget-copyright" style={{ fontSize: "12px", textAlign: "center", padding: "8px", color: "#64748b" }}>
        <a href={`https://www.tradingview.com/symbols/${exchange}-${symbol}/`} rel="noopener nofollow" target="_blank" style={{ textDecoration: "none", color: "#3b82f6" }}>
          <span>{symbol} Chart</span>
        </a> by TradingView
      </div>
    </div>
  );
}
