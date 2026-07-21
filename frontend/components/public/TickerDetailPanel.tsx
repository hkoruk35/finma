"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copy, type Locale } from "@/lib/i18n/copy";
import ScreenerChart from "@/components/screener/ScreenerChart";
import { useMemberPlan } from "@/hooks/useMemberPlan";

function registerHref(locale: Locale): string {
  return locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
}

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
    entryZone: { low: number; high: number };
    entryType: string;
    entryCondition: string;
    stop: { price: number; pct: number };
    stopRationale: string;
    targets: { price: number; rr: number; label: string }[];
    riskReward: number;
    rationale: { ema: string; vwap: string; volume: string; rsi: string };
    valid: boolean;
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

export default function TickerDetailPanel({ ticker, locale, fullPage, hideChart, hidePermalink, lockTradePlan, lockTradePlanCard }: { ticker: string; locale: Locale; fullPage?: boolean; hideChart?: boolean; hidePermalink?: boolean; lockTradePlan?: boolean; lockTradePlanCard?: boolean }) {
  const t = copy[locale].top100.detail;
  const router = useRouter();
  const { isPremium } = useMemberPlan();
  // Prop adi "lockTradePlan" kaldi (mevcut cagiran, /graphic sayfasi, bunu
  // gecirir) ama artik Technical Indicators + Market Data'yi da kapsiyor —
  // hepsi ayni premium kilit davranisini paylasiyor.
  const premiumLocked = !!lockTradePlan && !isPremium;
  // "lockTradePlanCard" ise SADECE Trade Plan kartini kilitler (Technical
  // Indicators + Market Data acik kalir) — Gosterge Paneli (GlobalLandingPage)
  // bunu kullanir, /graphic sayfasindaki ucunu-de-kilitleyen lockTradePlan'dan
  // farkli.
  const tradePlanLocked = premiumLocked || (!!lockTradePlanCard && !isPremium);
  const goToRegister = () => router.push(registerHref(locale));

  const LockPrompt = ({ message }: { message: string }) => (
    <button
      type="button"
      onClick={goToRegister}
      className="w-full flex flex-col items-center justify-center gap-2 border border-amber-500/40 bg-amber-500/10 rounded-md py-7 px-3 text-center hover:bg-amber-500/20 transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400">
        <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
      </svg>
      <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">{t.premiumLocked}</span>
      <span className="text-[11px] text-white/50 max-w-[180px] leading-snug">{message}</span>
    </button>
  );
  const [data, setData] = useState<PreorderAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    // preorder-analysis artik 5 dili de uretir (tr varsayilan) — kendi
    // dilinde metin alsin diye gercek locale gonderilir.
    const langParam = locale && locale !== "tr" ? `&lang=${locale}` : "";
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
          {premiumLocked ? (
            <LockPrompt message={t.unlockTradePlan} />
          ) : (
            [
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
            ))
          )}
        </div>

        <div className="bg-[#111620] border border-[#253347] rounded-lg p-3.5">
          <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.marketCard}</div>
          {premiumLocked ? (
            <LockPrompt message={t.unlockTradePlan} />
          ) : (
            [
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
            ))
          )}
        </div>

        <div className="bg-[#111620] border border-[#253347] rounded-lg p-3.5 flex flex-col gap-2">
          <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.tradePlanCard}</div>
          {tradePlanLocked ? (
            <LockPrompt message={t.unlockTradePlan} />
          ) : !data.tradePlan.valid ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 border border-[#253347] bg-[#111620] rounded-md py-7 px-3 text-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-white/30">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566ZM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5Zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>
              </svg>
              <span className="text-[11px] font-bold tracking-wider text-white/50 uppercase">Not Suitable for a Trade</span>
              <span className="text-[11px] text-white/40 max-w-[200px] leading-snug">Downtrend structure — no valid long entry/stop/target setup right now</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="border rounded-md py-2 text-center bg-green-500/10 border-green-500/40">
                  <div className="text-[11px] font-bold tracking-wider text-green-400">{t.entry}</div>
                  <div className="text-sm font-mono font-extrabold mt-0.5 text-green-400">
                    ${fmt(data.tradePlan.entryZone.low)}–${fmt(data.tradePlan.entryZone.high)}
                  </div>
                </div>
                <div className="border rounded-md py-2 text-center bg-red-500/10 border-red-500/40">
                  <div className="text-[11px] font-bold tracking-wider text-red-400">{t.stop}</div>
                  <div className="text-base font-mono font-extrabold mt-0.5 text-red-400">${fmt(data.tradePlan.stop.price)}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {data.tradePlan.targets.map((tg, i) => (
                  <div key={tg.label} className="flex items-center justify-between border rounded-md py-1.5 px-2.5 bg-blue-500/10 border-blue-500/40">
                    <span className="text-[11px] font-bold tracking-wider text-blue-400">{t.target} {i + 1}</span>
                    <span className="text-sm font-mono font-extrabold text-blue-400">${fmt(tg.price)}</span>
                    <span className="text-[11px] font-mono font-bold text-amber-400">{fmt(tg.rr, 1)}x</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#111620] border border-[#253347] rounded-md py-2 text-center">
                <div className="text-xs text-white/40 font-semibold">{t.riskPct}</div>
                <div className="text-base font-bold text-amber-400">{fmt(Math.abs(data.tradePlan.stop.pct))}%</div>
              </div>
            </>
          )}
          {!fullPage && !hidePermalink && (
            <a href={permalinkHref} className="text-center text-sm font-bold text-blue-400 border border-blue-500/40 bg-blue-500/10 rounded-md py-1.5 hover:bg-blue-500/20 transition-colors">
              {t.permalink} ↗
            </a>
          )}
          {!hidePermalink && (
            <a href={`/global/${locale}/graphic/${ticker}`} className="text-center text-sm font-bold text-[#00d2ff] border border-[#00d2ff]/40 bg-[#00d2ff]/10 rounded-md py-1.5 hover:bg-[#00d2ff]/20 transition-colors">
              {locale === "tr" ? "Grafik Detay" : "Chart Detail"} ↗
            </a>
          )}
          {!hidePermalink && (
            <a href={`/global/${locale}/analysis/${ticker}`} className="text-center text-sm font-bold text-purple-400 border border-purple-500/40 bg-purple-500/10 rounded-md py-1.5 hover:bg-purple-500/20 transition-colors">
              {locale === "tr" ? "Analiz" : locale === "pt" ? "Analisar" : "Analyze"} ↗
            </a>
          )}
        </div>
      </div>

      {!tradePlanLocked && data.tradePlan.valid && (
        <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5">
          <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.rationaleCard}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-white/70 leading-relaxed">
            <p><span className="text-[#58a6ff] font-bold">{t.entryConditionLabel}:</span> {data.tradePlan.entryCondition}</p>
            <p><span className="text-[#58a6ff] font-bold">{t.stopRationaleLabel}:</span> {data.tradePlan.stopRationale}</p>
            <p><span className="text-[#58a6ff] font-bold">EMA:</span> {data.tradePlan.rationale.ema}</p>
            <p><span className="text-[#58a6ff] font-bold">VWAP:</span> {data.tradePlan.rationale.vwap}</p>
            <p><span className="text-[#58a6ff] font-bold">{t.volumeLabel}:</span> {data.tradePlan.rationale.volume}</p>
            <p><span className="text-[#58a6ff] font-bold">RSI:</span> {data.tradePlan.rationale.rsi}</p>
          </div>
        </div>
      )}

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
