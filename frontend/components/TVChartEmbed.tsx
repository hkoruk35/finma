"use client";

import { useEffect, useRef } from "react";

let tvLoaded = false;
let tvLoadPromise: Promise<void> | null = null;

function loadTVScript(): Promise<void> {
  if (tvLoaded) return Promise.resolve();
  if (tvLoadPromise) return tvLoadPromise;
  tvLoadPromise = new Promise((resolve) => {
    const existing = document.getElementById("tv-global-script");
    if (existing) { tvLoaded = true; resolve(); return; }
    const s = document.createElement("script");
    s.id = "tv-global-script";
    s.src = "https://s3.tradingview.com/tv.js";
    s.onload = () => { tvLoaded = true; resolve(); };
    document.head.appendChild(s);
  });
  return tvLoadPromise;
}

interface Props {
  tvSymbol: string;
  interval?: string;
  containerId: string;
  height?: number | null;
  // compact: minimal toolbar, no date ranges, no studies (for multi-screen grid)
  compact?: boolean;
  studies?: string[];
}

export default function TVChartEmbed({
  tvSymbol,
  interval = "W",
  containerId,
  height = 480,
  compact = false,
  studies = [
    "MAExp@tv-basicstudies",
    "Bollinger Bands@tv-basicstudies",
    "RSI@tv-basicstudies",
    "VWAP@tv-basicstudies",
  ],
}: Props) {
  const createdRef = useRef(false);

  useEffect(() => {
    let alive = true;
    createdRef.current = false;
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = "";

    loadTVScript().then(() => {
      if (!alive) return;
      const container = document.getElementById(containerId);
      if (!container || !(window as any).TradingView) return;
      container.innerHTML = "";

      new (window as any).TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval,
        timezone: "America/New_York",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0a0e17",
        enable_publishing: false,
        hide_side_toolbar: true,
        // Always show top toolbar so users can add/remove indicators
        hide_top_toolbar: false,
        withdateranges: !compact,
        allow_symbol_change: false,
        save_image: false,
        container_id: containerId,
        studies: studies,
      });
      createdRef.current = true;
    });

    return () => { alive = false; };
  }, [tvSymbol, interval, containerId, compact, studies]);

  return (
    <div
      id={containerId}
      style={{ height: height ?? "100%", width: "100%", minHeight: height ? undefined : 200 }}
    />
  );
}
