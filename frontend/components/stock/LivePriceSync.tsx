"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/formatNumber";

interface Props {
  ticker: string;
  initialPrice: number;
  initialChange: number;
}

/**
 * LivePriceSync — Client-side component to synchronize the SSR price with the latest JSON data.
 * It polls the latest data and updates the price/change labels using DOM IDs.
 */
export default function LivePriceSync({ ticker, initialPrice, initialChange }: Props) {
  useEffect(() => {
    // Prevent multiple trackers
    if ((window as any)._priceTrackerActive === ticker) return;
    (window as any)._priceTrackerActive = ticker;

    const fetchLatest = async () => {
      try {
        // Fetch from the latest JSON endpoint
        const res = await fetch("/api/data/latest/all_tickers_list.json?v=" + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const tickers = data.tickers || [];
        const live = tickers.find((t: any) => t.ticker.toUpperCase() === ticker.toUpperCase());

        if (live && live.price) {
          const priceEl = document.getElementById("stock-price-current");
          const changeEl = document.getElementById("stock-price-change");
          const returns1dEl = document.getElementById("stock-returns-1d");

          if (priceEl) {
            priceEl.innerText = `$${formatNumber(live.price, 2)}`;
          }

          if (changeEl) {
            const pct = live.change_pct || 0;
            changeEl.innerText = `${pct >= 0 ? "+" : ""}${formatNumber(pct, 2)}%`;
            // Update color
            const parent = changeEl.parentElement;
            if (parent) {
              parent.className = `flex flex-col ${pct > 0 ? "text-[#22c55e]" : pct < 0 ? "text-[#ef4444]" : "text-[#94a3b8]"}`;
            }
          }

          if (returns1dEl) {
             const pct = live.change_pct || 0;
             returns1dEl.innerText = `${pct >= 0 ? "+" : ""}${formatNumber(pct, 2)}%`;
             returns1dEl.className = `text-base md:text-lg font-mono font-medium ${pct > 0 ? "text-[#22c55e]" : pct < 0 ? "text-[#ef4444]" : "text-[#94a3b8]"}`;
          }
        }
      } catch (e) {
        console.warn("LivePriceSync error:", e);
      }
    };

    // Initial sync
    fetchLatest();

    // Poll every 2 minutes (since bots run every hour, 2 min is safe for "freshness")
    const interval = setInterval(fetchLatest, 120000);

    return () => {
      clearInterval(interval);
      (window as any)._priceTrackerActive = null;
    };
  }, [ticker]);

  return null; // Invisible component
}
