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
  const [copying, setCopying] = useState(false);

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

  // ── Export Functions ────────────────────────────────────────────────────────

  const getExportData = () => {
    const headers = ["Ticker", "Scan Date", "Strategy", "System", "Strike", "Expiration", "P&L %", "Status"];
    const rows = filteredPositions.map(pos => [
      pos.ticker,
      pos.scan_date,
      pos.strategy,
      MODE_MAP[pos.entry_mode || ""] || pos.entry_mode || "MOMENTUM",
      pos.strike,
      pos.expiration,
      (pos.pnl_pct || pos.unrealized_pnl_pct || 0).toFixed(1),
      pos.status
    ]);
    return { headers, rows };
  };

  const copyToClipboard = () => {
    const { headers, rows } = getExportData();
    const content = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
    navigator.clipboard.writeText(content);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const downloadCSV = () => {
    const { headers, rows } = getExportData();
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `boga_performance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadXLS = () => {
    const { headers, rows } = getExportData();
    let html = "<table><thead><tr>";
    headers.forEach(h => html += `<th>${h}</th>`);
    html += "</tr></thead><tbody>";
    rows.forEach(r => {
      html += "<tr>";
      r.forEach(c => html += `<td>${c}</td>`);
      html += "</tr>";
    });
    html += "</tbody></table>";

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `boga_performance_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#3b82f6] animate-pulse font-bold tracking-tight text-xl">BOGA ANALYZING...</div>;

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-sans pb-16">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">BOGA Performance Center</span>
            </div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase italic">
              Options <span className="text-[#3b82f6] not-italic">Outcomes</span>
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium tracking-wide">
              Gerçekleşen Kâr/Zarar ve Strateji Analiz Terminali.
            </p>
          </div>
          
          <Link 
            href="/optanaliz"
            className="px-8 py-3.5 bg-[#1e293b] hover:bg-[#334155] text-white font-bold rounded-xl border border-white/10 transition-all text-xs uppercase tracking-widest shadow-lg"
          >
            ← Analiz Portalı
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Win Rate" value={`${summary.win_rate || 0}%`} color="#22c55e" />
          <StatCard label="Avg P&L" value={`${summary.avg_pnl_pct || 0}%`} color={(summary.avg_pnl_pct || 0) >= 0 ? "#22c55e" : "#ef4444"} />
          <StatCard label="Closed" value={summary.closed} color="#3b82f6" />
          <StatCard label="Active" value={summary.open} color="#f59e0b" />
        </div>

        <div className="mb-12">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
             <div className="w-1 h-4 bg-[#3b82f6]" /> Kurulum ve Strateji Başarısı
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-8 shadow-xl">
                <p className="text-[10px] font-bold text-[#3b82f6] uppercase mb-8 tracking-widest border-b border-white/5 pb-4">Setup Performansı</p>
                <div className="space-y-6">
                   {Object.entries(breakdown.setup).map(([name, stat]: [string, any]) => {
                     const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                     const avg = (stat.sumPnl / stat.count).toFixed(1);
                     return (
                       <div key={name} className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors">{name}</span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase mt-1">{stat.count} İşlem</span>
                          </div>
                          <div className="flex items-center gap-10">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Avg</span>
                              <span className={`text-xs font-bold ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                            </div>
                            <div className="text-right min-w-[60px]">
                              <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Rate</span>
                              <span className={`text-sm font-bold ${Number(wr) >= 50 ? 'text-[#22c55e]' : 'text-white'}`}>%{wr}</span>
                            </div>
                          </div>
                       </div>
                     )
                   })}
                </div>
             </div>

             <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-8 shadow-xl">
                <p className="text-[10px] font-bold text-indigo-400 uppercase mb-8 tracking-widest border-b border-white/5 pb-4">Strateji Performansı</p>
                <div className="space-y-6">
                   {Object.entries(breakdown.strategy).map(([name, stat]: [string, any]) => {
                     const wr = ((stat.wins / stat.count) * 100).toFixed(0);
                     const avg = (stat.sumPnl / stat.count).toFixed(1);
                     return (
                       <div key={name} className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white uppercase group-hover:text-indigo-400 transition-colors">{name}</span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase mt-1">{stat.count} İşlem</span>
                          </div>
                          <div className="flex items-center gap-10">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Avg</span>
                              <span className={`text-xs font-bold ${Number(avg) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>%{avg}</span>
                            </div>
                            <div className="text-right min-w-[60px]">
                              <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Rate</span>
                              <span className={`text-sm font-bold ${Number(wr) >= 50 ? 'text-[#22c55e]' : 'text-white'}`}>%{wr}</span>
                            </div>
                          </div>
                       </div>
                     )
                   })}
                </div>
             </div>
          </div>
        </div>

        {/* Filters and Export - Refined */}
        <div className="flex flex-wrap items-center gap-6 mb-8 bg-[#0f172a] p-5 rounded-2xl border border-white/5 shadow-md">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Durum:</span>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#1e293b] border border-white/5 rounded-lg px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-[#3b82f6] transition-all">
                <option value="all">Tümü</option>
                <option value="tp_hit">Kâr Al (TP)</option>
                <option value="sl_hit">Stop Loss (SL)</option>
                <option value="open">Açık</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Strateji:</span>
              <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-[#1e293b] border border-white/5 rounded-lg px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-[#3b82f6] transition-all">
                <option value="all">Tümü</option>
                <option value="institutional">INSTITUTIONAL</option>
                <option value="asymmetric">ASYMMETRIC</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
             <button onClick={copyToClipboard} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${copying ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
               {copying ? "Kopyalandı!" : "Kopyala"}
             </button>
             <button onClick={downloadCSV} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white">CSV</button>
             <button onClick={downloadXLS} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10">Excel (XLS)</button>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">
                  <th className="px-8 py-5">Sembol / Tarih</th>
                  <th className="px-8 py-5 text-center">Strateji</th>
                  <th className="px-8 py-5 text-center">Sistem</th>
                  <th className="px-8 py-5">Kontrat</th>
                  <th className="px-8 py-5 text-right">P&L (%)</th>
                  <th className="px-8 py-5 text-center">Durum</th>
                  <th className="px-8 py-5 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPositions.map((pos) => {
                  const systemName = MODE_MAP[pos.entry_mode || ""] || pos.entry_mode || "MOMENTUM";
                  return (
                    <tr key={pos.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-white group-hover:text-[#3b82f6] transition-colors">{pos.ticker}</span>
                          <span className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">{pos.scan_date}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`text-[9px] font-bold px-3 py-1.5 rounded-lg border uppercase tracking-wider ${pos.strategy === 'institutional' ? 'text-indigo-400 border-indigo-400/20 bg-indigo-400/5' : 'text-cyan-400 border-cyan-400/20 bg-cyan-400/5'}`}>{pos.strategy}</span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="text-[9px] font-bold text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg uppercase tracking-tight">{systemName}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-300 italic">${pos.strike} Call</span>
                          <span className="text-[10px] text-slate-500 font-medium mt-1">{pos.expiration}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={`text-xl font-bold ${(pos.pnl_pct || pos.unrealized_pnl_pct || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {pos.pnl_pct != null ? `%${pos.pnl_pct.toFixed(1)}` : (pos.unrealized_pnl_pct != null ? `%${pos.unrealized_pnl_pct.toFixed(1)} (U)` : '—')}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col gap-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${pos.status === 'open' ? 'text-amber-500' : (pos.status === 'tp_hit' ? 'text-[#22c55e]' : 'text-slate-500')}`}>{pos.status.replace('_', ' ')}</span>
                          {pos.exit_reason && <span className="text-[9px] text-slate-600 max-w-[150px] mx-auto truncate italic">{pos.exit_reason}</span>}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link href={`/optanaliz?symbol=${pos.ticker}`} className="inline-block text-[10px] font-bold text-[#3b82f6] border border-[#3b82f6]/20 px-4 py-2 rounded-xl hover:bg-[#3b82f6]/10 uppercase transition-all shadow-sm">Detay →</Link>
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
    <div className="bg-[#0f172a] p-8 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
      <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: color }} />
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <p className="text-4xl font-bold tracking-tight" style={{ color: color }}>{value}</p>
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full blur-[50px] opacity-20" style={{ backgroundColor: color }} />
    </div>
  );
}
