"use client";

import React, { useEffect, useRef } from 'react';

let tvScriptLoadingPromise: Promise<void> | null = null;

interface Props {
  symbol: string;
}

// Comprehensive exchange mapping for the BOGA 100 universe.
// TradingView requires the correct exchange prefix for reliability.
const NASDAQ_TICKERS = new Set([
  "AAPL", "ABNB", "ADBE", "AMAT", "AMD", "AMZN", "ARM", "AVGO",
  "BKNG", "CELH", "CHTR", "CMCSA", "COIN", "COST", "CSCO", "DXCM", 
  "EXC", "FANG", "GOOGL", "HOOD", "INTU", "IONQ", "ISRG", "LRCX", 
  "MARA", "META", "MSFT", "MSTR", "MU", "NFLX", "NVDA", "PANW", 
  "PEP", "PYPL", "QCOM", "RIVN", "SBAC", "SBUX", "SMCI", "SNOW", 
  "SOFI", "SPOT", "TMUS", "TSLA", "TXN", "ZS"
]);

const AMEX_TICKERS = new Set(["BTI", "NGD", "KGC"]);

function getExchange(ticker: string): string {
  const t = ticker.toUpperCase();
  if (NASDAQ_TICKERS.has(t)) return "NASDAQ";
  if (AMEX_TICKERS.has(t)) return "AMEX";
  return "NYSE";
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
        // Sanitize symbol: TradingView uses . for class shares (e.g., BRK.B instead of BRK-B)
        const tvSymbol = symbol.replace('-', '.');
        
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: `${exchange}:${tvSymbol}`,
          interval: "D",
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
        <a href={`https://www.tradingview.com/symbols/${exchange}-${symbol.replace('-', '.')}/`} rel="noopener nofollow" target="_blank" style={{ textDecoration: "none", color: "#3b82f6" }}>
          <span>{symbol} Chart</span>
        </a> by TradingView
      </div>
    </div>
  );
}
