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
      
      // Strategy Stats
      const sKey = pos.strategy || "Unknown";
      if (!stats.strategy[sKey]) stats.strategy[sKey] = { count: 0, wins: 0, sumPnl: 0 };
      stats.strategy[sKey].count++;
      if (pos.status === 'tp_hit' || (pos.pnl_pct || 0) > 0) stats.strategy[sKey].wins++;
      stats.strategy[sKey].sumPnl += (pos.pnl_pct || 0);

      // Setup Stats (Mapping entry_mode)
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

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#3b82f6] animate-pulse font-black uppercase tracking-widest text-xl">BOGA ANALYZING OUTCOMES...</div>;

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-sans pb-20">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
              <span className="text-[10px] text-[#3b82f6] font-black tracking-[0.3em] uppercase">BOGA PERFORMANCE CENTER</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
              Options <span className="text-[#3b82f6]">Outcomes</span>
            </h1>
            <p className="text-slate-500 text-sm mt-3 max-w-2xl font-bold uppercase tracking-tight">
              Sinyal ve Strateji Bazlı Gerçekleşen Kâr/Zarar Analiz Terminali.
            </p>
          </div>
          
          <Link 
            href="/optanaliz"
            className="px-10 py-5 bg-[#1e293b] hover:bg-[#334155] text-white font-black rounded-2xl border border-white/10 transition-all text-xs uppercase tracking-[0.2em] shadow-2xl"
          >
            ← Analiz Portalı'na Dön
          </Link>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Genel Başarı (Win Rate)" value={`${summary.win_rate || 0}%`} color="#22c55e" />
          <StatCard label="Ortalama Getiri" value={`${summary.avg_pnl_pct || 0}%`} color={(summary.avg_pnl_pct || 0) >= 0 ? "#22c55e" : "#ef4444"} />
          <StatCard label="Kapalı İşlem" value={summary.closed} color="#3b82f6" />
          <StatCard label="Aktif Pozisyon" value={summary.open} color="#f59e0b" />
        </div>

        {/* Breakdown Section */}
        <div className="mb-12">
          <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] mb-6 flex items-center gap-3 bg-[#1e293b]/50 p-4 rounded-xl border-l-4 border-l-[#3b82f6]">
             Sinyal Tipi ve Kurulum Bazlı Detaylı İstatistikler
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Setup Breakdown */}
             <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <p className="text-[10px] font-black text-[#3b82f6] uppercase mb-8 tracking-widest border-b border-white/5 pb-4">Kurulum Bazlı Performans (Signals)</p>
                <div className="space-y-6">
                   {Object.entries(breakdown.setup).map(([name, stat]: [string, any]) => {
                     const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                     const avg = (stat.sumPnl / stat.count).toFixed(1);
                     return (
                       <div key={name} className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-white group-hover:text-[#3b82f6] transition-colors uppercase italic">{name}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{stat.count} Toplam İşlem</span>
                          </div>
                          <div className="flex items-center gap-10">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-500 uppercase block mb-1">Avg P&L</span>
                              <span className={`text-xs font-black ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                            </div>
                            <div className="text-right min-w-[70px]">
                              <span className="text-[9px] text-slate-500 uppercase block mb-1">Win Rate</span>
                              <span className={`text-sm font-black ${Number(wr) >= 50 ? 'text-[#22c55e]' : 'text-white'}`}>%{wr}</span>
                            </div>
                          </div>
                       </div>
                     )
                   })}
                </div>
             </div>

             {/* Strategy Breakdown */}
             <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <p className="text-[10px] font-black text-indigo-400 uppercase mb-8 tracking-widest border-b border-white/5 pb-4">Strateji Bazlı Performans (Strategies)</p>
                <div className="space-y-6">
                   {Object.entries(breakdown.strategy).map(([name, stat]: [string, any]) => {
                     const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                     const avg = (stat.sumPnl / stat.count).toFixed(1);
                     return (
                       <div key={name} className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-white uppercase group-hover:text-indigo-400 transition-colors italic">{name}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{stat.count} Toplam İşlem</span>
                          </div>
                          <div className="flex items-center gap-10">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-500 uppercase block mb-1">Avg P&L</span>
                              <span className={`text-xs font-black ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                            </div>
                            <div className="text-right min-w-[70px]">
                              <span className="text-[9px] text-slate-500 uppercase block mb-1">Win Rate</span>
                              <span className={`text-sm font-black ${Number(wr) >= 50 ? 'text-[#22c55e]' : 'text-white'}`}>%{wr}</span>
                            </div>
                          </div>
                       </div>
                     )
                   })}
                </div>
             </div>
          </div>
        </div>

        {/* Filters and List */}
        <div className="flex flex-wrap items-center gap-4 mb-8 bg-[#0f172a] p-5 rounded-2xl border border-white/5 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Durum:</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none focus:border-[#3b82f6] transition-all">
              <option value="all">TÜMÜ</option>
              <option value="tp_hit">KÂR AL (TP)</option>
              <option value="sl_hit">STOP LOSS (SL)</option>
              <option value="open">AKTİF (AÇIK)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Strateji:</span>
            <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none focus:border-[#3b82f6] transition-all">
              <option value="all">TÜMÜ</option>
              <option value="institutional">INSTITUTIONAL</option>
              <option value="asymmetric">ASYMMETRIC</option>
            </select>
          </div>
          <div className="ml-auto text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{filteredPositions.length} İşlem İnceleniyor</div>
        </div>

        <div className="glass-card rounded-[40px] border border-white/10 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-white/5">
                  <th className="px-8 py-6">Sembol / Tarih</th>
                  <th className="px-8 py-6">Strateji</th>
                  <th className="px-8 py-6">Sistem</th>
                  <th className="px-8 py-6">Kontrat</th>
                  <th className="px-8 py-6 text-right">P&L (%)</th>
                  <th className="px-8 py-6">Durum</th>
                  <th className="px-8 py-6 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPositions.map((pos) => {
                  const systemName = MODE_MAP[pos.entry_mode || ""] || pos.entry_mode || "MOMENTUM";
                  return (
                    <tr key={pos.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col"><span className="text-xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{pos.ticker}</span><span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{pos.scan_date}</span></div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-widest ${pos.strategy === 'institutional' ? 'text-indigo-400 border-indigo-400/30 bg-indigo-400/5' : 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5'}`}>{pos.strategy}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[9px] font-black text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg uppercase tracking-tighter">{systemName}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col"><span className="text-xs font-black text-slate-300 italic">${pos.strike} Call</span><span className="text-[9px] text-slate-500 font-bold uppercase mt-1">{pos.expiration}</span></div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={`text-lg font-black ${(pos.pnl_pct || pos.unrealized_pnl_pct || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {pos.pnl_pct != null ? `%${pos.pnl_pct.toFixed(1)}` : (pos.unrealized_pnl_pct != null ? `%${pos.unrealized_pnl_pct.toFixed(1)} (U)` : '—')}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${pos.status === 'open' ? 'text-amber-500' : (pos.status === 'tp_hit' ? 'text-[#22c55e]' : 'text-slate-400')}`}>{pos.status.replace('_', ' ')}</span>
                          {pos.exit_reason && <span className="text-[9px] text-slate-600 max-w-[150px] truncate italic">{pos.exit_reason}</span>}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link href={`/optanaliz?symbol=${pos.ticker}`} className="inline-block text-[10px] font-black text-[#3b82f6] border border-[#3b82f6]/30 px-5 py-2.5 rounded-xl hover:bg-[#3b82f6]/10 uppercase transition-all shadow-sm">Detay Analiz →</Link>
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
    <div className="glass-card p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: color }} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">{label}</p>
      <p className="text-5xl font-black tracking-tighter" style={{ color: color }}>{value}</p>
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-[60px] opacity-30" style={{ backgroundColor: color }} />
    </div>
  );
}
