"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

      {/* List / Table View */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[#00d2ff] text-[11px] uppercase tracking-wider text-left bg-[#161b22]/50">
                <th className="px-4 py-4 w-32">Ticker</th>
                <th className="px-4 py-4 text-right">Price</th>
                <th className="px-4 py-4">Hourly Pulse Status</th>
                <th className="px-4 py-4">Entry Zone</th>
                <th className="px-4 py-4">Stop Loss</th>
                <th className="px-4 py-4">Target</th>
                <th className="px-4 py-4 hidden md:table-cell">AI Justification</th>
              </tr>
            </thead>
            <tbody>
              {data.portfolio_status.map((item: any, idx: number) => {
                const statusStyle = getStatusColor(item.hourly_action);
                const isPositive = (item.change_24h || 0) >= 0;
                
                return (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-4">
                      <Link href={`/stock/${item.symbol}`} className="block">
                        <div className="font-black text-white text-base tracking-tight group-hover:text-[#3b82f6] transition-colors">{item.symbol}</div>
                        <div className={`text-xs font-mono font-medium ${isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          {isPositive ? '+' : ''}{item.change_24h?.toFixed(2)}%
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-[15px] font-mono font-bold text-white">${item.price?.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`inline-flex px-3 py-1 rounded border text-xs font-black uppercase tracking-wider ${statusStyle}`}>
                        {item.hourly_action}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-white font-mono text-[13px]">{item.entry_zone || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[#ef4444] font-mono text-[13px]">${item.stop_loss?.toFixed(2) || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[#10b981] font-mono text-[13px]">${item.take_profit?.toFixed(2) || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <p className="text-xs text-[#8b949e] leading-relaxed max-w-sm line-clamp-2">
                        {item.directive_msg}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
