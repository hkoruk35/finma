"use client";

import { useEffect, useState, useCallback } from "react";
import { getDailyTickersAsCsp } from "@/lib/csp-data-source";
import { useCloudStore } from "@/hooks/useCloudStore";
import CSPDetailClient from "@/components/CSPDetailClient";

interface CspData {
  tickers: string[];
  types: Record<string, string>;
  notes: Record<string, string>;
}

export default function DailyCspDetailClient() {
  const [autoTickers, setAutoTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAutoUpdate, setLastAutoUpdate] = useState<Date | null>(null);

  // Cloud store hook
  const { data: cspData, save: saveCsp, ready } = useCloudStore<CspData>({
    endpoint: { type: "csp", slug: "daily" },
    cacheKey: "csp_daily",
    defaultValue: { tickers: [], types: {}, notes: {} },
  });

  // Fetch daily tickers and auto-update every 5 minutes (market hours)
  const fetchAndUpdateTickers = useCallback(async () => {
    try {
      const newTickers = await getDailyTickersAsCsp();
      if (newTickers.length > 0) {
        setAutoTickers(newTickers);
        setLastAutoUpdate(new Date());

        // Merge with existing manual entries
        const manualTickers = cspData.tickers.filter(
          (t) => cspData.types[t] === "MANUAL"
        );
        const combined = Array.from(
          new Set([...newTickers, ...manualTickers])
        );

        // Update cloud store
        saveCsp({
          tickers: combined,
          types: {
            ...cspData.types,
            ...newTickers.reduce(
              (acc, t) => ({
                ...acc,
                [t]: cspData.types[t] || "DAILY",
              }),
              {}
            ),
          },
          notes: cspData.notes,
        });
      }
    } catch (err) {
      console.error("[DailyCspDetailClient] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [cspData, saveCsp]);

  // Initial fetch and auto-update every 5 minutes during market hours
  useEffect(() => {
    if (!ready) return;

    fetchAndUpdateTickers();

    // Auto-update every 5 minutes
    const interval = setInterval(() => {
      fetchAndUpdateTickers();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [ready, fetchAndUpdateTickers]);

  if (!ready || loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#8b949e" }}>
        <span className="animate-pulse">Daily veriler yükleniyor...</span>
      </div>
    );
  }

  // Show CSPDetailClient with fetched tickers
  return (
    <>
      {lastAutoUpdate && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#0d2a0d",
            border: "1px solid #f59e0b",
            borderRadius: 4,
            fontSize: 11,
            color: "#f59e0b",
          }}
        >
          ✓ Son otomatik güncelleme: {lastAutoUpdate.toLocaleTimeString("tr-TR")}
        </div>
      )}
      <CSPDetailClient slug="daily" />
    </>
  );
}
