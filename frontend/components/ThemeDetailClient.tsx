"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TickerHoverChart from "./TickerHoverChart";

interface ThemeDetailClientProps {
  themeName: string;
  initialTickers: string[];
}

export default function ThemeDetailClient({ themeName, initialTickers }: ThemeDetailClientProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cache anlık
    try {
      const raw = localStorage.getItem("t_theme_overrides");
      if (raw) {
        const overrides = JSON.parse(raw);
        const customList = overrides[themeName] || [];
        setCustomTickers(customList);
        const merged = Array.from(new Set([...initialTickers, ...customList]));
        setTickers(merged);
        fetchThemeStocks(merged);
      } else {
        setTickers(initialTickers);
        fetchThemeStocks(initialTickers);
      }
    } catch { setTickers(initialTickers); fetchThemeStocks(initialTickers); }

    // API = gerçek kaynak
    fetch("/api/store/theme_overrides")
      .then(r => r.json())
      .then(({ value }) => {
        const overrides: Record<string, string[]> = value ?? {};
        try { localStorage.setItem("t_theme_overrides", JSON.stringify(overrides)); } catch {}
        const customList = overrides[themeName] || [];
        setCustomTickers(customList);
        const merged = Array.from(new Set([...initialTickers, ...customList]));
        setTickers(merged);
        fetchThemeStocks(merged);
      })
      .catch(() => {});
  }, [themeName, initialTickers]);

  const fetchThemeStocks = async (list: string[]) => {
    if (list.length === 0) {
      setStocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${list.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        
        // Sort by market cap descending if available, else by ticker
        data.sort((a: any, b: any) => {
          const mcA = a.fundamental?.market_cap || 0;
          const mcB = b.fundamental?.market_cap || 0;
          if (mcA !== mcB) return mcB - mcA;
          return a.ticker.localeCompare(b.ticker);
        });

        setStocks(data);
      }
    } catch (e) {
      console.error("Error loading theme stocks:", e);
    } finally {
      setLoading(false);
    }
  };

  function syncOverrides(overrides: Record<string, string[]>) {
    try { localStorage.setItem("t_theme_overrides", JSON.stringify(overrides)); } catch {}
    fetch("/api/store/theme_overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: overrides }) }).catch(() => {});
  }

  const removeCustomTicker = (ticker: string) => {
    let overrides: Record<string, string[]> = {};
    try { overrides = JSON.parse(localStorage.getItem("t_theme_overrides") || "{}"); } catch {}
    if (overrides[themeName]) {
      overrides[themeName] = overrides[themeName].filter((t: string) => t !== ticker.toUpperCase());
      syncOverrides(overrides);
    }
    setCustomTickers(customTickers.filter(t => t !== ticker.toUpperCase()));
    const merged = tickers.filter(t => t !== ticker.toUpperCase());
    setTickers(merged);
    setStocks(stocks.filter(s => s.ticker !== ticker.toUpperCase()));
  };

  const n = (v: any, d = 2): string => {
    if (v == null || v === "" || isNaN(Number(v))) return "—";
    return Number(v).toFixed(d);
  };

  const pct = (v: any, d = 2): string => {
    if (v == null || v === "" || isNaN(Number(v))) return "—";
    const x = Number(v);
    return (x >= 0 ? "+" : "") + x.toFixed(d) + "%";
  };

  const formatLargeNum = (num: number): string => {
    if (!num) return "—";
    if (num >= 1e12) return "$" + (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return "$" + (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return "$" + (num / 1e6).toFixed(2) + "M";
    return num.toLocaleString();
  };

  const getCellColor = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "text-slate-500";
    if (val > 0) return "text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded";
    if (val < 0) return "text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded";
    return "text-slate-400";
  };

  const getRSIColor = (rsi: number | undefined) => {
    if (rsi === undefined || isNaN(rsi)) return "text-slate-500";
    if (rsi > 70) return "text-red-400 font-bold";
    if (rsi < 30) return "text-emerald-400 font-bold";
    return "text-slate-300";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase italic flex items-center gap-2">
            {themeName}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-500 bg-white/5 px-2.5 py-1 rounded border border-white/10 uppercase tracking-widest font-black">
              {stocks.length} Tickers Active
            </span>
            {customTickers.length > 0 && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/20 uppercase tracking-widest font-black">
                {customTickers.length} Custom Added
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Synchronizing real-time analytics...</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-12 min-h-[250px] text-center bg-[#080c14]">
          <p className="text-sm font-black text-white uppercase tracking-wider">No Tickers in Theme</p>
          <p className="text-xs text-slate-500 mt-1">Go to BOGA AI Ask report page to add custom stocks to this theme.</p>
        </div>
      ) : (
        <div className="bg-[#080c14] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse leading-none">
              <thead className="bg-[#0c121d]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-left border-b border-white/10">TICKER</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-left border-b border-white/10">COMPANY</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-left border-b border-white/10">SECTOR</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">PRICE</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">MKT CAP</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">P/E</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">1D %</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">1W %</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">1M %</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-right border-b border-white/10">RSI</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-center border-b border-white/10">SCORE</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-center border-b border-white/10">RATING</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tight text-center border-b border-white/10">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => {
                  const p = stock.price || {};
                  const f = stock.fundamental || {};
                  const t = stock.technical || {};
                  const s = stock.scores || {};
                  
                  const isCustom = customTickers.includes(stock.ticker);

                  return (
                    <tr key={stock.ticker} className="hover:bg-white/[0.04] transition-colors group">
                      <td className="px-4 py-3 text-[11px] font-black text-white border-b border-white/[0.03] flex items-center gap-1.5">
                        <TickerHoverChart ticker={stock.ticker}><Link href={`/stock/${stock.ticker}`} className="hover:text-[#3b82f6] transition-colors">{stock.ticker}</Link></TickerHoverChart>
                        {isCustom && (
                          <span className="text-[7px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded uppercase font-black tracking-widest">
                            Custom
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-400 font-medium border-b border-white/[0.03] max-w-[150px] truncate" title={stock.company}>{stock.company}</td>
                      <td className="px-4 py-3 text-[9px] text-slate-500 font-bold uppercase border-b border-white/[0.03]">{stock.sector}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-white text-right border-b border-white/[0.03]">${n(p.current)}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-400 text-right border-b border-white/[0.03]">{formatLargeNum(f.market_cap)}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-400 text-right border-b border-white/[0.03]">{n(f.pe_ratio, 1)}</td>
                      <td className={`px-4 py-3 text-[11px] text-right border-b border-white/[0.03] ${getCellColor(p.change_pct)}`}>{pct(p.change_pct)}</td>
                      <td className={`px-4 py-3 text-[11px] text-right border-b border-white/[0.03] ${getCellColor(p.change_pct_1w)}`}>{pct(p.change_pct_1w)}</td>
                      <td className={`px-4 py-3 text-[11px] text-right border-b border-white/[0.03] ${getCellColor(p.change_pct_1m)}`}>{pct(p.change_pct_1m)}</td>
                      <td className={`px-4 py-3 text-[11px] text-right border-b border-white/[0.03] ${getRSIColor(t.rsi_14)}`}>{n(t.rsi_14, 1)}</td>
                      <td className="px-4 py-3 text-[11px] font-black text-white text-center border-b border-white/[0.03]">{n(s.master_score, 0)}</td>
                      <td className="px-4 py-3 text-center border-b border-white/[0.03]">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          s.score_type === 'HIGH_CONVICTION' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                          s.score_type === 'POSITIVE_BIAS' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                          s.score_type === 'NEGATIVE_BIAS' || s.score_type === 'UNDERPERFORM' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                          'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {s.score_type?.replace('_', ' ') || 'NEUTRAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-b border-white/[0.03]">
                        {isCustom ? (
                          <button 
                            onClick={() => removeCustomTicker(stock.ticker)}
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-bold uppercase">Static</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
