"use client";

import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

interface LatencyBreakdown {
  timestamp: string;
  dnsTime: number;
  connectTime: number;
  sslTime: number;
  ttfbTime: number;
  downloadTime: number;
  totalTime: number;
  statusCode: number;
  pageSize: number;
  contentValid: boolean;
  sslDaysLeft?: number;
  sslExpiryDate?: string;
  sslIssuer?: string;
  error?: string;
}

export default function OptionsMonitorClient() {
  const [current, setCurrent] = useState<LatencyBreakdown | null>(null);
  const [history, setHistory] = useState<LatencyBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(15); // Default 15s
  const [error, setError] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setScanning(true);
    try {
      const res = await fetch("/api/options/performance");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sunucu hatasÄ± oluÅŸtu");
      }
      const data = await res.json();
      if (data.success) {
        setCurrent(data.current);
        
        setHistory(prev => {
          let combined = [...(data.history || [])];
          if (combined.length <= 1) {
            combined = [data.current, ...prev];
          }
          
          const seen = new Set();
          const deduped = combined.filter(item => {
            if (!item || !item.timestamp) return false;
            const duplicate = seen.has(item.timestamp);
            seen.add(item.timestamp);
            return !duplicate;
          });
          
          deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const truncated = deduped.slice(0, 100);
          
          try {
            sessionStorage.setItem("perf_history", JSON.stringify(truncated));
          } catch (e) {}
          
          return truncated;
        });
        
        setError(null);
      } else {
        throw new Error(data.error || "Ã–lÃ§Ã¼m yapÄ±lamadÄ±");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm("TÃ¼m tarama geÃ§miÅŸini silmek istediÄŸinize emin misiniz?")) return;
    try {
      setHistory([]);
      try {
        sessionStorage.removeItem("perf_history");
      } catch (e) {}
      
      if (current) {
        setHistory([current]);
        try {
          sessionStorage.setItem("perf_history", JSON.stringify([current]));
        } catch (e) {}
      }
      
      await fetch("/api/options/performance", { method: "DELETE" }).catch(() => {});
    } catch (e: any) {
      alert("Hata: " + e.message);
    }
  };

  // Setup auto-refresh interval
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("perf_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {}

    fetchMetrics();

    // Blinking pulse for dashboard button every 2s
    const blinkInterval = setInterval(() => setBlink(b => !b), 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(blinkInterval);
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (autoRefresh > 0) {
      timerRef.current = setInterval(() => {
        fetchMetrics();
      }, autoRefresh * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh]);

  // Calculations for KPI cards
  const calculateUptime = () => {
    if (history.length === 0) return 100;
    const successCount = history.filter(h => h.statusCode === 200 && h.contentValid && !h.error).length;
    return Math.round((successCount / history.length) * 100);
  };

  const calculateAvgLatency = () => {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, h) => acc + h.totalTime, 0);
    return Math.round(sum / history.length);
  };

  const getStatusInfo = () => {
    if (error) return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", text: "OFFLINE", dot: "bg-red-500" };
    if (!current) return { color: "text-neutral", bg: "bg-neutral/10", border: "border-neutral/20", text: "WAITING", dot: "bg-neutral" };
    
    const isOffline = current.statusCode !== 200 || !!current.error;
    const isWarning = current.totalTime > 1200 || !current.contentValid;

    if (isOffline) {
      return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", text: "OFFLINE", dot: "bg-red-500" };
    }
    if (isWarning) {
      return { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "WARNING", dot: "bg-amber-500" };
    }
    return { color: "text-gain", bg: "bg-gain/10", border: "border-gain/30", text: "ONLINE", dot: "bg-gain" };
  };

  const status = getStatusInfo();
  const uptime = calculateUptime();
  const avgLatency = calculateAvgLatency();

  // Generate SVG path for chart
  const renderLatencyChart = () => {
    if (history.length < 2) {
      return (
        <div className="h-full flex items-center justify-center text-text-secondary text-sm">
          Grafik Ã§izmek iÃ§in yeterli veri yok (en az 2 tarama noktasÄ± gerekir)
        </div>
      );
    }

    // Chronological order (oldest to newest)
    const points = [...history].reverse();
    const width = 600;
    const height = 180;
    const padding = 20;

    const maxTime = Math.max(...points.map(p => p.totalTime), 1500); // at least 1.5s scale
    const minTime = 0;

    const xScale = (width - padding * 2) / (points.length - 1);
    const yScale = (height - padding * 2) / (maxTime - minTime);

    // Build path coordinates
    const coordinates = points.map((p, i) => {
      const x = padding + i * xScale;
      const y = height - padding - (p.totalTime - minTime) * yScale;
      return { x, y, value: p.totalTime, timestamp: p.timestamp };
    });

    const linePath = coordinates.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`;

    return (
      <div className="relative w-full h-[200px]">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = padding + (height - padding * 2) * (1 - ratio);
            const val = Math.round(maxTime * ratio);
            return (
              <g key={index}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(30, 42, 58, 0.5)" strokeWidth={1} strokeDasharray="4 4" />
                <text x={padding - 5} y={y + 4} fill="#64748b" fontSize={9} textAnchor="end" className="font-mono">{val}ms</text>
              </g>
            );
          })}

          {/* Area under the line */}
          <path d={areaPath} fill="url(#chartGlow)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="url(#lineColor)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {coordinates.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={points[i].statusCode === 200 && points[i].contentValid && !points[i].error ? 3 : 4}
              fill={points[i].error || points[i].statusCode !== 200 ? "#ef4444" : points[i].totalTime > 1200 || !points[i].contentValid ? "#f59e0b" : "#3b82f6"}
              stroke="#0a0e17"
              strokeWidth={1.5}
              className="cursor-pointer transition-transform hover:scale-150"
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-accent-blue uppercase tracking-wider mb-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/admin/trading/options" className="hover:text-white transition-colors">Options</Link>
          <span>/</span>
          <span className="text-white">Web Monitor</span>
        </nav>

        {/* â”€â”€ Performance Dashboard Banner (top, blinking) â”€â”€ */}
        <Link
          href="/admin/trading/options/performance"
          className="flex items-center justify-between gap-4 glass-card p-4 mb-6 border border-[#3b82f6]/30 hover:border-[#3b82f6]/70 hover:bg-[#3b82f6]/5 transition-all group"
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#3b82f6]/20"
              style={{ boxShadow: blink ? '0 0 12px 4px #3b82f6aa' : 'none', transition: 'box-shadow 0.5s' }}
            >
              ðŸ“Š
            </span>
            <div>
              <div className="text-white font-black text-sm flex items-center gap-2">
                View Performance Dashboard
                <span
                  className="inline-block w-2 h-2 rounded-full bg-[#34d399]"
                  style={{ opacity: blink ? 1 : 0.2, transition: 'opacity 0.5s' }}
                />
                <span className="text-[#34d399] text-[10px] font-black uppercase tracking-widest">LIVE</span>
              </div>
              <div className="text-[11px] text-[#00d2ff] mt-0.5">
                TÃ¼m Ã¶neri opsiyonlarÄ±n anlÄ±k P&amp;L, kontrat bitiÅŸ ve kÃ¢r/zarar durumu
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {current && (
              <div className="text-[10px] text-[#00d2ff] font-mono text-right">
                <div className="text-white font-bold">Son gÃ¼ncelleme</div>
                <div>{new Date(current.timestamp).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</div>
              </div>
            )}
            <span className="text-[#3b82f6] text-xl group-hover:translate-x-1 transition-transform">â†’</span>
          </div>
        </Link>

        {/* Title and Controls */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1 flex items-center gap-3">
              Options Web Monitor
              {current && (
                <div className={`flex items-center gap-1.5 text-xs font-black px-2 py-0.5 rounded ${status.bg} ${status.color} border ${status.border}`}>
                  <span className={`w-2 h-2 rounded-full ${status.dot} live-dot`} />
                  {status.text}
                </div>
              )}
            </h1>
            <p className="text-text-secondary text-sm">
              Real-time server performance breakdown, latency tracking and SSL analysis for https://bogastock.com/options.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-bg-card border border-border px-3 py-1.5 rounded-lg">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider">REFRESH:</span>
              <select
                value={autoRefresh}
                onChange={(e) => setAutoRefresh(Number(e.target.value))}
                className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
              >
                <option value={0} className="bg-bg-card">Manual Only</option>
                <option value={5} className="bg-bg-card">Every 5s</option>
                <option value={10} className="bg-bg-card">Every 10s</option>
                <option value={15} className="bg-bg-card">Every 15s</option>
                <option value={30} className="bg-bg-card">Every 30s</option>
                <option value={60} className="bg-bg-card">Every 1m</option>
              </select>
            </div>
            
            <button
              onClick={() => fetchMetrics(true)}
              disabled={scanning}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-blue border border-accent-blue/30 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-accent-blue/80 transition-all disabled:opacity-50"
            >
              <span>{scanning ? "âŒ› SCANNING..." : "âš¡ SCAN NOW"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-sm mb-6 flex items-center gap-3">
            <span className="text-lg">âš ï¸</span>
            <div>
              <span className="font-bold">BaÄŸlantÄ± HatasÄ±:</span> {error}
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
            <div className="text-xs text-text-secondary uppercase tracking-wider animate-pulse">
              Measuring options page performance...
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass-card p-4 text-center">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">PAGE SPEED</div>
                <div className={`font-mono font-black text-2xl ${current && current.totalTime > 1200 ? 'text-amber-500' : 'text-gain'}`}>
                  {current ? `${current.totalTime} ms` : "â€”"}
                </div>
                <div className="text-[10px] text-text-muted mt-1 font-mono">
                  ttfb: {current ? `${current.ttfbTime}ms` : "â€”"}
                </div>
              </div>

              <div className="glass-card p-4 text-center">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">SYSTEM UPTIME</div>
                <div className={`font-black text-2xl ${uptime > 95 ? 'text-gain' : uptime > 80 ? 'text-amber-500' : 'text-loss'}`}>
                  {uptime}%
                </div>
                <div className="text-[10px] text-text-muted mt-1">
                  based on last {history.length} scans
                </div>
              </div>

              <div className="glass-card p-4 text-center">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">AVERAGE SPEED</div>
                <div className="font-mono font-black text-2xl text-white">
                  {avgLatency} ms
                </div>
                <div className="text-[10px] text-text-muted mt-1 font-mono">
                  size: {current ? `${(current.pageSize / 1024).toFixed(1)} KB` : "â€”"}
                </div>
              </div>

              <div className="glass-card p-4 text-center">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">SSL CERTIFICATE</div>
                <div className={`font-black text-2xl ${current && current.sslDaysLeft && current.sslDaysLeft < 30 ? 'text-amber-500' : 'text-gain'}`}>
                  {current && current.sslDaysLeft ? `${current.sslDaysLeft} Days` : "â€”"}
                </div>
                <div className="text-[10px] text-text-muted mt-1 truncate">
                  {current?.sslIssuer || "Unknown Issuer"}
                </div>
              </div>
            </div>

            {/* Latency History Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="glass-card p-6 lg:col-span-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">LATENCY TIMELINE (ms)</h3>
                  <div className="flex gap-4 text-[10px] text-text-secondary font-mono">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> OK</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> SLOW/CONTENT WARNING</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]" /> ERROR</span>
                  </div>
                </div>
                
                <div className="flex-1 min-h-[180px]">
                  {renderLatencyChart()}
                </div>
              </div>

              {/* Current Breakdown details */}
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">LATENCY BREAKDOWN</h3>
                {current ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-secondary font-semibold">1. DNS Lookup</span>
                        <span className="font-mono text-white font-bold">{current.dnsTime} ms</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, (current.dnsTime / current.totalTime) * 100)}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-secondary font-semibold">2. TCP Connect</span>
                        <span className="font-mono text-white font-bold">{current.connectTime} ms</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (current.connectTime / current.totalTime) * 100)}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-secondary font-semibold">3. SSL Handshake</span>
                        <span className="font-mono text-white font-bold">{current.sslTime} ms</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (current.sslTime / current.totalTime) * 100)}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-secondary font-semibold">4. Server Response (TTFB)</span>
                        <span className="font-mono text-white font-bold">{current.ttfbTime} ms</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, (current.ttfbTime / current.totalTime) * 100)}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-secondary font-semibold">5. Page Download</span>
                        <span className="font-mono text-white font-bold">{current.downloadTime} ms</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-gain rounded-full" style={{ width: `${Math.min(100, (current.downloadTime / current.totalTime) * 100)}%` }} />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-text-secondary">HTML Content Check</span>
                      <span className={`font-bold ${current.contentValid ? 'text-gain' : 'text-amber-500'}`}>
                        {current.contentValid ? "âœ… VALID CONTENT" : "âš ï¸ UNEXPECTED CONTENT"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-secondary text-xs">
                    Veri bekleniyor...
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Logs and SSL summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              {/* SSL details card */}
              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">SSL CERTIFICATE DETAIL</h3>
                  {current && current.sslExpiryDate ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-text-secondary">Certificate Issuer</span>
                        <span className="text-white font-bold">{current.sslIssuer || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-text-secondary">Expiry Date</span>
                        <span className="text-white font-mono">{current.sslExpiryDate}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-text-secondary">Status</span>
                        <span className={`font-bold ${current.sslDaysLeft && current.sslDaysLeft < 30 ? 'text-amber-500' : 'text-gain'}`}>
                          {current.sslDaysLeft && current.sslDaysLeft < 30 ? "âš ï¸ RENEW SOON" : "ðŸŸ¢ SECURE & ACTIVE"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-text-secondary">Security Protocol</span>
                        <span className="text-white font-mono">TLS v1.3 / HTTPS</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-text-secondary text-xs">
                      SSL bilgisi yÃ¼kleniyor...
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-text-muted mt-6">
                  * SSL certificate verification runs automatically with each web ping.
                </div>
              </div>

              {/* Log table */}
              <div className="glass-card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">RECENT SCANS LOGS</h3>
                  {history.length > 0 && (
                    <button
                      onClick={clearLogs}
                      className="text-[10px] text-text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors"
                    >
                      Clear Logs
                    </button>
                  )}
                </div>
                
                <div className="overflow-x-auto max-h-[220px] overflow-y-auto pr-1">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border text-text-secondary text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2">Time</th>
                        <th className="py-2 text-center">Status</th>
                        <th className="py-2 text-right">Latency</th>
                        <th className="py-2 text-right">Size</th>
                        <th className="py-2 text-right">Content</th>
                        <th className="py-2 pl-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((logItem, index) => {
                        const isErr = logItem.statusCode !== 200 || !!logItem.error;
                        const isWarn = logItem.totalTime > 1200 || !logItem.contentValid;
                        return (
                          <tr key={index} className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
                            <td className="py-2 text-text-secondary font-mono">
                              {new Date(logItem.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2 text-center font-bold">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isErr ? 'bg-red-500/10 text-red-400' : isWarn ? 'bg-amber-500/10 text-amber-400' : 'bg-gain/10 text-gain'}`}>
                                {logItem.statusCode === 0 ? "ERR" : logItem.statusCode}
                              </span>
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-white">
                              {logItem.totalTime} ms
                            </td>
                            <td className="py-2 text-right text-text-secondary font-mono">
                              {(logItem.pageSize / 1024).toFixed(1)} KB
                            </td>
                            <td className={`py-2 text-right font-bold ${logItem.contentValid ? 'text-gain' : 'text-amber-500'}`}>
                              {logItem.contentValid ? "VALID" : "UNEXPECTED"}
                            </td>
                            <td className="py-2 pl-3 truncate max-w-[150px] text-text-secondary font-mono text-[10px]" title={logItem.error || (logItem.totalTime > 1200 ? "Slow response" : "Normal scan")}>
                              {logItem.error || (logItem.totalTime > 1200 ? "Slow Response" : "OK")}
                            </td>
                          </tr>
                        );
                      })}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-text-secondary text-xs">
                            KayÄ±t bulunamadÄ±.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

