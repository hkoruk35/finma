"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function HourlyTrackerClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState<any>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    // Client-side fetch mechanism for fresh data
    const fetchData = async () => {
      try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/data/boga_hourly_portfolio.json?t=${timestamp}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch fresh hourly data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data?.timestamp_ny) {
      try {
        // Parse the NY time assuming it's roughly close to UTC for visual freshness,
        // or just display it as raw string.
        setLastUpdated(data.timestamp_ny + " (NY Time)");
      } catch (e) {
        setLastUpdated(data.timestamp_ny);
      }
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data || !data.portfolio_status || data.portfolio_status.length === 0) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-10 text-center">
        <h2 className="text-xl text-white font-bold mb-2">Veri Bulunamadı</h2>
        <p className="text-gray-400">Saatlik tarama henüz tamamlanmamış olabilir.</p>
      </div>
    );
  }

  // Get color for status
  const getStatusColor = (status: string) => {
    if (status.includes("🔴")) return "text-red-400 bg-red-400/10 border-red-400/20";
    if (status.includes("🟢")) return "text-green-400 bg-green-400/10 border-green-400/20";
    if (status.includes("⚠️")) return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    if (status.includes("⏳")) return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#161b22] border border-[#30363d] p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            Hourly Intraday Pulse
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Real-time status of {data.total_tracked} focus stocks, updated hourly during market open.
          </p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-xs text-gray-500 font-medium">Last Update:</span>
            <span className="text-sm text-white font-mono">{lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.portfolio_status.map((item: any, idx: number) => {
          const statusStyle = getStatusColor(item.hourly_action);
          const isPositive = (item.change_24h || 0) >= 0;
          
          return (
            <Link href={`/stock/${item.symbol}`} key={idx} className="block group">
              <div className="bg-[#161b22] border border-[#30363d] group-hover:border-[#8b5cf6] transition-colors rounded-xl p-4 h-full flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-[#8b5cf6] transition-colors">
                    {item.symbol}
                  </h3>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-white">${item.price}</div>
                    <div className={`text-xs font-mono font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{item.change_24h?.toFixed(2)}%
                    </div>
                  </div>
                </div>
                
                <div className={`mt-auto px-3 py-2 rounded-lg border text-sm font-semibold mb-3 flex items-center justify-center text-center leading-tight ${statusStyle}`}>
                  {item.hourly_action}
                </div>
                
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                  {item.directive_msg}
                </p>
                
                <div className="mt-4 pt-3 border-t border-[#30363d] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Entry Zone</span>
                    <span className="text-gray-300 font-mono">{item.entry_zone || 'N/A'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 block mb-0.5">Score</span>
                    <span className="text-white font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{item.boga_score}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
