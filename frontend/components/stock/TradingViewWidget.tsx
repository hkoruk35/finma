"use client";

import React, { useEffect, useRef } from 'react';

let tvScriptLoadingPromise: Promise<void> | null = null;

interface Props {
  symbol: string;
}

export default function TradingViewWidget({ symbol }: Props) {
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
          symbol: `NASDAQ:${symbol}`,
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
    <div className='tradingview-widget-container' style={{ height: "500px", width: "100%" }}>
      <div id='tradingview_widget' style={{ height: "calc(100% - 32px)", width: "100%" }} />
      <div className="tradingview-widget-copyright">
        <a href={`https://www.tradingview.com/symbols/NASDAQ-${symbol}/`} rel="noopener nofollow" target="_blank">
          <span className="blue-text">{symbol} Chart</span>
        </a> by TradingView
      </div>
    </div>
  );
}
