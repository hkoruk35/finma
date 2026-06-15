"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ScreenerChart from "./screener/ScreenerChart";
import TickerHoverChart from "./TickerHoverChart";
import { useWatchlistModal } from "@/hooks/useWatchlistModal";
import { WatchlistModal } from "./WatchlistModal";
import { exportScreenerResultsToXLS } from "@/lib/exportUtils";

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
  rs_rating: number;
  is_new_high: boolean;
  vol_contraction: boolean;
  triangle_detected?: boolean;
  triangle_score?: number;
  bbw_percentile?: number;
  apex_bars_left?: number;
  upper_trendline?: number;
  lower_trendline?: number;
  target_fib?: number;
  triangle_stop?: number;
  triangle_rr?: number;
}

interface Regime {
  regime: string;
  label: string;
  spy_change: number;
  vix_price: number;
  trend: "bullish" | "bearish" | "choppy";
  momentum: "strong" | "moderate" | "weak";
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Text hierarchy: primary=#e2e8f0  secondary=#b0bec5  tertiary=#7c8fa6  muted=#64748b
// Backgrounds:    base=#0a0c10  panel=#0d1117  surface=#111620  input=#0f141e
// Borders:        border=#1e2a3a  borderFaint=#253347

// ─── Preset Definitions ───────────────────────────────────────────────────────

const PRESETS = [
  // Investment Presets
  { id: "quality_growth",   name: "Quality Growth",      desc: "Rev↑15% · EPS↑10% · Margin≥35% · ROE≥12%", mode: "investment", color: "#06b6d4", pills: ["RevGrowth≥15%","EPS≥10%","Price>SMA200","Margin≥35%","ROE≥12%","MCap≥1B"],                         icon: "💎" },
  { id: "agg_growth",       name: "Aggressive Growth",   desc: "Rev↑30% · Margin≥50% · Rule40≥40",         mode: "investment", color: "#f59e0b", pills: ["RevGrowth≥30%","Acceleration","Margin≥50%","FCF Pozitif","P/S≤30"],                          icon: "🚀" },
  { id: "breakout_growth",  name: "Breakout Growth",     desc: "BOGA≥70 · Golden Cross · RVOL≥2 · ADX≥20", mode: "investment", color: "#10b981", pills: ["BOGA≥70","SMA200↑","RVOL≥2","ADX≥20","Price>EMA20"],                                 icon: "📈" },
  // Swing Presets
  { id: "genel_swing",  name: "Genel Swing",          desc: "Price>EMA10>EMA20 · RVOL≥1.5 · RSI≥50",  mode: "swing",    color: "#06f3aa", pills: ["Price>EMA10>EMA20","RVOL≥1.5","RSI≥50","Trend Filtresi"],    icon: "🎯" },
  { id: "hottest_momo", name: "Hottest Momo",         desc: "$10-$100 · SMA200↑ · RVOL>1.5 · Gün>+2%", mode: "swing",   color: "#f97316", pills: ["$10-$100","AvgVol>1M","RVOL>1.5","MCap>500M","RSI 45-70","SMA200↑","Gün≥+2%","YeniZirve/RVOL"], icon: "🔥" },
  { id: "pre_catalyst", name: "Episodemic Pivot", desc: "MCap≥$300M · RVOL≥2.0 · RSI 45+",      mode: "swing",    color: "#ec4899", pills: ["MCap≥$200M","RVOL≥2.0","RSI 45+","Değ>+2%"],    icon: "🚀" },
  { id: "swing_cont",   name: "Swing Continuation",  desc: "Price>SMA200 · EMA20>EMA50 · RSI 55-70", mode: "swing",    color: "#3b82f6", pills: ["Price>SMA200","EMA20>EMA50","RSI 55-70","RVOL>1.5","MCap>2B"],      icon: "📈" },
  { id: "early_break",  name: "Early Breakout",       desc: "Simetrik Üçgen · BBW%ile · $2-$100",    mode: "swing",    color: "#22c55e", pills: ["Simetrik Üçgen","BBW<30p","$2-$100","SMA50↑","Fib 1.618"],           icon: "📐" },
  // Day & Options Presets
  { id: "day_mom",      name: "Day Trade Momentum",   desc: "Değişim>4% · RVOL>3 · Güçlü hareket",   mode: "day",      color: "#f59e0b", pills: ["Değişim>4%","RVOL>3","Güçlü gün"],                                  icon: "⚡" },
  { id: "opt_sniper",   name: "Options Sniper",       desc: "Haftalık · IV Exp · RVOL>1.3",           mode: "options",  color: "#a855f7", pills: ["Haftalık OPT","IV Expansion","RVOL>1.3","RSI>50"],                 icon: "🎯" },
  { id: "inst_trend",   name: "Institutional Trend",  desc: "MCap>10B · ADX>20 · Price>SMA200",       mode: "position", color: "#06b6d4", pills: ["MCap>10B","Price>SMA200","ADX>20","EMA20>EMA50"],                  icon: "🏛️" },
  { id: "cheap_exp",    name: "Cheap & Explosive",    desc: "Price<$10 · RVOL>2 · Weekly Opt",        mode: "day",      color: "#f43f5e", pills: ["Price<$10","RVOL>2","ATR>4%","Haftalık OPT"],                      icon: "🔥" },
  { id: "ema_cross",    name: "EMA Cross Setup",      desc: "EMA8>EMA20 fresh cross · RVOL>1.3",      mode: "swing",    color: "#10b981", pills: ["EMA8>EMA20 (Fresh)","RVOL>1.3","MACD Bölge"],                      icon: "✂️" },
  { id: "gamma_sq",     name: "Gamma Squeeze",        desc: "Haftalık · ATR>5% · RVOL>2",             mode: "options",  color: "#f97316", pills: ["Haftalık OPT","ATR>5%","MCap<20B","RVOL>2"],                       icon: "🚀" },
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
  { label: "Nano",  id: "nano"  },
  { label: "Micro", id: "micro" },
  { label: "Small", id: "small" },
  { label: "Mid",   id: "mid"   },
  { label: "Large", id: "large" },
  { label: "Mega",  id: "mega"  },
];

const LIQ_RANGES = [
  { label: "Düşük (<500K)",   id: "low"  },
  { label: "Orta (500K-5M)",  id: "mid"  },
  { label: "Yüksek (5M-50M)", id: "high" },
  { label: "Kurumsal (50M+)", id: "inst" },
];

const OPT_RANGES = [
  { label: "Haftalık", id: "weekly"      },
  { label: "Var",      id: "has_options" },
  { label: "Yok",      id: "no_options"  },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function ScoreBar({ score, grade }: { score: number; grade?: string }) {
  const color = score >= 80 ? "#22c55e" : score >= 65 ? "#f59e0b" : score >= 50 ? "#3b82f6" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <span style={{ color, minWidth: 28, fontSize: 13, fontWeight: 900, fontFamily: "monospace" }}>{score}</span>
      <div style={{ width: 40, height: 4, background: "#253347", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      {grade && (
        <span style={{ fontSize: 10, fontWeight: 700, color, border: `1px solid ${color}`, padding: "1px 4px", borderRadius: 2 }}>{grade}</span>
      )}
    </div>
  );
}

function SetupBadge({ setup }: { setup: string }) {
  const MAP: Record<string, { bg: string; color: string; border: string }> = {
    swing:    { bg: "#0a2a4a", color: "#60a5fa", border: "#3b82f6" },
    day:      { bg: "#4a2e08", color: "#fbbf24", border: "#f59e0b" },
    options:  { bg: "#2a0a4a", color: "#c084fc", border: "#a855f7" },
    momentum: { bg: "#0a2a0a", color: "#4ade80", border: "#22c55e" },
    breakout: { bg: "#0a3020", color: "#34d399", border: "#10b981" },
  };
  const cfg = MAP[setup] || MAP.swing;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px" }}>
      {setup.toUpperCase()}
    </span>
  );
}

function OptBadge({ weekly, hasOpt }: { weekly: boolean; hasOpt: boolean }) {
  if (weekly) return <span style={{ color: "#c084fc", fontSize: 11, fontWeight: 700 }}>📅 Haftalık</span>;
  if (hasOpt) return <span style={{ color: "#a78bfa", fontSize: 11 }}>✓ Var</span>;
  return <span style={{ color: "#64748b", fontSize: 11 }}>—</span>;
}

function MACDDot({ val, hist }: { val: number; hist: number }) {
  const positive = val > 0 && hist > 0;
  const rising   = hist > 0;
  const color    = positive ? "#4ade80" : rising ? "#fbbf24" : "#f87171";
  const label    = positive ? "↑ Pozitif" : rising ? "↗ Yükseliyor" : "↓ Negatif";
  return <span style={{ color, fontSize: 10, fontWeight: 600 }}>{label}</span>;
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

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ stock }: { stock: ScreenerResult }) {
  return (
    <tr style={{ background: "#0d1117" }}>
      <td colSpan={11} style={{ padding: "14px 18px" }}>

        {stock.warnings?.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {stock.warnings.map(w => (
              <div key={w} style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)", color: "#fbbf24", fontSize: 10, padding: "4px 10px", borderRadius: 4 }}>
                ⚠️ {w}
              </div>
            ))}
          </div>
        )}

        {stock.setup_signals?.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#7c8fa6", marginRight: 4, letterSpacing: 1, fontWeight: 600 }}>AKTİF SİNYALLER:</span>
            {stock.setup_signals.map(s => (
              <span key={s} style={{ background: "#0a2a0a", border: "1px solid #166534", color: "#4ade80", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>✓ {s}</span>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {/* Technical Panel */}
          <div style={{ background: "#111620", border: "1px solid #253347", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Teknik Göstergeler</div>
            {[
              ["EMA Yapısı",  stock.ema_structure,                                                                 stock.trend_direction === "up" ? "#4ade80" : "#f87171"],
              ["SMA 200",     `$${fmt(stock.sma200)} ${stock.price > stock.sma200 ? "✓" : "✗"}`,                  stock.price > stock.sma200 ? "#4ade80" : "#f87171"],
              ["RSI (14)",    fmt(stock.rsi, 1),                                                                    stock.rsi > 72 ? "#f87171" : stock.rsi >= 55 ? "#4ade80" : "#b0bec5"],
              ["MACD",        stock.macd > 0 ? `+${fmt(stock.macd, 3)}` : fmt(stock.macd, 3),                     stock.macd > 0 ? "#4ade80" : "#f87171"],
              ["ADX (14)",    fmt(stock.adx, 1),                                                                    stock.adx >= 25 ? "#fbbf24" : "#b0bec5"],
              ["ATR%",        `${stock.atr_pct}%`,                                                                  "#b0bec5"],
              ["ROC(10)",     `${stock.roc10 > 0 ? "+" : ""}${fmt(stock.roc10, 1)}%`,                              stock.roc10 > 0 ? "#4ade80" : "#f87171"],
              ["BB%",         fmt(stock.bb_pct, 2),                                                                 stock.bb_pct > 0.8 ? "#f87171" : stock.bb_pct < 0.2 ? "#4ade80" : "#b0bec5"],
              ["EMA8/20/50",  `${fmt(stock.ema8,1)}/${fmt(stock.ema20,1)}/${fmt(stock.ema50,1)}`,                  "#94a3b8"],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{label}</span>
                <span style={{ fontSize: 10, color: color as string, fontFamily: "monospace", fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Market Data Panel */}
          <div style={{ background: "#111620", border: "1px solid #253347", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Piyasa Verileri</div>
            {[
              ["Destek (52H)",    `$${fmt(stock.support)}`,                                                                        "#4ade80"],
              ["Direnç (52H)",    `$${fmt(stock.resistance)}`,                                                                     "#fbbf24"],
              ["52H'den Uzaklık", `${stock.pct_from_52w_high > 0 ? "+" : ""}${stock.pct_from_52w_high}%`,                         stock.pct_from_52w_high >= -5 ? "#4ade80" : "#b0bec5"],
              ["Dollar Hacim",    fmtVol(stock.volume * stock.price),                                                              "#b0bec5"],
              ["Ort. Hacim",      fmtVol(stock.avg_volume * stock.price),                                                         "#94a3b8"],
              ["Market Cap",      fmtCap(stock.market_cap),                                                                        "#b0bec5"],
              ["Cap Kademesi",    stock.market_cap_label,                                                                          "#94a3b8"],
              ["IV Tahmini",      `${stock.iv_est}%`,                                                                              stock.iv_est > 80 ? "#fbbf24" : "#b0bec5"],
              ["RS Rating",       `${stock.rs_rating ?? "—"} ${(stock.rs_rating ?? 0) >= 80 ? "🔥" : (stock.rs_rating ?? 0) >= 60 ? "↑" : ""}`, (stock.rs_rating ?? 0) >= 80 ? "#22c55e" : (stock.rs_rating ?? 0) >= 60 ? "#fbbf24" : "#94a3b8"],
              ["Yeni Zirve",      stock.is_new_high ? "✓ 52H Zirvesi" : "—",                                                    stock.is_new_high ? "#4ade80" : "#64748b"],
              ["VCP (Hacim)",     stock.vol_contraction ? "✓ Hacim Kurudu" : "—",                                               stock.vol_contraction ? "#a78bfa" : "#64748b"],
              ["Sektör",          stock.sector || "—",                                                                             "#94a3b8"],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{label}</span>
                <span style={{ fontSize: 10, color: color as string, fontFamily: "monospace", fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Trade Plan */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "GİRİŞ", value: `$${fmt(stock.entry)}`,  bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.4)",  color: "#4ade80" },
                { label: "STOP",  value: `$${fmt(stock.stop)}`,   bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.4)",  color: "#f87171" },
                { label: "HEDEF", value: `$${fmt(stock.target)}`, bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.4)", color: "#60a5fa" },
                { label: "R/R",   value: stock.rr_ratio,          bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.4)", color: "#fbbf24" },
              ].map(p => (
                <div key={p.label} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 6, padding: "9px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: p.color, letterSpacing: 1, opacity: 0.85, fontWeight: 700 }}>{p.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: p.color, marginTop: 3, fontFamily: "monospace" }}>{p.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#111620", border: "1px solid #253347", borderRadius: 6, padding: "9px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Risk %</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{stock.risk_pct}%</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Link href={`/stock/${stock.ticker}`}
                style={{ background: "#0a2a4a", border: "1px solid #3b82f6", color: "#60a5fa", padding: "7px 0", borderRadius: 4, fontSize: 11, fontWeight: 700, textAlign: "center", display: "block" }}>
                Detay ↗
              </Link>
              <Link href={`/terminal?ticker=${stock.ticker}`}
                style={{ background: "#0a2a0a", border: "1px solid #22c55e", color: "#4ade80", padding: "7px 0", borderRadius: 4, fontSize: 11, fontWeight: 700, textAlign: "center", display: "block" }}>
                Chart ↗
              </Link>
            </div>
          </div>

          {/* Options Quality */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: "#111620", border: "1px solid #253347", borderRadius: 6, padding: "12px 14px", flex: 1 }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Opsiyon Kalitesi</div>
              {[
                ["Haftalık Zincir", stock.has_weekly_options ? "✓ Mevcut" : "✗ Yok",         stock.has_weekly_options ? "#4ade80" : "#f87171"],
                ["Opsiyon Var",     stock.has_options ? "✓" : "✗",                            stock.has_options ? "#4ade80" : "#64748b"],
                ["IV Tahmini",      `${stock.iv_est}%`,                                        stock.iv_est > 80 ? "#fbbf24" : "#b0bec5"],
                ["Options Skoru",   `${stock.options_score}/100`,                              "#c084fc"],
                ["MACD Durumu",     stock.macd > 0 ? "Pozitif ✓" : "Negatif",                stock.macd > 0 ? "#4ade80" : "#f87171"],
              ].map(([label, value, color]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{label}</span>
                  <span style={{ fontSize: 10, color: color as string, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOGA Score Breakdown */}
        <div style={{ marginTop: 12, background: "#111620", border: "1px solid #253347", borderRadius: 6, padding: "12px 16px" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "1.5px", marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>BOGA Score Bileşenleri</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Trend",    score: stock.trend_score,     color: "#4ade80", desc: "EMA·SMA200·ADX·52H" },
              { label: "Momentum", score: stock.momentum_score,  color: "#60a5fa", desc: "RVOL·RSI·MACD·ROC"  },
              { label: "Likidite", score: stock.liquidity_score, color: "#fbbf24", desc: "DolVol·MCap·RVOL"   },
              { label: "Opsiyon",  score: stock.options_score,   color: "#c084fc", desc: "Haftalık·OI·Spread·IV" },
            ].map(({ label, score, color, desc }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 10, color: "#b0bec5", display: "block", fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 9, color: "#7c8fa6" }}>{desc}</span>
                  </div>
                  <span style={{ fontSize: 13, color, fontWeight: 800, fontFamily: "monospace" }}>{score}</span>
                </div>
                <div style={{ height: 4, background: "#253347", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Triangle Pattern Panel */}
        {stock.triangle_detected && (
          <div style={{ marginTop: 12, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: "1.5px", marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
              📐 Simetrik Üçgen Pattern
              <span style={{ marginLeft: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", padding: "2px 8px", borderRadius: 10, fontSize: 10 }}>
                Skor: {stock.triangle_score}/100
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {[
                { label: "BBW Percentile", value: `${stock.bbw_percentile}p`, color: (stock.bbw_percentile ?? 100) < 20 ? "#4ade80" : (stock.bbw_percentile ?? 100) < 30 ? "#fbbf24" : "#b0bec5" },
                { label: "Apeks Mesafesi", value: `~${stock.apex_bars_left} mum`,  color: "#b0bec5" },
                { label: "Üst TL",         value: `$${stock.upper_trendline?.toFixed(2) ?? "—"}`, color: "#f87171" },
                { label: "Alt TL",         value: `$${stock.lower_trendline?.toFixed(2) ?? "—"}`, color: "#4ade80" },
                { label: "Fib 1.618 Hedef",value: `$${stock.target_fib?.toFixed(2) ?? "—"}`,      color: "#fbbf24" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#111620", border: "1px solid #253347", borderRadius: 4, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#7c8fa6", marginBottom: 4, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#111620", border: "1px solid #253347", borderRadius: 4, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Triangle Stop</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171", fontFamily: "monospace" }}>${stock.triangle_stop?.toFixed(2) ?? "—"}</span>
              </div>
              <div style={{ background: "#111620", border: "1px solid #253347", borderRadius: 4, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>R/R (Fib 1.618)</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", fontFamily: "monospace" }}>{stock.triangle_rr}x</span>
              </div>
            </div>
          </div>
        )}

        {/* Chart Widget */}
        <ScreenerChart ticker={stock.ticker} />

      </td>
    </tr>
  );
}

// ─── Regime Label ─────────────────────────────────────────────────────────────

const REGIME_COLORS: Record<string, string> = {
  bull_trending:  "#22c55e", bull_choppy:    "#84cc16", neutral:       "#94a3b8",
  bear_choppy:    "#f97316", bear_trending:  "#ef4444", high_volatility: "#f59e0b", low_volatility: "#06b6d4",
};
const REGIME_MULT_HINT: Record<string, string> = {
  bull_trending:   "Swing +20% · Breakout +15% · Day +10%",
  bull_choppy:     "Swing -15% · Reversion +10%",
  neutral:         "Tüm stratejiler nötr ağırlık",
  bear_choppy:     "Swing -60% · Options +10% · Mean Rev. aktif",
  bear_trending:   "Swing -80% · Options Short · Day -30%",
  high_volatility: "Day Trade +40% · Options Sniper +30%",
  low_volatility:  "BB Squeeze +40% · Options (ucuz IV) +30%",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScreenerCockpit() {
  const [activePreset, setActivePreset] = useState("genel_swing");
  const currentPreset = PRESETS.find(p => p.id === activePreset);
  const presetPills   = currentPreset?.pills || [];

  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [capFilter,  setCapFilter]  = useState("all");
  const [optFilter,  setOptFilter]  = useState("all");
  const [liqFilter,  setLiqFilter]  = useState("all");
  const [rvolMin,    setRvolMin]    = useState<number | null>(null);
  const [rsiMin,     setRsiMin]     = useState<number | null>(null);
  const [rsiMax,     setRsiMax]     = useState<number | null>(null);
  const [adxMin,     setAdxMin]     = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const watchlist = useWatchlistModal();

  const getActiveFilters = () => {
    const filters: string[] = [];
    if (priceRange) filters.push(`$${priceRange.min}-${priceRange.max}`);
    if (capFilter !== "all") filters.push(`Cap: ${CAP_RANGES.find(c => c.id === capFilter)?.label || capFilter}`);
    if (liqFilter !== "all") filters.push(`Liq: ${LIQ_RANGES.find(l => l.id === liqFilter)?.label || liqFilter}`);
    if (optFilter !== "all") filters.push(`Opt: ${OPT_RANGES.find(o => o.id === optFilter)?.label || optFilter}`);
    if (rvolMin !== null) filters.push(`RVOL>${rvolMin.toFixed(1)}`);
    if (rsiMin !== null || rsiMax !== null) filters.push(`RSI ${rsiMin || "0"}-${rsiMax || "100"}`);
    if (adxMin !== null) filters.push(`ADX>${adxMin}`);
    return filters;
  };
  const activeFilters = getActiveFilters();
  const allPills = [...presetPills, ...activeFilters];

  const [results,     setResults]     = useState<ScreenerResult[]>([]);
  const [isScanning,  setIsScanning]  = useState(false);
  const [scanMeta,    setScanMeta]    = useState({ total: 0, scanned: 0, universe: 0 });
  const [lastScan,    setLastScan]    = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy,      setSortBy]      = useState("score");
  const [sortDir,     setSortDir]     = useState<1 | -1>(-1);
  const [regime,      setRegime]      = useState<Regime>({ regime: "neutral", label: "Nötr", spy_change: 0, vix_price: 20, trend: "choppy", momentum: "moderate" });

  const runScan = useCallback(async () => {
    setIsScanning(true);
    setExpandedRow(null);
    try {
      const params = new URLSearchParams({ preset: activePreset, cap: capFilter, opt: optFilter, liq: liqFilter, sort: sortBy, limit: "100" });
      if (priceRange) { params.set("priceMin", String(priceRange.min)); params.set("priceMax", String(priceRange.max)); }
      if (rvolMin !== null) params.set("rvolMin", String(rvolMin));
      if (rsiMin  !== null) params.set("rsiMin",  String(rsiMin));
      if (rsiMax  !== null) params.set("rsiMax",  String(rsiMax));
      if (adxMin  !== null) params.set("adxMin",  String(adxMin));
      const res  = await fetch(`/api/screener?${params}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setResults(data.results || []);
      setScanMeta({ total: data.total, scanned: data.scanned, universe: data.universe_size });
      if (data.regime) setRegime(data.regime);
      setLastScan(new Date().toLocaleTimeString("tr-TR"));

      // Save to archive
      try {
        await fetch("/api/screener-archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preset: activePreset,
            results: data.results || [],
            regime: data.regime,
          }),
        });
      } catch (archiveError) {
        console.error("Archive save error:", archiveError);
      }
    } catch (e) {
      console.error("Screener error:", e);
    } finally {
      setIsScanning(false);
    }
  }, [activePreset, capFilter, optFilter, liqFilter, sortBy, priceRange, rvolMin, rsiMin, rsiMax, adxMin]);

  useEffect(() => { runScan(); }, [activePreset]); // eslint-disable-line react-hooks/exhaustive-deps

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
        case "rs":    return s.rs_rating ?? 0;
        default:      return s.boga_score;
      }
    };
    return (v(a) - v(b)) * sortDir;
  });

  const selectPreset  = (p: typeof PRESETS[0]) => { setActivePreset(p.id); };
  const regimeColor   = REGIME_COLORS[regime.regime] ?? "#94a3b8";

  const removeFilter = (filterText: string) => {
    if (filterText.includes("$"))    setPriceRange(null);
    else if (filterText.includes("Cap:"))  setCapFilter("all");
    else if (filterText.includes("Liq:"))  setLiqFilter("all");
    else if (filterText.includes("Opt:"))  setOptFilter("all");
    else if (filterText.includes("RVOL"))  setRvolMin(null);
    else if (filterText.includes("RSI"))   { setRsiMin(null); setRsiMax(null); }
    else if (filterText.includes("ADX"))   setAdxMin(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0a0c10", minHeight: "calc(100vh - 64px)", fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace", fontSize: 13, color: "#e2e8f0" }}>

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2a3a", padding: "9px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#22c55e" }}>
            BOGA <span style={{ color: "#7c8fa6", fontWeight: 400, fontSize: 12 }}>SCREENER v2</span>
          </div>
          <div style={{ fontSize: 11, color: "#7c8fa6", letterSpacing: 0.5 }}>
            {scanMeta.universe > 0 ? `${scanMeta.universe} hisse evreni` : "Yükleniyor..."}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111620", border: `1px solid ${regimeColor}40`, padding: "4px 12px", borderRadius: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: regimeColor }} />
            <span style={{ fontSize: 11, color: regimeColor, fontWeight: 700 }}>{regime.label}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>CANLI</span>
          </div>
          {lastScan && (
            <span style={{ fontSize: 11, color: "#7c8fa6" }}>
              Son tarama: <span style={{ color: "#b0bec5" }}>{lastScan}</span>
            </span>
          )}
          <span style={{ fontSize: 11, color: "#7c8fa6" }}>
            SPY <span style={{ color: regime.spy_change >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
              {regime.spy_change >= 0 ? "+" : ""}{(regime.spy_change ?? 0).toFixed(2)}%
            </span>
          </span>
          <span style={{ fontSize: 11, color: "#7c8fa6" }}>
            VIX <span style={{ color: (regime.vix_price ?? 20) > 25 ? "#f87171" : "#fbbf24", fontWeight: 700 }}>
              {(regime.vix_price ?? 20).toFixed(1)}
            </span>
          </span>
          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: showFilters ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.07)",
              border: `1px solid ${showFilters ? "rgba(59,130,246,0.6)" : "rgba(59,130,246,0.25)"}`,
              color: showFilters ? "#60a5fa" : "#7c8fa6",
              padding: "4px 11px", borderRadius: 4, cursor: "pointer",
              fontSize: 10, fontFamily: "inherit", fontWeight: 700, letterSpacing: 0.8,
              transition: "all .15s"
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {showFilters ? "FİLTRELERİ GİZLE" : "FİLTRELERİ GÖSTER"}
            {activeFilters.length > 0 && (
              <span style={{ background: "#3b82f6", color: "#fff", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Filter Bar (collapsible) ──────────────────────────────────────── */}
      {showFilters && (
      <div style={{ background: "#0f141e", borderBottom: "1px solid #1e2a3a", padding: "8px 18px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <FilterRow label="Fiyat">
          {PRICE_RANGES.map(r => (
            <FilterBtn key={r.label} active={priceRange?.min === r.min} acColor="#3b82f6" acBorder="#3b82f6" onClick={() => setPriceRange(priceRange?.min === r.min ? null : r)}>{r.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        <FilterRow label="Market Cap">
          {CAP_RANGES.map(c => (
            <FilterBtn key={c.id} active={capFilter === c.id} acColor="#3b82f6" acBorder="#3b82f6" onClick={() => setCapFilter(capFilter === c.id ? "all" : c.id)}>{c.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        <FilterRow label="Likidite">
          {LIQ_RANGES.map(l => (
            <FilterBtn key={l.id} active={liqFilter === l.id} acColor="#06b6d4" acBorder="#06b6d4" onClick={() => setLiqFilter(liqFilter === l.id ? "all" : l.id)}>{l.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        <FilterRow label="Opsiyon">
          {OPT_RANGES.map(o => (
            <FilterBtn key={o.label} active={optFilter === o.id} acColor="#a855f7" acBorder="#a855f7" onClick={() => setOptFilter(optFilter === o.id ? "all" : o.id)}>{o.label}</FilterBtn>
          ))}
        </FilterRow>
        <Sep />
        <FilterRow label="Gelişmiş">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <label style={{ fontSize: 10, color: "#b0bec5", fontWeight: 600, whiteSpace: "nowrap" }}>RVOL</label>
              <input type="number" min="0.5" max="5" step="0.1" value={rvolMin ?? ""} placeholder="1.5"
                onChange={e => setRvolMin(e.target.value ? parseFloat(e.target.value) : null)}
                style={{ width: 48, padding: "3px 7px", borderRadius: 3, border: "1px solid #253347", background: "#0f141e", color: "#b0bec5", fontSize: 10, fontFamily: "inherit" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <label style={{ fontSize: 10, color: "#b0bec5", fontWeight: 600, whiteSpace: "nowrap" }}>RSI</label>
              <input type="number" min="0" max="100" step="1" value={rsiMin ?? ""} placeholder="min"
                onChange={e => setRsiMin(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: 38, padding: "3px 7px", borderRadius: 3, border: "1px solid #253347", background: "#0f141e", color: "#b0bec5", fontSize: 10, fontFamily: "inherit" }}
              />
              <span style={{ fontSize: 10, color: "#7c8fa6" }}>-</span>
              <input type="number" min="0" max="100" step="1" value={rsiMax ?? ""} placeholder="max"
                onChange={e => setRsiMax(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: 38, padding: "3px 7px", borderRadius: 3, border: "1px solid #253347", background: "#0f141e", color: "#b0bec5", fontSize: 10, fontFamily: "inherit" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <label style={{ fontSize: 10, color: "#b0bec5", fontWeight: 600, whiteSpace: "nowrap" }}>ADX</label>
              <input type="number" min="0" max="50" step="1" value={adxMin ?? ""} placeholder="20"
                onChange={e => setAdxMin(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: 43, padding: "3px 7px", borderRadius: 3, border: "1px solid #253347", background: "#0f141e", color: "#b0bec5", fontSize: 10, fontFamily: "inherit" }}
              />
            </div>
          </div>
        </FilterRow>
      </div>
      )}

      {/* ── Main Area ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", height: "calc(100vh - 192px)", minHeight: 500 }}>

        {/* ── Left Panel ───────────────────────────────────────────────────────── */}
        <div style={{ width: 220, background: "#0d1117", borderRight: "1px solid #1e2a3a", flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px 6px", fontSize: 10, letterSpacing: "1.5px", color: "#7c8fa6", textTransform: "uppercase", fontWeight: 700 }}>Stratejiler</div>
          {(() => {
            const modes = ["swing", "investment", "day", "options", "position"];
            const modeLabels: Record<string, string> = {
              investment: "📊 INVESTMENT",
              swing: "📈 SWING",
              day: "⚡ DAY",
              options: "📋 OPTIONS",
              position: "🏛️ POSITION"
            };
            return modes.map((mode, modeIdx) => {
              const modePresets = PRESETS.filter(p => p.mode === mode);
              if (modePresets.length === 0) return null;
              return (
                <div key={mode}>
                  <div style={{ padding: "10px 14px 4px", fontSize: 9, letterSpacing: "1px", color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginTop: modeIdx === 0 ? 0 : 6 }}>{modeLabels[mode]}</div>
                  {modePresets.map(p => (
                    <button key={p.id} onClick={() => selectPreset(p)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", cursor: "pointer", border: "none", background: activePreset === p.id ? "#111620" : "none", borderLeft: `2px solid ${activePreset === p.id ? p.color : "transparent"}`, transition: "all .15s" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: activePreset === p.id ? p.color : "#b0bec5", fontFamily: "inherit" }}>{p.icon} {p.name}</div>
                      <div style={{ fontSize: 10, color: activePreset === p.id ? "#94a3b8" : "#7c8fa6", marginTop: 2, fontFamily: "inherit" }}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              );
            });
          })()}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2a3a", padding: "8px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={runScan} disabled={isScanning}
              style={{ background: isScanning ? "#111620" : "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.5)", color: "#4ade80", padding: "6px 16px", borderRadius: 4, cursor: isScanning ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              {isScanning ? "⏳ Taranıyor..." : "📡 TARA"}
            </button>

            <button onClick={() => setShowFilters(v => !v)}
              style={{
                background: showFilters ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.07)",
                border: `1px solid ${showFilters ? "rgba(59,130,246,0.6)" : "rgba(59,130,246,0.25)"}`,
                color: "#60a5fa",
                padding: "6px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 700,
                letterSpacing: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all .15s"
              }}
            >
              {showFilters ? "👁️ FİLTRELERİ GİZLE" : "👁️ FİLTRELERİ GÖSTER"}
            </button>

            <Link href="/screener/archive"
              style={{ background: "rgba(160,174,192,0.12)", border: "1px solid rgba(160,174,192,0.5)", color: "#a0aefc", padding: "6px 16px", borderRadius: 4, textDecoration: "none", fontSize: 12, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              📚 ARŞİV
            </Link>

            {sortedResults.length > 0 && (
              <button onClick={() => exportScreenerResultsToXLS(sortedResults, currentPreset?.name || "screener")}
                style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.5)", color: "#60a5fa", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
                📥 XLS INDIR
              </button>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {allPills.map((pill, idx) => {
                const isRemovable = idx >= presetPills.length;
                return (
                  <div key={pill} style={{ background: isRemovable ? "#141924" : "#0a1f1a", border: `1px solid ${isRemovable ? "#253347" : "#1e3a2a"}`, color: isRemovable ? "#b0bec5" : "#5eead4", padding: "3px 10px", borderRadius: 10, fontSize: 10, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                    {pill}
                    {isRemovable && <span style={{ fontSize: 11, cursor: "pointer", color: "#7c8fa6" }} onClick={() => removeFilter(pill)}>✕</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 11, color: "#7c8fa6", marginLeft: "auto", textAlign: "right" }}>
              {scanMeta.total > 0 && (
                <>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>{sortedResults.length}</span>
                  {scanMeta.total > sortedResults.length && (
                    <span style={{ color: "#7c8fa6" }}>/{scanMeta.total}</span>
                  )}
                  <span style={{ color: "#94a3b8" }}> gösteriliyor · </span>
                  <span style={{ color: "#7c8fa6" }}>{scanMeta.scanned} tarandı</span>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isScanning ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 16 }}>
                <div style={{ width: 44, height: 44, border: "3px solid #253347", borderTop: "3px solid #22c55e", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Evren taranıyor...</div>
                <div style={{ fontSize: 11, color: "#7c8fa6" }}>EMA8/13/20/21/50/200 · MACD · ADX · RSI · ATR · BB · RVOL</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Multi-Stage Pipeline · BOGA Score · Regime Multiplier</div>
              </div>
            ) : results.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 14 }}>
                <div style={{ fontSize: 44 }}>{lastScan ? "📭" : "📡"}</div>
                <div style={{ fontSize: 15, color: "#94a3b8", fontWeight: 600 }}>{lastScan ? "Sonuç bulunamadı" : "Tarama başlatılmadı"}</div>
                <div style={{ fontSize: 12, color: "#7c8fa6" }}>
                  {lastScan ? "Mevcut filtrelere uyan hisse yok. Filtreleri gevşetmeyi deneyin." : "Bir strateji seç veya TARA butonuna bas"}
                </div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0f141e", position: "sticky", top: 0, zIndex: 1 }}>
                    {[
                      { key: null,    label: "Ticker"       },
                      { key: null,    label: "Setup"        },
                      { key: "price", label: "Fiyat ↕"     },
                      { key: "chg",   label: "Değ% ↕"      },
                      { key: null,    label: "MACD"         },
                      { key: "rsi",   label: "RSI ↕"       },
                      { key: null,    label: "R/R"          },
                      { key: null,    label: "Watchlist"    },
                      { key: "score", label: "Score ↕"     },
                      { key: "rvol",  label: "RVOL ↕"      },
                      { key: "adx",   label: "ADX ↕"       },
                      { key: "rs",    label: "RS ↕"        },
                    ].map(({ key, label }) => (
                      <th key={label} onClick={key ? () => toggleSort(key) : undefined}
                        style={{ padding: "9px 11px", textAlign: "left", fontSize: 9, letterSpacing: 1, color: sortBy === key ? "#60a5fa" : "#7c8fa6", textTransform: "uppercase", borderBottom: "1px solid #1e2a3a", fontWeight: 700, whiteSpace: "nowrap", cursor: key ? "pointer" : "default", background: "#0f141e" }}>
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
                        <td style={{ padding: "8px 11px" }}>
                          <TickerHoverChart ticker={stock.ticker}><div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", display: "inline" }}>{stock.ticker}</div></TickerHoverChart>
                          <div style={{ fontSize: 10, color: "#7c8fa6", marginTop: 2 }}>{stock.company.length > 16 ? stock.company.slice(0, 16) + "…" : stock.company}</div>
                        </td>
                        <td style={{ padding: "8px 11px" }}><SetupBadge setup={stock.primary_setup ?? "swing"} /></td>
                        <td style={{ padding: "8px 11px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>${fmt(stock.price)}</span>
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <span style={{ color: stock.change_1d >= 0 ? "#4ade80" : "#f87171", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>
                            {stock.change_1d >= 0 ? "+" : ""}{stock.change_1d.toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <MACDDot val={stock.macd} hist={stock.macd_hist} />
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <span style={{ color: stock.rsi > 70 ? "#f87171" : stock.rsi >= 55 ? "#4ade80" : "#b0bec5", fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{stock.rsi?.toFixed(0)}</span>
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <span style={{ color: "#22d3ee", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{stock.rr_ratio}</span>
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <button onClick={(e) => { e.stopPropagation(); watchlist.openModal(stock.ticker); watchlist.addToWatchlist(stock.ticker); }}
                            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", padding: "4px 8px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, transition: "all .15s" }}>
                            ➕ Ekle
                          </button>
                        </td>
                        <td style={{ padding: "8px 11px" }}><ScoreBar score={stock.boga_score} grade={stock.grade} /></td>
                        <td style={{ padding: "8px 11px" }}>
                          <span style={{ color: stock.rvol >= 3 ? "#fbbf24" : "#b0bec5", fontWeight: stock.rvol >= 3 ? 700 : 400, fontFamily: "monospace", fontSize: 12 }}>{stock.rvol.toFixed(1)}x</span>
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <span style={{ color: stock.adx >= 25 ? "#4ade80" : "#94a3b8", fontFamily: "monospace", fontSize: 12, fontWeight: stock.adx >= 25 ? 700 : 400 }}>{stock.adx?.toFixed(0) ?? "—"}</span>
                        </td>
                        <td style={{ padding: "8px 11px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{
                              color: (stock.rs_rating ?? 0) >= 80 ? "#22c55e" : (stock.rs_rating ?? 0) >= 60 ? "#fbbf24" : "#94a3b8",
                              fontFamily: "monospace", fontSize: 12,
                              fontWeight: (stock.rs_rating ?? 0) >= 70 ? 700 : 400
                            }}>{stock.rs_rating ?? "—"}</span>
                            {stock.is_new_high && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, letterSpacing: 0.5 }}>🔝 YENİ ZİRVE</span>}
                            {stock.vol_contraction && <span style={{ fontSize: 9, color: "#a78bfa", fontWeight: 700, letterSpacing: 0.5 }}>VCP ✓</span>}
                          </div>
                        </td>
                      </tr>
                      {expandedRow === stock.ticker && <DetailRow key={`${stock.ticker}-d`} stock={stock} />}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Regime Bar ───────────────────────────────────────────────────────── */}
          <div style={{ background: "#0d1117", borderTop: "1px solid #1e2a3a", padding: "6px 18px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#7c8fa6", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Piyasa Rejimi:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: regimeColor }} />
              <span style={{ color: regimeColor, fontWeight: 700 }}>{regime.label}</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              VIX <span style={{ color: (regime.vix_price ?? 20) > 25 ? "#f87171" : "#fbbf24", fontWeight: 700 }}>{(regime.vix_price ?? 20).toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>|</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Strateji Ağırlığı: <span style={{ color: regimeColor, fontWeight: 600 }}>{REGIME_MULT_HINT[regime.regime] ?? "Nötr"}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <WatchlistModal
        isOpen={watchlist.isOpen}
        message={watchlist.message}
        isLoading={watchlist.isLoading}
        onClose={watchlist.closeModal}
      />
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Sep() {
  return <div style={{ width: 1, height: 20, background: "#253347", flexShrink: 0 }} />;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 9, color: "#7c8fa6", letterSpacing: 1, marginRight: 3, textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  );
}

function FilterBtn({ children, active, acColor, acBorder, onClick }: {
  children: React.ReactNode; active: boolean; acColor: string; acBorder: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{ background: active ? `${acColor}20` : "#141924", border: `1px solid ${active ? acBorder : "#253347"}`, color: active ? acColor : "#b0bec5", padding: "3px 9px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap", fontWeight: active ? 700 : 400 }}>
      {children}
    </button>
  );
}
