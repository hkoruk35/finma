"use client";

import { useEffect, useState } from "react";
import { copy, type Locale } from "@/lib/i18n/copy";
import ScreenerChart from "@/components/screener/ScreenerChart";

interface PreorderAnalysis {
  ticker: string;
  company: string;
  price: number;
  changePct: number;
  volume: number;
  avgVol30: number;
  rvol: number;
  context: { hi52: number; lo52: number; pct52h: number; atr: number; atrPct: number };
  timeframes: {
    d1: { ema9: number; ema20: number; ema50: number; ema200: number; rsi: number; pattern: string };
  };
  momentum: { macd: number; macdSignal: number; macdHist: number; adx: number; roc10: number; bbPercent: number };
  bogaScore: { trend: number; momentum: number; liquidity: number };
  tradePlan: {
    stagedEntry: { pct: number; price: number; label: string }[];
    stagedExit: { pct: number; price: number; label: string; rr: number }[];
    stop: { price: number; pct: number };
    rr1: number;
  };
  activeSignals: string[];
  warnings: string[];
}

function fmt(n: number | undefined, dec = 2): string {
  return n === undefined || Number.isNaN(n) ? "—" : n.toFixed(dec);
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

export default function TickerDetailPanel({ ticker, locale, fullPage, hideChart, hidePermalink }: { ticker: string; locale: Locale; fullPage?: boolean; hideChart?: boolean; hidePermalink?: boolean }) {
  const t = copy[locale].top100.detail;
  const [data, setData] = useState<PreorderAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const langParam = locale === "en" ? "&lang=en" : "";
    fetch(`/api/preorder-analysis?ticker=${encodeURIComponent(ticker)}${langParam}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.error) setError(t.error);
        else setData(d);
      })
      .catch(() => active && setError(t.error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ticker, t.error, locale]);

  const permalinkHref = locale === "en" ? `/en/stock/${ticker}` : `/global/tr/hisse/${ticker}`;

  if (loading) {
    return <div className="py-10 text-center text-sm text-white/40">{t.loading}</div>;
  }
  if (error || !data) {
    return <div className="py-10 text-center text-sm text-red-400">{error || t.error}</div>;
  }

  const d1 = data.timeframes.d1;
  const scoreBars = [
    { label: t.trend, score: data.bogaScore.trend, color: "#4ade80" },
    { label: t.momentum, score: data.bogaScore.momentum, color: "#60a5fa" },
    { label: t.liquidity, score: data.bogaScore.liquidity, color: "#fbbf24" },
  ];

  return (
    <div className={fullPage ? "max-w-5xl mx-auto px-4 py-8" : "p-4"}>
      {fullPage && (
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white tracking-tighter">
            {data.ticker} <span className="text-white/40 text-lg font-medium">{data.company}</span>
          </h1>
          <p className="text-2xl font-mono font-bold text-white mt-1">
            ${fmt(data.price)}{" "}
            <span className={data.changePct >= 0 ? "text-green-400" : "text-red-400"}>
              {data.changePct >= 0 ? "+" : ""}
              {fmt(data.changePct)}%
            </span>
          </p>
        </div>
      )}

      {data.warnings?.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {data.warnings.map((w) => (
            <div key={w} className="bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs px-2.5 py-1 rounded">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {data.activeSignals?.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap items-center">
          <span className="text-xs text-white/40 font-bold tracking-wider mr-1">{t.activeSignals}:</span>
          {data.activeSignals.map((s) => (
            <span key={s} className="bg-green-900/30 border border-green-700/50 text-green-400 text-xs px-2 py-0.5 rounded-full">
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#111620] border border-[#253347] rounded-lg p-3.5">
          <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.technicalCard}</div>
          {[
            ["EMA9/20/50", `${fmt(d1.ema9, 1)}/${fmt(d1.ema20, 1)}/${fmt(d1.ema50, 1)}`],
            ["EMA200", fmt(d1.ema200, 1)],
            ["RSI (14)", fmt(d1.rsi, 1)],
            ["MACD", fmt(data.momentum.macd, 3)],
            ["ADX (14)", fmt(data.momentum.adx, 1)],
            ["ROC (10)", `${fmt(data.momentum.roc10, 1)}%`],
            ["BB%", fmt(data.momentum.bbPercent, 2)],
            ["Pattern", d1.pattern],
          ].map(([label, value], i, arr) => (
            <div key={label} className={`flex justify-between py-1.5 text-xs ${i < arr.length - 1 ? "border-b border-[#58a6ff]/15" : ""}`}>
              <span className="text-white/40">{label}</span>
              <span className="text-white/80 font-mono font-semibold">{value}</span>
            </div>
          ))}
        </div>

        <div className="bg-[#111620] border border-[#253347] rounded-lg p-3.5">
          <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.marketCard}</div>
          {[
            ["52H High", `$${fmt(data.context.hi52)}`],
            ["52L Low", `$${fmt(data.context.lo52)}`],
            ["52H Distance", `${fmt(data.context.pct52h, 1)}%`],
            ["ATR%", `${fmt(data.context.atrPct)}%`],
            ["RVOL", `${fmt(data.rvol)}x`],
            ["Volume", fmtVol(data.volume)],
            ["Avg Vol 30d", fmtVol(data.avgVol30)],
          ].map(([label, value], i, arr) => (
            <div key={label} className={`flex justify-between py-1.5 text-xs ${i < arr.length - 1 ? "border-b border-[#58a6ff]/15" : ""}`}>
              <span className="text-white/40">{label}</span>
              <span className="text-white/80 font-mono font-semibold">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t.entry, value: `$${fmt(data.tradePlan.stagedEntry[0]?.price)}`, color: "text-green-400", bg: "bg-green-500/10 border-green-500/40" },
              { label: t.stop, value: `$${fmt(data.tradePlan.stop.price)}`, color: "text-red-400", bg: "bg-red-500/10 border-red-500/40" },
              { label: t.target, value: `$${fmt(data.tradePlan.stagedExit[0]?.price)}`, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/40" },
              { label: t.rr, value: `${fmt(data.tradePlan.rr1, 1)}x`, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/40" },
            ].map((p) => (
              <div key={p.label} className={`border rounded-md py-2 text-center ${p.bg}`}>
                <div className={`text-[11px] font-bold tracking-wider ${p.color}`}>{p.label}</div>
                <div className={`text-base font-mono font-extrabold mt-0.5 ${p.color}`}>{p.value}</div>
              </div>
            ))}
          </div>
          <div className="bg-[#111620] border border-[#253347] rounded-md py-2 text-center">
            <div className="text-xs text-white/40 font-semibold">{t.riskPct}</div>
            <div className="text-base font-bold text-amber-400">{fmt(data.tradePlan.stop.pct)}%</div>
          </div>
          {!fullPage && !hidePermalink && (
            <a href={permalinkHref} className="text-center text-sm font-bold text-blue-400 border border-blue-500/40 bg-blue-500/10 rounded-md py-1.5 hover:bg-blue-500/20 transition-colors">
              {t.permalink} ↗
            </a>
          )}
          {!hidePermalink && (
            <a href={`/global/en/graphic/${ticker}`} className="text-center text-sm font-bold text-[#00d2ff] border border-[#00d2ff]/40 bg-[#00d2ff]/10 rounded-md py-1.5 hover:bg-[#00d2ff]/20 transition-colors">
              Chart Detail ↗
            </a>
          )}
          {!hidePermalink && (
            <a href={`/global/${locale}/analysis/${ticker}`} className="text-center text-sm font-bold text-purple-400 border border-purple-500/40 bg-purple-500/10 rounded-md py-1.5 hover:bg-purple-500/20 transition-colors">
              {locale === "tr" ? "Analiz" : locale === "pt" ? "Analisar" : "Analyze"} ↗
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5">
        <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.scoreCard}</div>
        <div className="grid grid-cols-3 gap-3">
          {scoreBars.map(({ label, score, color }) => (
            <div key={label}>
              <div className="flex justify-between mb-1 items-center">
                <span className="text-xs text-white/50 font-semibold">{label}</span>
                <span className="text-sm font-mono font-extrabold" style={{ color }}>{score}</span>
              </div>
              <div className="h-1 bg-[#253347] rounded overflow-hidden">
                <div className="h-full rounded transition-all" style={{ width: `${score}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {!hideChart && <ScreenerChart ticker={data.ticker} />}
    </div>
  );
}
