'use client'

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp, ColorType, CrosshairMode } from 'lightweight-charts';
import { Card } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import { Clock, Maximize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GraphicEngineProps {
  ticker: string;
  initialTimeframe?: '5m' | '15m' | '1h' | '1d' | '1w';
  height?: number;
  showTools?: boolean;
}

export const GraphicEngine: React.FC<GraphicEngineProps> = ({ 
  ticker, 
  initialTimeframe = '1h',
  height = 400,
  showTools = true
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: '#18181b' },
        horzLines: { color: '#18181b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelBackgroundColor: '#2563eb' },
        horzLine: { labelBackgroundColor: '#2563eb' },
      },
      rightPriceScale: {
        borderColor: '#27272a',
      },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 2. Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = candleSeries;

    // 3. Mock Data Fetch (Replace with actual API call)
    const fetchHistory = async () => {
      setLoading(true);
      // Simulating API latency
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockData: CandlestickData[] = [];
      const now = Math.floor(Date.now() / 1000);
      for (let i = 0; i < 100; i++) {
        mockData.push({
          time: (now - (100 - i) * 3600) as UTCTimestamp,
          open: 150 + Math.random() * 10,
          high: 165 + Math.random() * 10,
          low: 145 + Math.random() * 10,
          close: 155 + Math.random() * 10,
        });
      }
      candleSeries.setData(mockData);
      chart.timeScale().fitContent();
      setLoading(false);
    };

    fetchHistory();

    // 4. Resize Handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [ticker, timeframe, height]);

  return (
    <Card className="overflow-hidden border-finma-border/40" padding="none">
      {showTools && (
        <div className="flex items-center justify-between p-3 border-b border-finma-border/50 bg-finma-bg/40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white tracking-widest">{ticker}</span>
            <div className="flex bg-finma-card/50 rounded p-0.5 gap-0.5 border border-finma-border/30">
              {(['5m', '15m', '1h', '1d', '1w'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                    timeframe === tf ? "bg-finma-primary text-white" : "text-finma-text-dim hover:text-white"
                  )}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 px-2 rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 text-finma-text-dim">
               <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
               <span className="text-[10px] uppercase font-bold">Refresh</span>
            </button>
            <button className="p-1.5 rounded-md hover:bg-white/5 transition-colors text-finma-text-dim">
               <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <div className="relative group">
        <div ref={chartContainerRef} className="w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
             <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-finma-primary border-t-transparent animate-spin" />
                <span className="text-[10px] font-bold text-finma-primary/80 tracking-widest uppercase">Loading Core Data...</span>
             </div>
          </div>
        )}
      </div>
    </Card>
  );
};
