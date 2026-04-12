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
        // Sanitize symbol: TradingView uses . for class shares (e.g., BRK.B instead of BRK-B)
        const tvSymbol = symbol.replace('-', '.');
        
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: "D",
          timezone: "America/New_York",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0d1117",
          enable_publishing: false,
          hide_side_toolbar: true,
          hide_top_toolbar: true,
          withdateranges: false,
          allow_symbol_change: false,
          save_image: false,
          container_id: "tradingview_widget",
        });
      }
    }
  }, [symbol]);

  return (
    <div className='tradingview-widget-container w-full h-[350px] md:h-[550px] rounded-xl overflow-hidden'>
      <div id='tradingview_widget' style={{ height: "100%", width: "100%" }} />
      <div className="tradingview-widget-copyright" style={{ fontSize: "12px", textAlign: "center", padding: "8px", color: "#64748b" }}>
        <a href={`https://www.tradingview.com/symbols/${symbol.replace('-', '.')}/`} rel="noopener nofollow" target="_blank" style={{ textDecoration: "none", color: "#3b82f6" }}>
          <span>{symbol} Chart</span>
        </a> by TradingView
      </div>
    </div>
  );
}
