"use client";

import React, { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import Link from "next/link";

interface Position {
  id: string;
  scan_date: string;
  ticker: string;
  strategy: string;
  status: string;
  entry_premium: number;
  current_premium: number | null;
  exit_premium: number | null;
  pnl_pct: number | null;
  unrealized_pnl_pct: number | null;
  strike: number;
  expiration: string;
  exit_reason: string | null;
  setup?: string;
  system?: string;
}

interface Summary {
  total: number;
  open: number;
  closed: number;
  win_rate: number | null;
  avg_pnl_pct: number | null;
  tp_hit: number;
  sl_hit: number;
  time_stop: number;
  expired: number;
}

export default function OptionsPerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStrategy, setFilterStrategy] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/data/latest/options_outcomes.json?v=" + Date.now());
        if (!res.ok) throw new Error("Veri bulunamadı. Lütfen botun çalışmasını bekleyin.");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const summary: Summary = data?.summary || { total: 0, open: 0, closed: 0, win_rate: 0, avg_pnl_pct: 0, tp_hit: 0, sl_hit: 0, time_stop: 0, expired: 0 };
  const positions: Position[] = Array.isArray(data?.positions) ? data.positions : [];

  const breakdown = useMemo(() => {
    const stats: any = { strategy: {}, setup: {} };
    positions.forEach(pos => {
      if (!pos || pos.status === 'open') return;
      
      // Strategy Stats
      const sKey = pos.strategy || "Unknown";
      if (!stats.strategy[sKey]) stats.strategy[sKey] = { count: 0, wins: 0, sumPnl: 0 };
      stats.strategy[sKey].count++;
      if (pos.status === 'tp_hit' || (pos.pnl_pct || 0) > 0) stats.strategy[sKey].wins++;
      stats.strategy[sKey].sumPnl += (pos.pnl_pct || 0);

      // Setup/System Stats
      const setupKey = pos.setup || pos.system || "MOMENTUM";
      if (!stats.setup[setupKey]) stats.setup[setupKey] = { count: 0, wins: 0, sumPnl: 0 };
      stats.setup[setupKey].count++;
      if (pos.status === 'tp_hit' || (pos.pnl_pct || 0) > 0) stats.setup[setupKey].wins++;
      stats.setup[setupKey].sumPnl += (pos.pnl_pct || 0);
    });
    return stats;
  }, [positions]);

  const filteredPositions = positions.filter(pos => {
    if (filterStatus !== "all" && pos.status !== filterStatus) return false;
    if (filterStrategy !== "all" && pos.strategy !== filterStrategy) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080b12]">
        <div className="animate-pulse text-[#3b82f6] font-black tracking-widest text-xl uppercase">BOGA PERFORMANCE ANALYZING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-sans pb-20">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
              <span className="text-[10px] text-[#3b82f6] font-black tracking-[0.3em] uppercase">Performance Tracker v1.1</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic">
              Options <span className="text-[#3b82f6]">Outcomes</span>
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl italic">
              Geçmiş opsiyon stratejilerinin canlı P&L takibi ve sonuçlanmış işlemlerin performans analizi.
            </p>
          </div>
          
          <Link 
            href="/optanaliz"
            className="px-6 py-3 bg-[#1e293b] hover:bg-[#334155] text-white font-black rounded-xl border border-white/10 transition-all text-xs uppercase tracking-widest"
          >
            ← Aktif Analizlere Dön
          </Link>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center">
            <p className="text-red-500 font-bold">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Win Rate" value={`${summary.win_rate || 0}%`} color="#22c55e" />
              <StatCard label="Avg Return" value={`${summary.avg_pnl_pct || 0}%`} color={(summary.avg_pnl_pct || 0) >= 0 ? "#22c55e" : "#ef4444"} />
              <StatCard label="Closed Trades" value={summary.closed} color="#3b82f6" />
              <StatCard label="Open Positions" value={summary.open} color="#f59e0b" />
            </div>

            <div className="mb-12">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#3b82f6]" /> Kurulum ve Strateji Başarı Oranları
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Setup Breakdown */}
                 <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-6 shadow-xl">
                    <p className="text-[10px] font-black text-[#3b82f6] uppercase mb-6 tracking-widest">Sinyal Tipi (Setup)</p>
                    <div className="space-y-5">
                       {Object.entries(breakdown.setup).map(([name, stat]: [string, any]) => {
                         const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                         const avg = (stat.sumPnl / stat.count).toFixed(1);
                         return (
                           <div key={name} className="flex items-center justify-between group border-b border-white/5 pb-3 last:border-0">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-white group-hover:text-[#3b82f6] transition-colors uppercase italic">{name}</span>
                                <span className="text-[10px] text-slate-500">{stat.count} Kapalı İşlem</span>
                              </div>
                              <div className="flex items-center gap-8">
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Avg P&L</span>
                                  <span className={`text-xs font-black ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                                </div>
                                <div className="text-right min-w-[60px]">
                                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Win Rate</span>
                                  <span className="text-sm font-black text-white">%{wr}</span>
                                </div>
                              </div>
                           </div>
                         )
                       })}
                       {Object.keys(breakdown.setup).length === 0 && <p className="text-xs text-slate-600 italic">Veri toplanıyor...</p>}
                    </div>
                 </div>

                 {/* Strategy Breakdown */}
                 <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-6 shadow-xl">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-widest">Strateji (Strategy)</p>
                    <div className="space-y-5">
                       {Object.entries(breakdown.strategy).map(([name, stat]: [string, any]) => {
                         const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                         const avg = (stat.sumPnl / stat.count).toFixed(1);
                         return (
                           <div key={name} className="flex items-center justify-between group border-b border-white/5 pb-3 last:border-0">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-white uppercase group-hover:text-indigo-400 transition-colors italic">{name}</span>
                                <span className="text-[10px] text-slate-500">{stat.count} Kapalı İşlem</span>
                              </div>
                              <div className="flex items-center gap-8">
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Avg P&L</span>
                                  <span className={`text-xs font-black ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                                </div>
                                <div className="text-right min-w-[60px]">
                                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Win Rate</span>
                                  <span className="text-sm font-black text-white">%{wr}</span>
                                </div>
                              </div>
                           </div>
                         )
                       })}
                    </div>
                 </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-8 bg-[#0f172a] p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Durum:</span>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#1e293b] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white outline-none focus:border-[#3b82f6] transition-all">
                  <option value="all">Tümü</option>
                  <option value="open">Açık</option>
                  <option value="tp_hit">Kâr Al (TP)</option>
                  <option value="sl_hit">Stop Loss (SL)</option>
                  <option value="time_stop">Zaman Stopu</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Strateji:</span>
                <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-[#1e293b] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white outline-none focus:border-[#3b82f6] transition-all">
                  <option value="all">Tümü</option>
                  <option value="institutional">Institutional</option>
                  <option value="asymmetric">Asymmetric</option>
                </select>
              </div>
              <div className="ml-auto text-[10px] font-bold text-slate-500 italic">{filteredPositions.length} işlem gösteriliyor</div>
            </div>

            <div className="glass-card rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-4">Symbol / Date</th>
                      <th className="px-6 py-4">Strategy</th>
                      <th className="px-6 py-4">Contract</th>
                      <th className="px-6 py-4">Entry</th>
                      <th className="px-6 py-4">Current/Exit</th>
                      <th className="px-6 py-4">P&L</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPositions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex flex-col"><span className="text-lg font-black text-white">{pos.ticker}</span><span className="text-[10px] text-slate-500">{pos.scan_date}</span></div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[10px] font-black px-2 py-1 rounded border uppercase ${pos.strategy === 'institutional' ? 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10' : 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10'}`}>{pos.strategy}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col"><span className="text-xs font-bold text-slate-300">${pos.strike} Call</span><span className="text-[10px] text-slate-500">Exp: {pos.expiration}</span></div>
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-white">${pos.entry_premium.toFixed(2)}</td>
                        <td className="px-6 py-5 text-sm font-bold text-white">${(pos.exit_premium || pos.current_premium || 0).toFixed(2)}</td>
                        <td className="px-6 py-5">
                          <span className={`text-sm font-black ${(pos.pnl_pct || pos.unrealized_pnl_pct || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                            {pos.pnl_pct != null ? `${pos.pnl_pct}%` : (pos.unrealized_pnl_pct != null ? `${pos.unrealized_pnl_pct}% (U)` : '—')}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${pos.status === 'open' ? 'text-amber-500' : (pos.status === 'tp_hit' ? 'text-[#22c55e]' : 'text-slate-400')}`}>{pos.status.replace('_', ' ')}</span>
                            {pos.exit_reason && <span className="text-[9px] text-slate-500 max-w-[120px] truncate">{pos.exit_reason}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <Link href={`/optanaliz?symbol=${pos.ticker}`} className="text-[9px] font-black text-[#3b82f6] border border-[#3b82f6]/30 px-2 py-1 rounded hover:bg-[#3b82f6]/10 uppercase transition-all">Analiz →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string | number, color: string }) {
  return (
    <div className="glass-card p-6 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <p className="text-4xl font-black tracking-tighter" style={{ color: color }}>{value}</p>
      <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full blur-2xl opacity-20" style={{ backgroundColor: color }} />
    </div>
  );
}
