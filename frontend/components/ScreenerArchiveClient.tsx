"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ArchivedScan {
  id: string;
  preset: string;
  timestamp: string;
  date: string;
  total_results: number;
  top_5_tickers: string[];
  regime: string;
}

const PRESET_COLORS: Record<string, string> = {
  genel_swing:   "#06f3aa",
  pre_catalyst:  "#ec4899",
  swing_cont:    "#3b82f6",
  early_break:   "#22c55e",
  day_mom:       "#f59e0b",
  opt_sniper:    "#a855f7",
  inst_trend:    "#06b6d4",
  cheap_exp:     "#f43f5e",
  ema_cross:     "#10b981",
  gamma_sq:      "#f97316",
};

const PRESET_NAMES: Record<string, string> = {
  genel_swing:   "Genel Swing",
  pre_catalyst:  "Episodemic Pivot",
  swing_cont:    "Swing Continuation",
  early_break:   "Early Breakout",
  day_mom:       "Day Trade Momentum",
  opt_sniper:    "Options Sniper",
  inst_trend:    "Institutional Trend",
  cheap_exp:     "15m Pivot",
  ema_cross:     "EMA Cross Setup",
  gamma_sq:      "Gamma Squeeze",
};

export default function ScreenerArchiveClient() {
  const [scans, setScans] = useState<ArchivedScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPreset, setFilterPreset] = useState<string | null>(null);

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    try {
      const res = await fetch("/api/screener-archive");
      const data = await res.json();
      setScans(data.scans || []);
    } catch (e) {
      console.error("Failed to fetch archive:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredScans = filterPreset ? scans.filter(s => s.preset === filterPreset) : scans;
  const uniquePresets = [...new Set(scans.map(s => s.preset))];

  return (
    <div style={{ background: "#0a0c10", minHeight: "calc(100vh - 64px)", fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2a3a", padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", letterSpacing: 2, marginBottom: 4 }}>
              SCREENER ARŞİVİ
            </div>
            <div style={{ fontSize: 12, color: "#7c8fa6" }}>
              Tüm tarama sonuçlarının zaman damgalı geçmişi
            </div>
          </div>
          <Link href="/admin/analytics/screener"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.5)", color: "#4ade80", padding: "8px 16px", borderRadius: 4, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
            ← Screener'a Dön
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilterPreset(null)}
            style={{
              background: filterPreset === null ? "rgba(59,130,246,0.2)" : "transparent",
              border: `1px solid ${filterPreset === null ? "rgba(59,130,246,0.6)" : "#253347"}`,
              color: filterPreset === null ? "#60a5fa" : "#7c8fa6",
              padding: "6px 12px",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: 700,
            }}>
            Tümü ({scans.length})
          </button>
          {uniquePresets.map(preset => {
            const count = scans.filter(s => s.preset === preset).length;
            const color = PRESET_COLORS[preset] || "#7c8fa6";
            return (
              <button
                key={preset}
                onClick={() => setFilterPreset(preset)}
                style={{
                  background: filterPreset === preset ? `${color}20` : "transparent",
                  border: `1px solid ${filterPreset === preset ? color : "#253347"}`,
                  color: filterPreset === preset ? color : "#7c8fa6",
                  padding: "6px 12px",
                  borderRadius: 3,
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "inherit",
                  fontWeight: filterPreset === preset ? 700 : 400,
                }}>
                {PRESET_NAMES[preset] || preset} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#7c8fa6" }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Arşiv yükleniyor...</div>
          </div>
        ) : filteredScans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#7c8fa6" }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>📭 Tarama kaydı bulunamadı</div>
            <div style={{ fontSize: 12 }}>Screener taramalarını çalıştırdıkça arşive kaydedilecektir.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredScans.map(scan => {
              const color = PRESET_COLORS[scan.preset] || "#7c8fa6";
              return (
                <div key={scan.id} style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 8, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                        <span style={{ background: `${color}20`, border: `1px solid ${color}40`, color, padding: "4px 10px", borderRadius: 3, fontSize: 11, fontWeight: 700 }}>
                          {PRESET_NAMES[scan.preset] || scan.preset}
                        </span>
                        <span style={{ fontSize: 11, color: "#7c8fa6" }}>
                          {scan.date}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color }}>Toplam: {scan.total_results}</span>
                        {" · "}
                        <span>Rejim: {scan.regime}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#7c8fa6", textAlign: "right" }}>
                      {new Date(scan.timestamp).toLocaleTimeString("tr-TR")}
                    </div>
                  </div>

                  {/* Top 5 Tickers */}
                  {scan.top_5_tickers.length > 0 && (
                    <div style={{ background: "#111620", borderRadius: 4, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#7c8fa6", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>
                        Top 5 Tickers
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {scan.top_5_tickers.map(ticker => (
                          <Link key={ticker} href={`/stock/${ticker}`}
                            style={{
                              background: "#0a2a4a",
                              border: "1px solid #3b82f6",
                              color: "#60a5fa",
                              padding: "4px 10px",
                              borderRadius: 3,
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "none",
                              transition: "all 0.15s",
                              cursor: "pointer",
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.background = "#0d3a6d";
                              (e.currentTarget as HTMLElement).style.borderColor = "#60a5fa";
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.background = "#0a2a4a";
                              (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
                            }}>
                            {ticker}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
