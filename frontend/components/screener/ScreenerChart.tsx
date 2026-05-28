"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickData,
  HistogramData,
  LineData,
} from "lightweight-charts";

interface OHLCV {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  ticker: string;
  fullscreen?: boolean;
}

export default function ScreenerChart({ ticker, fullscreen = false }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ema8SeriesRef = useRef<any>(null);
  const ema20SeriesRef = useRef<any>(null);
  const ema50SeriesRef = useRef<any>(null);

  const [timeframe, setTimeframe] = useState<"1d" | "1w" | "1h">("1d");
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);
  const [loading, setLoading] = useState(true);

  // Fetch OHLCV data from Yahoo Finance
  const fetchChartData = async (tf: "1d" | "1w" | "1h"): Promise<OHLCV[]> => {
    try {
      const intervalMap = { "1d": "1d", "1w": "1wk", "1h": "60m" };
      const interval = intervalMap[tf];
      const range = tf === "1h" ? "7d" : tf === "1w" ? "1y" : "6mo";

      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      if (!res.ok) return [];
      const data = await res.json();
      const chart = data?.chart?.result?.[0];
      if (!chart) return [];

      const timestamps = chart.timestamp || [];
      const quotes = chart.indicators?.quote?.[0] || {};
      const closes = quotes.close || [];
      const highs = quotes.high || [];
      const lows = quotes.low || [];
      const opens = quotes.open || [];
      const volumes = quotes.volume || [];

      const result: OHLCV[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (opens[i] && highs[i] && lows[i] && closes[i]) {
          result.push({
            time: (timestamps[i] * 1000) as Time,
            open: opens[i],
            high: highs[i],
            low: lows[i],
            close: closes[i],
            volume: volumes[i] || 0,
          });
        }
      }

      return result;
    } catch (err) {
      console.error("Chart data fetch error:", err);
      return [];
    }
  };

  // EMA calculation
  const calcEMA = (data: number[], period: number): number[] => {
    if (data.length < period) return [];
    const result: number[] = [];
    const k = 2 / (period + 1);
    let sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = 0; i < period; i++) {
      result.push(i === period - 1 ? sma : 0);
    }

    for (let i = period; i < data.length; i++) {
      sma = data[i] * k + sma * (1 - k);
      result.push(sma);
    }

    return result;
  };

  useEffect(() => {
    const initChart = async () => {
      if (!chartContainerRef.current) return;

      setLoading(true);
      const ohlcvData = await fetchChartData(timeframe);
      if (ohlcvData.length === 0) {
        setLoading(false);
        return;
      }

      // Clean up old chart
      if (chartRef.current) {
        chartRef.current.remove();
      }

      // Create chart
      const container = chartContainerRef.current;
      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "#0d1117" },
          textColor: "#b0bec5",
        },
        width: container.clientWidth,
        height: isFullscreen ? window.innerHeight - 100 : 450,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
        grid: {
          horzLines: { color: "#253347" },
          vertLines: { color: "#253347" },
        },
      });

      chartRef.current = chart;

      // Candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#4ade80",
        downColor: "#f87171",
        borderVisible: true,
        wickUpColor: "#4ade80",
        wickDownColor: "#f87171",
      });

      candleSeriesRef.current = candleSeries;
      candleSeries.setData(ohlcvData);

      // Volume histogram
      const volumeData = ohlcvData.map((bar) => ({
        time: bar.time,
        value: bar.volume,
        color:
          bar.close >= bar.open
            ? "rgba(74,222,128,0.3)"
            : "rgba(248,113,113,0.3)",
      }));

      const volumeSeries = chart.addHistogramSeries({
        color: "rgba(100, 150, 255, 0.3)",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "volume",
      });

      volumeSeriesRef.current = volumeSeries;
      volumeSeries.setData(volumeData);

      // Scale volume to right
      chart.priceScale("volume").applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // EMAs
      const closes = ohlcvData.map((bar) => bar.close);
      const ema8 = calcEMA(closes, 8);
      const ema20 = calcEMA(closes, 20);
      const ema50 = calcEMA(closes, 50);

      const ema8Series = chart.addLineSeries({
        color: "#60a5fa",
        lineWidth: 1,
        title: "EMA8",
      });
      ema8SeriesRef.current = ema8Series;
      ema8Series.setData(
        ohlcvData
          .map((bar, i) => ({
            time: bar.time,
            value: ema8[i] || 0,
          }))
          .filter((d) => d.value > 0)
      );

      const ema20Series = chart.addLineSeries({
        color: "#fbbf24",
        lineWidth: 1,
        title: "EMA20",
      });
      ema20SeriesRef.current = ema20Series;
      ema20Series.setData(
        ohlcvData
          .map((bar, i) => ({
            time: bar.time,
            value: ema20[i] || 0,
          }))
          .filter((d) => d.value > 0)
      );

      const ema50Series = chart.addLineSeries({
        color: "#a78bfa",
        lineWidth: 1,
        title: "EMA50",
      });
      ema50SeriesRef.current = ema50Series;
      ema50Series.setData(
        ohlcvData
          .map((bar, i) => ({
            time: bar.time,
            value: ema50[i] || 0,
          }))
          .filter((d) => d.value > 0)
      );

      chart.timeScale().fitContent();
      setLoading(false);
    };

    initChart();
  }, [timeframe, isFullscreen]);

  // Handle fullscreen
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current && isFullscreen) {
        chartRef.current.applyOptions({
          width: window.innerWidth - 40,
          height: window.innerHeight - 100,
        });
      }
    };

    if (isFullscreen) {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isFullscreen]);

  return (
    <div
      style={{
        background: "#111620",
        border: "1px solid #253347",
        borderRadius: 6,
        padding: "12px 14px",
        marginTop: 12,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid #253347",
        }}
      >
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>
          📊 {ticker} Chart
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["1h", "1d", "1w"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf as "1h" | "1d" | "1w")}
              style={{
                padding: "4px 10px",
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                border:
                  timeframe === tf
                    ? "1px solid #4ade80"
                    : "1px solid #253347",
                background:
                  timeframe === tf
                    ? "rgba(74,222,128,0.1)"
                    : "transparent",
                color: timeframe === tf ? "#4ade80" : "#b0bec5",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: "#253347" }} />

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              padding: "4px 8px",
              borderRadius: 3,
              fontSize: 13,
              border: "1px solid #253347",
              background: "transparent",
              color: "#b0bec5",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Tam ekran"
          >
            {isFullscreen ? "⛶" : "⛶"}
          </button>
        </div>
      </div>

      {/* Chart Container */}
      {loading ? (
        <div
          style={{
            height: isFullscreen ? window.innerHeight - 100 : 450,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7c8fa6",
          }}
        >
          ⏳ Grafik yükleniyor...
        </div>
      ) : (
        <div
          ref={chartContainerRef}
          style={{
            width: isFullscreen ? window.innerWidth - 40 : "100%",
            height: isFullscreen ? window.innerHeight - 100 : 450,
            position: isFullscreen ? "fixed" : "relative",
            left: isFullscreen ? 20 : 0,
            top: isFullscreen ? 40 : 0,
            zIndex: isFullscreen ? 9999 : 1,
          }}
        />
      )}

      {/* Legend */}
      {!loading && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 8,
            paddingTop: 10,
            borderTop: "1px solid #253347",
            fontSize: 9,
            color: "#7c8fa6",
          }}
        >
          <span>
            <span style={{ color: "#60a5fa", fontWeight: 700 }}>━</span> EMA8
          </span>
          <span>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>━</span> EMA20
          </span>
          <span>
            <span style={{ color: "#a78bfa", fontWeight: 700 }}>━</span> EMA50
          </span>
          <span>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>━</span> Volume
          </span>
        </div>
      )}
    </div>
  );
}
