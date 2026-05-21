"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScreenerResult {
  ticker: string;
  company: string;
  sector: string;
  price: number;
  change_1d: number;
  change_1w: number;
  volume: number;
  avg_volume: number;
  rvol: number;
  market_cap: number;
  market_cap_label: string;
  boga_score: number;
  grade: string;
  trend_score: number;
  momentum_score: number;
  options_score: number;
  liquidity_score: number;
  primary_setup: string;
  setup_signals: string[];
  ema8: number;
  ema13: number;
  ema20: number;
  ema21: number;
  ema50: number;
  ema200: number;
  sma200: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  atr_pct: number;
  bb_upper: number;
  bb_lower: number;
  bb_pct: number;
  bb_width: number;
  adx: number;
  roc10: number;
  ema_structure: string;
  trend_direction: "up" | "dn" | "neu";
  pct_from_52w_high: number;
  has_options: boolean;
  has_weekly_options: boolean;
  iv_est: number;
  entry: number;
  stop: number;
  target: number;
  rr_ratio: string;
  risk_pct: number;
  support: number;
  resistance: number;
  warnings: string[];
}

interface Regime {
  regime: string;
  label: string;
  spy_change: number;
  vix_price: number;
  trend: "bullish" | "bearish" | "choppy";
  momentum: "strong" | "moderate" | "weak";
}

// ─── Preset Definitions ───────────────────────────────────────────────────────

const PRESETS = [
  { id: "swing_cont",  name: "Swing Continuation", desc: "Price>SMA200 · EMA20>EMA50 · RSI 55-70", mode: "swing",    color: "#3b82f6", pills: ["Price>SMA200","EMA20>EMA50","RSI 55-70","RVOL>1.5","MCap>2B"], icon: "📈" },
  { id: "early_break", name: "Early Breakout",      desc: "BB Squeeze · RVOL>1.3 · ADX 12-30",    mode: "swing",    color: "#22c55e", pills: ["BB Squeeze","RVOL>1.3","ADX 12-30","Vol Expansion"],           icon: "💥" },
  { id: "day_mom",     name: "Day Trade Momentum",  desc: "Değişim>4% · RVOL>3 · Güçlü hareket", mode: "day",      color: "#f59e0b", pills: ["Değişim>4%","RVOL>3","Güçlü gün"],                             icon: "⚡" },
  { id: "opt_sniper",  name: "Options Sniper",      desc: "Haftalık · IV Exp · RVOL>1.3",         mode: "options",  color: "#a855f7", pills: ["Haftalık OPT","IV Expansion","RVOL>1.3","RSI>50"],            icon: "🎯" },
  { id: "inst_trend",  name: "Institutional Trend", desc: "MCap>10B · ADX>20 · Price>SMA200",     mode: "position", color: "#06b6d4", pills: ["MCap>10B","Price>SMA200","ADX>20","EMA20>EMA50"],             icon: "🏛️" },
  { id: "cheap_exp",   name: "Cheap & Explosive",   desc: "Price<$10 · RVOL>2 · Weekly Opt",      mode: "day",      color: "#f43f5e", pills: ["Price<$10","RVOL>2","ATR>4%","Haftalık OPT"],                 icon: "🔥" },
  { id: "ema_cross",   name: "EMA Cross Setup",     desc: "EMA8>EMA20 fresh cross · RVOL>1.3",    mode: "swing",    color: "#10b981", pills: ["EMA8>EMA20 (Fresh)","RVOL>1.3","MACD Bölge"],                 icon: "✂️" },
  { id: "gamma_sq",    name: "Gamma Squeeze",       desc: "Haftalık · ATR>5% · RVOL>2",           mode: "options",  color: "#f97316", pills: ["Haftalık OPT","ATR>5%","MCap<20B","RVOL>2"],                  icon: "🚀" },
];

const TRADE_MODES = [
  { id: "day",       label: "Day Trade",      icon: "⚡" },
  { id: "swing",     label: "Swing Trade",    icon: "📊" },
  { id: "position",  label: "Position Trade", icon: "📈" },
  { id: "options",   label: "Options",        icon: "🎯" },
  { id: "gamma",     label: "Gamma Squeeze",  icon: "🔥" },
  { id: "momentum",  label: "Momentum",       icon: "🚀" },
  { id: "reversion", label: "Mean Reversion", icon: "↩️" },
];

const PRICE_RANGES = [
  { label: "Sub $1",  min: 0,  max: 1 },
  { label: "$1–5",    min: 1,  max: 5 },
  { label: "$5–10",   min: 5,  max: 10 },
  { label: "$10–20",  min: 10, max: 20 },
  { label: "$20–50",  min: 20, max: 50 },
  { label: "$50+",    min: 50, max: 999999 },
];

const CAP_RANGES = [
  { label: "Nano",   id: "nano"  },
  { label: "Micro",  id: "micro" },
  { label: "Small",  id: "small" },
  { label: "Mid",    id: "mid"   },
  { label: "Large",  id: "large" },
  { label: "Mega",   id: "mega"  },
];

const LIQ_RANGES = [
  { label: "Düşük (<500K)",   id: "low"  },
  { label: "Orta (500K-5M)",  id: "mid"  },
  { label: "Yüksek (5M-50M)", id: "high" },
  { label: "Kurumsal (50M+)", id: "inst" },
];

const OPT_RANGES = [
  { label: "Haftalık",    id: "weekly"      },
  { label: "Var",         id: "has_options" },
  { label: "Yok",         id: "no_options"  },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function ScoreBar({ score, grade }: { score: number; grade?: string }) {
  const color = score >= 80 ? "#22c55e" : score >= 65 ? "#f59e0b" : score >= 50 ? "#3b82f6" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <span style={{ color, minWidth: 26, fontSize: 12, fontWeight: 900, fontFamily: "monospace" }}>{score}</span>
      <div style={{ width: 40, height: 4, background: "#1e2a3a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      {grade && (
        <span style={{ fontSize: 9, fontWeight: 700, color, border: `1px solid ${color}`, padding: "1px 4px", borderRadius: 2 }}>{grade}</span>
      )}
    </div>
  );
}

function SetupBadge({ setup }: { setup: string }) {
  const MAP: Record<string, { bg: string; color: string; border: string }> = {
    swing:    { bg: "#0a2a4a", color: "#3b82f6", border: "#2a7acc" },
    day:      { bg: "#4a2e08", color: "#f59e0b", border: "#c4841c" },
    options:  { bg: "#2a0a4a", color: "#a855f7", border: "#7c3aed" },
    momentum: { bg: "#0a2a0a", color: "#22c55e", border: "#15803d" },
    breakout: { bg: "#0a3020", color: "#10b981", border: "#059669" },
  };
  const cfg = MAP[setup] || MAP.swing;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.5px" }}>
      {setup.toUpperCase()}
    </span>
  );
}

function TrendIcon({ dir }: { dir: "up" | "dn" | "neu" }) {
  if (dir === "up") return <span style={{ color: "#22c55e", fontSize: 13 }}>↑</span>;
  if (dir === "dn") return <span style={{ color: "#ef4444", fontSize: 13 }}>↓</span>;
  return <span style={{ color: "#64748b", fontSize: 13 }}>—</span>;
}

function OptBadge({ weekly, hasOpt }: { weekly: boolean; hasOpt: boolean }) {
  if (weekly) return <span style={{ color: "#a855f7", fontSize: 10, fontWeight: 700 }}>📅 Haftalık</span>;
  if (hasOpt) return <span style={{ color: "#7c3aed", fontSize: 10 }}>✓ Var</span>;
  return <span style={{ color: "#334155", fontSize: 10 }}>—</span>;
}

function MACDDot({ val, hist }: { val: number; hist: number }) {
  const positive = val > 0 && hist > 0;
  const rising   = hist > 0;
  const color    = positive ? "#22c55e" : rising ? "#f59e0b" : "#ef4444";
  const label    = positive ? "↑ Pozitif" : rising ? "↗ Yükseliyor" : "↓ Negatif";
  return <span style={{ color, fontSize: 9 }}>{label}</span>;
}

function fmt(n: number, dec = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}
function fmtCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

// ─── Detail Row (Architecture Spec §10 ExpandedRow) ──────────────────────────

function DetailRow({ stock }: { stock: ScreenerResult }) {
  return (
    <tr style={{ background: "#0d1117" }}>
      <td colSpan={10} style={{ padding: "12px 16px" }}>

        {/* Warnings */}
        {stock.warnings?.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {stock.warnings.map(w => (
              <div key={w} style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 9, padding: "3px 8px", borderRadius: 3 }}>
                ⚠️ {w}
              </div>
            ))}
          </div>
        )}

        {/* Setup Signals */}
        {stock.setup_signals?.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#334155", marginRight: 4, letterSpacing: 1 }}>AKTİF SİNYALLER:</span>
            {stock.setup_signals.map(s => (
              <span key={s} style={{ background: "#0a2a0a", border: "1px solid #166534", color: "#22c55e", fontSize: 9, padding: "2px 7px", borderRadius: 10 }}>✓ {s}</span>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {/* Technical Panel */}
          <div style={{ background: "#111620", border: "1px solid #1e2a3a", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Teknik Göstergeler</div>
            {[
              ["EMA Yapısı", stock.ema_structure, stock.trend_direction === "up" ? "#22c55e" : "#ef4444"],
              ["SMA 200", `$${fmt(stock.sma200)} ${stock.price > stock.sma200 ? "✓" : "✗"}`, stock.price > stock.sma200 ? "#22c55e" : "#ef4444"],
              ["RSI (14)", fmt(stock.rsi, 1), stock.rsi > 72 ? "#ef4444" : stock.rsi >= 55 ? "#22c55e" : "#94a3b8"],
              ["MACD", stock.macd > 0 ? `+${fmt(stock.macd, 3)}` : fmt(stock.macd, 3), stock.macd > 0 ? "#22c55e" : "#ef4444"],
              ["ADX (14)", fmt(stock.adx, 1), stock.adx >= 25 ? "#f59e0b" : "#94a3b8"],
              ["ATR%", `${stock.atr_pct}%`, "#94a3b8"],
              ["ROC(10)", `${stock.roc10 > 0 ? "+" : ""}${fmt(stock.roc10, 1)}%`, stock.roc10 > 0 ? "#22c55e" : "#ef4444"],
              ["BB%", fmt(stock.bb_pct, 2), stock.bb_pct > 0.8 ? "#ef4444" : stock.bb_pct < 0.2 ? "#22c55e" : "#94a3b8"],
              ["EMA8/20/50", `${fmt(stock.ema8,1)}/${fmt(stock.ema20,1)}/${fmt(stock.ema50,1)}`, "#475569"],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#64748b" }}>{label}</span>
                <span style={{ fontSize: 9, color: color as string, fontFamily: "monospace" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Market Data Panel */}
          <div style={{ background: "#111620", border: "1px solid #1e2a3a", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Piyasa Verileri</div>
            {[
              ["Destek (52H)", `$${fmt(stock.support)}`, "#22c55e"],
              ["Direnç (52H)", `$${fmt(stock.resistance)}`, "#f59e0b"],
              ["52H'den Uzaklık", `${stock.pct_from_52w_high > 0 ? "+" : ""}${stock.pct_from_52w_high}%`, stock.pct_from_52w_high >= -5 ? "#22c55e" : "#94a3b8"],
              ["Dollar Hacim", fmtVol(stock.volume * stock.price), "#94a3b8"],
              ["Ort. Hacim", fmtVol(stock.avg_volume * stock.price), "#64748b"],
              ["Market Cap", fmtCap(stock.market_cap), "#94a3b8"],
              ["Cap Kademesi", stock.market_cap_label, "#64748b"],
              ["IV Tahmini", `${stock.iv_est}%`, stock.iv_est > 80 ? "#f59e0b" : "#94a3b8"],
              ["Sektör", stock.sector || "—", "#475569"],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#64748b" }}>{label}</span>
                <span style={{ fontSize: 9, color: color as string, fontFamily: "monospace" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Trade Plan (Architecture §7.2) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "GİRİŞ",   value: `$${fmt(stock.entry)}`,   bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   color: "#22c55e"  },
                { label: "STOP",    value: `$${fmt(stock.stop)}`,    bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#ef4444"  },
                { label: "HEDEF",   value: `$${fmt(stock.target)}`,  bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.3)",  color: "#3b82f6"  },
                { label: "R/R",     value: stock.rr_ratio,           bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)",  color: "#f59e0b"  },
              ].map(p => (
                <div key={p.label} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: p.color.replace("#", "rgba(").replace(/^/, ""), letterSpacing: 1, opacity: 0.8 }}>{p.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: p.color, marginTop: 2, fontFamily: "monospace" }}>{p.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#111620", border: "1px solid #1e2a3a", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#334155" }}>Risk %</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{stock.risk_pct}%</div>
            </div>
            {/* Links */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <Link href={`/stock/${stock.ticker}`}
                style={{ background: "#0a2a4a", border: "1px solid #1d4ed8", color: "#3b82f6", padding: "6px 0", borderRadius: 4, fontSize: 10, fontWeight: 700, textAlign: "center", display: "block" }}>
                Detay ↗
              </Link>
              <Link href={`/terminal?ticker=${stock.ticker}`}
                style={{ background: "#0a2a0a", border: "1px solid #15803d", color: "#22c55e", padding: "6px 0", borderRadius: 4, fontSize: 10, fontWeight: 700, textAlign: "center", display: "block" }}>
                Chart ↗
              </Link>
            </div>
          </div>

          {/* Options + BOGA Score Breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ background: "#111620", border: "1px solid #1e2a3a", borderRadius: 6, padding: "10px 12px", flex: 1 }}>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Opsiyon Kalitesi</div>
              {[
                ["Haftalık Zincir", stock.has_weekly_options ? "✓ Mevcut" : "✗ Yok", stock.has_weekly_options ? "#22c55e" : "#ef4444"],
                ["Opsiyon Var", stock.has_options ? "✓" : "✗", stock.has_options ? "#22c55e" : "#475569"],
                ["IV Tahmini", `${stock.iv_est}%`, stock.iv_est > 80 ? "#f59e0b" : "#94a3b8"],
                ["Options Skoru", `${stock.options_score}/100`, "#a855f7"],
                ["MACD Durumu", stock.macd > 0 ? "Pozitif ✓" : "Negatif", stock.macd > 0 ? "#22c55e" : "#ef4444"],
              ].map(([label, value, color]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#64748b" }}>{label}</span>
                  <span style={{ fontSize: 9, color: color as string }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOGA Score Breakdown Bar (Architecture §6.1 — Preset Weighted) */}
        <div style={{ marginTop: 10, background: "#111620", border: "1px solid #1e2a3a", borderRadius: 6, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#334155", letterSpacing: "1.5px", marginBottom: 8, textTransform: "uppercase" }}>BOGA Score Bileşenleri</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { label: "Trend",      score: stock.trend_score,     color: "#22c55e",  desc: "EMA·SMA200·ADX·52H" },
              { label: "Momentum",   score: stock.momentum_score,  color: "#3b82f6",  desc: "RVOL·RSI·MACD·ROC" },
              { label: "Likidite",   score: stock.liquidity_score, color: "#f59e0b",  desc: "DolVol·MCap·RVOL" },
              { label: "Opsiyon",    score: stock.options_score,   color: "#a855f7",  desc: "Haftalık·OI·Spread·IV" },
            ].map(({ label, score, color, desc }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 9, color: "#64748b", display: "block" }}>{label}</span>
                    <span style={{ fontSize: 8, color: "#334155" }}>{desc}</span>
                  </div>
                  <span style={{ fontSize: 11, color, fontWeight: 800, fontFamily: "monospace" }}>{score}</span>
                </div>
                <div style={{ height: 4, background: "#1e2a3a", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Regime Label ─────────────────────────────────────────────────────────────

const REGIME_COLORS: Record<string, string> = {
  bull_trending: "#22c55e", bull_choppy: "#84cc16", neutral: "#94a3b8",
  bear_choppy: "#f97316", bear_trending: "#ef4444", high_volatility: "#f59e0b", low_volatility: "#06b6d4",
};
const REGIME_MULT_HINT: Record<string, string> = {
  bull_trending:  "Swing +20% · Breakout +15% · Day +10%",
  bull_choppy:    "Swing -15% · Reversion +10%",
  neutral:        "Tüm stratejiler nötr ağırlık",
  bear_choppy:    "Swing -60% · Options +10% · Mean Rev. aktif",
  bear_trending:  "Swing -80% · Options Short · Day -30%",
  high_volatility:"Day Trade +40% · Options Sniper +30%",
  low_volatility: "BB Squeeze +40% · Options (ucuz IV) +30%",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScreenerCockpit() {
  const [activePreset, setActivePreset] = useState("swing_cont");
  const [activeMode,   setActiveMode]   = useState("swing");
  const [activePills,  setActivePills]  = useState<string[]>(PRESETS[0].pills);

  // Filters
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [capFilter,  setCapFilter]  = useState("all");
  const [optFilter,  setOptFilter]  = useState("all");
  const [liqFilter,  setLiqFilter]  = useState("all");

  // Results
  const [results,     setResults]     = useState<ScreenerResult[]>([]);
  const [isScanning,  setIsScanning]  = useState(false);
  const [scanMeta,    setScanMeta]    = useState({ total: 0, scanned: 0, universe: 0 });
  const [lastScan,    setLastScan]    = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy,      setSortBy]      = useState("score");
  const [sortDir,     setSortDir]     = useState<1 | -1>(-1);

  // Regime (now comes from screener API)
  const [regime, setRegime] = useState<Regime>({ regime: "neutral", label: "Nötr", spy_change: 0, vix_price: 20, trend: "choppy", momentum: "moderate" });

  // ── Run Scan ──────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    setIsScanning(true);
    setExpandedRow(null);
    try {
      const params = new URLSearchParams({ preset: activePreset, cap: capFilter, opt: optFilter, liq: liqFilter, sort: sortBy, limit: "60" });
      if (priceRange) { params.set("priceMin", String(priceRange.min)); params.set("priceMax", String(priceRange.max)); }
      const res = await fetch(`/api/screener?${params}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setResults(data.results || []);
      setScanMeta({ total: data.total, scanned: data.scanned, universe: data.universe_size });
      if (data.regime) setRegime(data.regime);
      setLastScan(new Date().toLocaleTimeString("tr-TR"));
    } catch (e) {
      console.error("Screener error:", e);
    } finally {
      setIsScanning(false);
    }
  }, [activePreset, capFilter, optFilter, liqFilter, sortBy, priceRange]);

  useEffect(() => { runScan(); }, [activePreset]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sort ──────────────────────────────────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === -1 ? 1 : -1);
    else { setSortBy(col); setSortDir(-1); }
  };

  const sortedResults = [...results].sort((a, b) => {
    const v = (s: ScreenerResult) => {
      switch (sortBy) {
        case "score": return s.boga_score;
        case "rvol":  return s.rvol;
        case "chg":   return s.change_1d;
        case "rsi":   return s.rsi;
        case "price": return s.price;
        case "adx":   return s.adx;
        default:      return s.boga_score;
      }
    };
    return (v(a) - v(b)) * sortDir;
  });

  const selectPreset = (p: typeof PRESETS[0]) => { setActivePreset(p.id); setActiveMode(p.mode); setActivePills(p.pills); };
  const regimeColor  = REGIME_COLORS[regime.regime] ?? "#94a3b8";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0a0c10", minHeight: "calc(100vh - 64px)", fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace", fontSize: 12, color: "#e2e8f0" }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2a3a", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#22c55e" }}>
            BOGA <span style={{ color: "#64748b", fontWeight: 400, fontSize: 11 }}>SCREENER v2</span>
          </div>
          <div style={{ fontSize: 9, color: "#334155", letterSpacing: 1 }}>{scanMeta.universe > 0 ? `${scanMeta.universe} hisse evreni` : "Yükleniyor..."}</div>
          {/* Regime badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#111620", border: `1px solid ${regimeColor}30`, padding: "3px 10px", borderRadius: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: regimeColor }} />
            <span style={{ fontSize: 9, color: regimeColor, fontWeight: 700 }}>{regime.label}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 9, color: "#475569" }}>CANLI</span>
          </div>
          {lastScan && <span style={{ fontSize: 9, color: "#475569" }}>Son tarama: <span style={{ color: "#94a3b8" }}>{lastScan}</span></span>}
          <span style={{ fontSize: 9, color: "#475569" }}>
            SPY <span style={{ color: regime.spy_change >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
              {regime.spy_change >= 0 ? "+" : ""}{(regime.spy_change ?? 0).toFixed(2)}%
            </span>
          </span>
          <span style={{ fontSize: 9, color: "#475569" }}>
            VIX <span style={{ color: (regime.vix_price ?? 20) > 25 ? "#ef4444" : "#f59e0b" }}>{(regime.vix_price ?? 20).toFixed(1)}</span>
          </span>
        </div>
      </div>

      {/* ── Universe Bar (§4.1 Stage 1 filters) ──────────────────────────────── */}
      <div style={{ background: "#0f141e", borderBottom: "1px solid #1e2a3a", padding: "7px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Price */}
        <FilterRow label="Fiyat" active="#3b82f6" activeB="#2a7acc">
          {PRICE_RANGES.map(r => (
            <FilterBtn key={r.label} active={priceRange?.min === r.min} acColor="#3b82f6" acBorder="#2a7acc" onClick={() => setPriceRange(priceRange?.min === r.min ? null : r)}>{r.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        {/* Cap */}
        <FilterRow label="Market Cap">
          {CAP_RANGES.map(c => (
            <FilterBtn key={c.id} active={capFilter === c.id} acColor="#3b82f6" acBorder="#2a7acc" onClick={() => setCapFilter(capFilter === c.id ? "all" : c.id)}>{c.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        {/* Liquidity (Architecture §4.2 LIQUIDITY_TIERS — PREVIOUSLY MISSING) */}
        <FilterRow label="Likidite">
          {LIQ_RANGES.map(l => (
            <FilterBtn key={l.id} active={liqFilter === l.id} acColor="#06b6d4" acBorder="#0891b2" onClick={() => setLiqFilter(liqFilter === l.id ? "all" : l.id)}>{l.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        {/* Options */}
        <FilterRow label="Opsiyon">
          {OPT_RANGES.map(o => (
            <FilterBtn key={o.label} active={optFilter === o.id} acColor="#a855f7" acBorder="#7c3aed" onClick={() => setOptFilter(optFilter === o.id ? "all" : o.id)}>{o.label}</FilterBtn>
          ))}
        </FilterRow>
      </div>

      {/* ── Main Area ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", height: "calc(100vh - 190px)", minHeight: 500 }}>

        {/* ── Left Panel ──────────────────────────────────────────────────────── */}
        <div style={{ width: 210, background: "#0d1117", borderRight: "1px solid #1e2a3a", flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px 4px", fontSize: 9, letterSpacing: "1.5px", color: "#334155", textTransform: "uppercase" }}>İşlem Modu</div>
          {TRADE_MODES.map(m => (
            <button key={m.id} onClick={() => setActiveMode(m.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", border: "none", background: activeMode === m.id ? "#111620" : "none", color: activeMode === m.id ? "#22c55e" : "#64748b", fontSize: 11, fontFamily: "inherit", width: "100%", textAlign: "left", borderLeft: `2px solid ${activeMode === m.id ? "#22c55e" : "transparent"}`, transition: "all .15s" }}
            ><span>{m.icon}</span> {m.label}</button>
          ))}

          <div style={{ padding: "10px 12px 4px", fontSize: 9, letterSpacing: "1.5px", color: "#334155", textTransform: "uppercase", marginTop: 4 }}>Preset Stratejiler</div>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => selectPreset(p)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", cursor: "pointer", border: "none", background: activePreset === p.id ? "#111620" : "none", borderLeft: `2px solid ${activePreset === p.id ? p.color : "transparent"}`, transition: "all .15s" }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: activePreset === p.id ? p.color : "#94a3b8", fontFamily: "inherit" }}>{p.icon} {p.name}</div>
              <div style={{ fontSize: 9, color: "#334155", marginTop: 1, fontFamily: "inherit" }}>{p.desc}</div>
            </button>
          ))}

          {/* Screener Quick Access */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #1e2a3a", padding: "8px 10px" }}>
            <Link href="/screener" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "6px 0", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", borderRadius: 4, textDecoration: "none" }}>
              📡 Setup Screener
            </Link>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2a3a", padding: "7px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button onClick={runScan} disabled={isScanning}
              style={{ background: isScanning ? "#111620" : "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", padding: "5px 14px", borderRadius: 4, cursor: isScanning ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              {isScanning ? "⏳ Taranıyor..." : "📡 TARA"}
            </button>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {activePills.map(pill => (
                <div key={pill} style={{ background: "#141924", border: "1px solid #1e2a3a", color: "#94a3b8", padding: "3px 8px", borderRadius: 10, fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
                  {pill}
                  <span style={{ fontSize: 10, cursor: "pointer", color: "#334155" }} onClick={() => setActivePills(pp => pp.filter(x => x !== pill))}>✕</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 9, color: "#334155", marginLeft: "auto", textAlign: "right" }}>
              {scanMeta.total > 0 && <><span style={{ color: "#f59e0b", fontWeight: 700 }}>{scanMeta.total}</span> sonuç · <span style={{ color: "#475569" }}>{scanMeta.scanned} tarandı</span></>}
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isScanning ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 14 }}>
                <div style={{ width: 40, height: 40, border: "3px solid #1e2a3a", borderTop: "3px solid #22c55e", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: 12, color: "#475569" }}>Evren taranıyor...</div>
                <div style={{ fontSize: 10, color: "#334155" }}>Yahoo Finance · EMA8/13/20/21/50/200 · MACD · ADX · RSI · ATR</div>
                <div style={{ fontSize: 9, color: "#1e2a3a" }}>Multi-Stage Pipeline · BOGA Score · Regime Multiplier</div>
              </div>
            ) : results.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 12 }}>
                <div style={{ fontSize: 40 }}>📡</div>
                <div style={{ fontSize: 13, color: "#475569" }}>Tarama başlatılmadı</div>
                <div style={{ fontSize: 10, color: "#334155" }}>Bir preset seç veya TARA butonuna bas</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0f141e", position: "sticky", top: 0, zIndex: 1 }}>
                    {[
                      { key: null,    label: "Ticker"        },
                      { key: "score", label: "BOGA Score ↕"  },
                      { key: null,    label: "Setup"         },
                      { key: "rvol",  label: "RVOL ↕"       },
                      { key: "adx",   label: "ADX ↕"        },
                      { key: "price", label: "Fiyat ↕"      },
                      { key: "chg",   label: "Değ% ↕"       },
                      { key: null,    label: "MACD"          },
                      { key: null,    label: "Opsiyon"       },
                      { key: "rsi",   label: "RSI ↕"        },
                      { key: null,    label: "R/R"           },
                    ].map(({ key, label }) => (
                      <th key={label} onClick={key ? () => toggleSort(key) : undefined}
                        style={{ padding: "8px 10px", textAlign: "left", fontSize: 8, letterSpacing: 1, color: sortBy === key ? "#3b82f6" : "#475569", textTransform: "uppercase", borderBottom: "1px solid #1e2a3a", fontWeight: 500, whiteSpace: "nowrap", cursor: key ? "pointer" : "default", background: "#0f141e" }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map(stock => (
                    <>
                      <tr key={stock.ticker}
                        onClick={() => setExpandedRow(expandedRow === stock.ticker ? null : stock.ticker)}
                        style={{ cursor: "pointer", borderBottom: "1px solid #1a2234", transition: "background .1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#0d1117")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "7px 10px" }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: "#f1f5f9" }}>{stock.ticker}</div>
                          <div style={{ fontSize: 8, color: "#475569", marginTop: 1 }}>{stock.company.length > 16 ? stock.company.slice(0, 16) + "…" : stock.company}</div>
                        </td>
                        <td style={{ padding: "7px 10px" }}><ScoreBar score={stock.boga_score} grade={stock.grade} /></td>
                        <td style={{ padding: "7px 10px" }}><SetupBadge setup={stock.primary_setup ?? "swing"} /></td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ color: stock.rvol >= 3 ? "#f59e0b" : "#94a3b8", fontWeight: stock.rvol >= 3 ? 700 : 400, fontFamily: "monospace" }}>{stock.rvol.toFixed(1)}x</span>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ color: stock.adx >= 25 ? "#22c55e" : "#64748b", fontFamily: "monospace", fontSize: 10 }}>{stock.adx?.toFixed(0) ?? "—"}</span>
                        </td>
                        <td style={{ padding: "7px 10px" }}><span style={{ fontFamily: "monospace", fontSize: 11 }}>${fmt(stock.price)}</span></td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ color: stock.change_1d >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600, fontFamily: "monospace" }}>
                            {stock.change_1d >= 0 ? "+" : ""}{stock.change_1d.toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <MACDDot val={stock.macd} hist={stock.macd_hist} />
                        </td>
                        <td style={{ padding: "7px 10px" }}><OptBadge weekly={stock.has_weekly_options} hasOpt={stock.has_options} /></td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ color: stock.rsi > 70 ? "#ef4444" : stock.rsi >= 55 ? "#22c55e" : "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>{stock.rsi?.toFixed(0)}</span>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ color: "#06b6d4", fontWeight: 700, fontFamily: "monospace", fontSize: 11 }}>{stock.rr_ratio}</span>
                        </td>
                      </tr>
                      {expandedRow === stock.ticker && <DetailRow key={`${stock.ticker}-d`} stock={stock} />}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Market Regime Bar (Architecture §8.1) ──────────────────────────── */}
          <div style={{ background: "#0d1117", borderTop: "1px solid #1e2a3a", padding: "5px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase" }}>Piyasa Rejimi:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: regimeColor }} />
              <span style={{ color: regimeColor, fontWeight: 700 }}>{regime.label}</span>
            </div>
            <div style={{ fontSize: 9, color: "#475569" }}>
              VIX <span style={{ color: (regime.vix_price ?? 20) > 25 ? "#ef4444" : "#f59e0b" }}>{(regime.vix_price ?? 20).toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 9, color: "#334155" }}>|</div>
            <div style={{ fontSize: 9, color: "#475569" }}>
              Strateji Ağırlığı: <span style={{ color: regimeColor }}>{REGIME_MULT_HINT[regime.regime] ?? "Nötr"}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Sep() {
  return <div style={{ width: 1, height: 18, background: "#1e2a3a", flexShrink: 0 }} />;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode; active?: string; activeB?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 8, color: "#334155", letterSpacing: 1, marginRight: 2, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
      {children}
    </div>
  );
}

function FilterBtn({ children, active, acColor, acBorder, onClick }: {
  children: React.ReactNode; active: boolean; acColor: string; acBorder: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{ background: active ? `${acColor}15` : "#141924", border: `1px solid ${active ? acBorder : "#1e2a3a"}`, color: active ? acColor : "#94a3b8", padding: "2px 7px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}
