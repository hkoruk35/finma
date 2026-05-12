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
  entry_mode?: string;
  entry_mode_label?: string;
}

const MODE_MAP: Record<string, string> = {
  "TREND_START": "SQUEEZE / TREND BAŞLANGICI",
  "GOLDEN_CROSS": "EMA KESİŞİMİ (GOLDEN)",
  "TREND_BIRTH": "GİZLİ KIRILIM (AWAKENING)",
  "NEAR_GOLDEN": "KESİŞİM ÖNCESİ (PULLBACK)",
  "EMA200_BREAKOUT": "200 GÜNLÜK KIRILIM",
  "EMA50_BOUNCE": "DESTEK DÖNÜŞÜ",
  "MOMENTUM": "MOMENTUM / TREND TAKİBİ"
};

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
        if (!res.ok) throw new Error("Veri bulunamadı.");
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

  const summary = data?.summary || {};
  const positions: Position[] = Array.isArray(data?.positions) ? data.positions : [];

  const breakdown = useMemo(() => {
    const stats: any = { strategy: {}, setup: {} };
    positions.forEach(pos => {
      if (!pos || pos.status === 'open') return;
      
      const sKey = pos.strategy || "Unknown";
      if (!stats.strategy[sKey]) stats.strategy[sKey] = { count: 0, wins: 0, sumPnl: 0 };
      stats.strategy[sKey].count++;
      if (pos.status === 'tp_hit' || (pos.pnl_pct || 0) > 0) stats.strategy[sKey].wins++;
      stats.strategy[sKey].sumPnl += (pos.pnl_pct || 0);

      const setupKey = MODE_MAP[pos.entry_mode || ""] || pos.entry_mode || "MOMENTUM";
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

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#3b82f6] animate-pulse font-black uppercase tracking-widest text-2xl">BOGA ANALYZING...</div>;

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-sans pb-20">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_15px_#3b82f6]" />
              <span className="text-xs text-[#3b82f6] font-black tracking-[0.4em] uppercase">BOGA PERFORMANCE CENTER</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-none">
              Options <span className="text-[#3b82f6]">Outcomes</span>
            </h1>
            <p className="text-slate-300 text-lg mt-6 max-w-3xl font-bold uppercase tracking-wide">
              Sinyal ve Strateji Bazlı Gerçekleşen Kâr/Zarar Analiz Terminali.
            </p>
          </div>
          
          <Link 
            href="/optanaliz"
            className="px-12 py-6 bg-[#1e293b] hover:bg-[#334155] text-white font-black rounded-2xl border border-white/20 transition-all text-sm uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95"
          >
            ← Analiz Portalı'na Dön
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          <StatCard label="Win Rate" value={`${summary.win_rate || 0}%`} color="#22c55e" />
          <StatCard label="Avg Return" value={`${summary.avg_pnl_pct || 0}%`} color={(summary.avg_pnl_pct || 0) >= 0 ? "#22c55e" : "#ef4444"} />
          <StatCard label="Closed" value={summary.closed} color="#3b82f6" />
          <StatCard label="Active" value={summary.open} color="#f59e0b" />
        </div>

        <div className="mb-20">
          <h3 className="text-sm font-black text-white uppercase tracking-[0.4em] mb-8 flex items-center gap-4 bg-[#1e293b]/80 p-6 rounded-2xl border-l-8 border-l-[#3b82f6] shadow-xl">
             Sistem ve Kurulum Bazlı Başarı Analizi
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
             <div className="bg-[#0f172a] rounded-[40px] border border-white/10 p-10 shadow-2xl">
                <p className="text-xs font-black text-[#3b82f6] uppercase mb-10 tracking-[0.2em] border-b border-white/10 pb-6">Kurulum Performansı (Signals)</p>
                <div className="space-y-8">
                   {Object.entries(breakdown.setup).map(([name, stat]: [string, any]) => {
                     const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                     const avg = (stat.sumPnl / stat.count).toFixed(1);
                     return (
                       <div key={name} className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-base font-black text-white group-hover:text-[#3b82f6] transition-colors uppercase italic tracking-tight">{name}</span>
                            <span className="text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">{stat.count} İşlem</span>
                          </div>
                          <div className="flex items-center gap-12">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 uppercase font-black block mb-2">Avg P&L</span>
                              <span className={`text-sm font-black ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <span className="text-[10px] text-slate-500 uppercase font-black block mb-2">Win Rate</span>
                              <span className={`text-base font-black ${Number(wr) >= 50 ? 'text-[#22c55e]' : 'text-white'}`}>%{wr}</span>
                            </div>
                          </div>
                       </div>
                     )
                   })}
                </div>
             </div>

             <div className="bg-[#0f172a] rounded-[40px] border border-white/10 p-10 shadow-2xl">
                <p className="text-xs font-black text-indigo-400 uppercase mb-10 tracking-[0.2em] border-b border-white/10 pb-6">Strateji Performansı (Strategies)</p>
                <div className="space-y-8">
                   {Object.entries(breakdown.strategy).map(([name, stat]: [string, any]) => {
                     const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                     const avg = (stat.sumPnl / stat.count).toFixed(1);
                     return (
                       <div key={name} className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-base font-black text-white uppercase group-hover:text-indigo-400 transition-colors italic tracking-tight">{name}</span>
                            <span className="text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">{stat.count} İşlem</span>
                          </div>
                          <div className="flex items-center gap-12">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 uppercase font-black block mb-2">Avg P&L</span>
                              <span className={`text-sm font-black ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <span className="text-[10px] text-slate-500 uppercase font-black block mb-2">Win Rate</span>
                              <span className={`text-base font-black ${Number(wr) >= 50 ? 'text-[#22c55e]' : 'text-white'}`}>%{wr}</span>
                            </div>
                          </div>
                       </div>
                     )
                   })}
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 mb-10 bg-[#0f172a] p-6 rounded-3xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Durum:</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#1e293b] border border-white/20 rounded-xl px-5 py-3 text-xs font-black text-white outline-none focus:border-[#3b82f6] transition-all cursor-pointer">
              <option value="all">TÜMÜ</option>
              <option value="tp_hit">KÂR AL (TP)</option>
              <option value="sl_hit">STOP LOSS (SL)</option>
              <option value="open">AÇIK POZİSYONLAR</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Strateji:</span>
            <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-[#1e293b] border border-white/20 rounded-xl px-5 py-3 text-xs font-black text-white outline-none focus:border-[#3b82f6] transition-all cursor-pointer">
              <option value="all">TÜMÜ</option>
              <option value="institutional">INSTITUTIONAL</option>
              <option value="asymmetric">ASYMMETRIC</option>
            </select>
          </div>
        </div>

        <div className="glass-card rounded-[50px] border border-white/10 overflow-hidden shadow-[0_50px_120px_rgba(0,0,0,0.6)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.04] text-xs font-black uppercase tracking-[0.25em] text-slate-300 border-b border-white/10">
                  <th className="px-10 py-8">Sembol / Tarih</th>
                  <th className="px-10 py-8 text-center">Strateji</th>
                  <th className="px-10 py-8 text-center">Sistem</th>
                  <th className="px-10 py-8">Kontrat</th>
                  <th className="px-10 py-8 text-right">P&L (%)</th>
                  <th className="px-10 py-8 text-center">Durum</th>
                  <th className="px-10 py-8 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPositions.map((pos) => {
                  const systemName = MODE_MAP[pos.entry_mode || ""] || pos.entry_mode || "MOMENTUM";
                  return (
                    <tr key={pos.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-2xl font-black text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter">{pos.ticker}</span>
                          <span className="text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">{pos.scan_date}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className={`text-[10px] font-black px-4 py-2 rounded-xl border uppercase tracking-[0.15em] shadow-sm ${pos.strategy === 'institutional' ? 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10' : 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10'}`}>{pos.strategy}</span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className="text-[10px] font-black text-white bg-white/5 border border-white/10 px-4 py-2 rounded-xl uppercase tracking-tighter shadow-sm">{systemName}</span>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-200 italic tracking-tight">${pos.strike} Call</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">{pos.expiration}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <span className={`text-2xl font-black ${(pos.pnl_pct || pos.unrealized_pnl_pct || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} tracking-tighter`}>
                          {pos.pnl_pct != null ? `%${pos.pnl_pct.toFixed(1)}` : (pos.unrealized_pnl_pct != null ? `%${pos.unrealized_pnl_pct.toFixed(1)} (U)` : '—')}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <div className="flex flex-col gap-2">
                          <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${pos.status === 'open' ? 'text-amber-400' : (pos.status === 'tp_hit' ? 'text-[#22c55e]' : 'text-slate-400')}`}>{pos.status.replace('_', ' ')}</span>
                          {pos.exit_reason && <span className="text-[10px] text-slate-500 max-w-[180px] mx-auto truncate italic font-bold uppercase tracking-tighter">{pos.exit_reason}</span>}
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <Link href={`/optanaliz?symbol=${pos.ticker}`} className="inline-block text-[11px] font-black text-[#3b82f6] border-2 border-[#3b82f6]/40 px-6 py-3 rounded-2xl hover:bg-[#3b82f6] hover:text-white uppercase transition-all shadow-lg active:scale-95">Analiz Et →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string | number, color: string }) {
  return (
    <div className="glass-card p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-all">
      <div className="absolute top-0 left-0 w-3 h-full" style={{ backgroundColor: color }} />
      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">{label}</p>
      <p className="text-6xl font-black tracking-tighter" style={{ color: color }}>{value}</p>
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-[80px] opacity-40" style={{ backgroundColor: color }} />
    </div>
  );
}
