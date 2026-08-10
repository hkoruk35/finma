"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copy, type Locale } from "@/lib/i18n/copy";
import ScreenerChart from "@/components/screener/ScreenerChart";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import { formatAssetPrice, getAssetCategory } from "@/lib/symbols";
import { isPublicTeaserTicker } from "@/lib/publicTeaserTickers";
import type { AiMarketCommentary } from "@/lib/marketCommentaryEngine";
import { getIndexBySymbol } from "@/lib/indices";
import { formatNumber } from "@/lib/formatNumber";

function registerHref(locale: Locale): string {
  return locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
}

const NO_PLAN_LABELS: Record<Locale, string> = {
  tr: "Bu endeks/parite veya ticker için işlem planı hesaplanmamaktadır.",
  en: "A trade plan is not calculated for this index/parity or ticker here.",
  es: "No se calcula un plan de operaciones para este índice/paridad o ticker aquí.",
  fr: "Aucun plan de trading n'est calculé pour cet indice/parité ou ticker ici.",
  pt: "Nenhum plano de negociação é calculado para este índice/paridade ou ticker aqui."
};

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
  aiCommentary?: AiMarketCommentary;
}

function fmt(n: number | undefined, dec = 2): string {
  return n === undefined || Number.isNaN(n) ? "—" : formatNumber(n, dec);
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${formatNumber(n / 1e9, 1)}B`;
  if (n >= 1e6) return `${formatNumber(n / 1e6, 1)}M`;
  if (n >= 1e3) return `${formatNumber(n / 1e3, 0)}K`;
  return `${n}`;
}

export default function TickerDetailPanel({ ticker, locale, fullPage, hideChart, hidePermalink, lockTradePlanCard, unlockRationale }: { ticker: string; locale: Locale; fullPage?: boolean; hideChart?: boolean; hidePermalink?: boolean; lockTradePlanCard?: boolean; unlockRationale?: boolean }) {
  const t = copy[locale].top100.detail;
  const router = useRouter();
  const { isPremium, plan } = useMemberPlan();
  const isLoggedIn = plan !== null;

  const INDEX_TICKERS = ["SPX", "NDX", "DJI", "RUT", "VIX", "N225", "SSE", "HSI", "SENSEX", "NIFTY50", "SPLATA40", "SPLATA_BMI", "IBOVESPA", "IGCX", "IBXX", "STOXX50"];
  const isStock = !INDEX_TICKERS.includes(ticker) && !getIndexBySymbol(ticker) && getAssetCategory(ticker) === "stock";

  const effectiveIsPremium = isPremium || isPublicTeaserTicker(ticker);

  const accountHref =
    locale === "tr"
      ? "/global/tr/hesabim?tab=subscription"
      : locale === "es"
        ? "/global/es/account?tab=subscription"
        : locale === "fr"
          ? "/global/fr/account?tab=subscription"
          : locale === "pt"
            ? "/global/pt/account?tab=subscription"
            : "/global/en/account?tab=subscription";

  const targetUpgradeHref = isLoggedIn ? accountHref : registerHref(locale);

  // "lockTradePlanCard" SADECE Trade Plan kartını kilitler — Technical
  // Indicators + Market Data her zaman açık (bkz. Faz 0B: gerçek paylı
  // veri zaten sunucu tarafında /api/preorder-analysis'te maskeleniyor,
  // burası sadece görüntü tarafı).
  const tradePlanLocked = !!lockTradePlanCard && !effectiveIsPremium;
  // "İşlem Kurgusu Gerekçesi" (Rationale) karti Trade Plan'dan bagimsiz
  // kilitlenir: caller "unlockRationale" gecerse premium olmayan
  // ziyaretci de gorur — diger her ticker icin (arama vb.) kilitli kalir.
  const rationaleLocked = !!lockTradePlanCard && !effectiveIsPremium && !unlockRationale;
  const goToUpgrade = () => router.push(targetUpgradeHref);

  const LockPrompt = ({ message }: { message: string }) => (
    <button
      type="button"
      onClick={goToUpgrade}
      className="w-full flex flex-col items-center justify-center gap-2 border border-amber-500/40 bg-amber-500/10 rounded-xl py-6 px-4 text-center hover:bg-amber-500/20 transition-all cursor-pointer shadow-md"
    >
      <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400">
        <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
      </svg>
      <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
        {isLoggedIn ? (locale === "tr" ? "PREMİUM PLANA YÜKSELTİN" : "UPGRADE TO PREMIUM") : t.premiumLocked}
      </span>
      <span className="text-[11px] font-medium text-slate-300 max-w-[220px] leading-snug">
        {isLoggedIn
          ? (locale === "tr" ? "Giriş, stop, hedef ve risk/getiri oranını görmek için Premium Plana Yükseltin" : "Upgrade to Premium to unlock entry, stop & targets")
          : message}
      </span>
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

  // "tr" için kendi SEO canonical'ı olan /global/tr/hisse/[ticker]'a
  // (dokunulmadı — tasks/active/002 uyarınca trafik analizi olmadan
  // canonical'ı olan bir rotadan uzaklaştırmak riskli) yönlendirmeye devam
  // eder. Diğer 4 lokal ESKİDEN ya kapsam dışı legacy /en/stock/[ticker]'a
  // ya da (es/fr/pt için, hatalı şekilde) Türkçe /hisse sayfasına
  // gidiyordu — ikisi de /global/ ağacı dışında/yanlış lokalde kaldığı
  // için Faz 4'ün ölçümlü kapısının hiç görmeyeceği bir tur atlama
  // yoluydu; artık kendi lokalindeki /graphic sayfasına gidiyor.
  const permalinkHref = locale === "tr" ? `/global/tr/hisse/${ticker}` : `/global/${locale}/graphic/${ticker}`;

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
          <h1 className="text-3xl font-medium text-white tracking-tighter">
            {data.ticker} <span className="text-white/40 text-lg font-medium">{data.company}</span>
          </h1>
          <p className="text-2xl font-mono font-medium text-white mt-1">
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
          <span className="text-xs text-white/40 font-medium tracking-wider mr-1">{t.activeSignals}:</span>
          {data.activeSignals.map((s) => (
            <span key={s} className="bg-green-900/30 border border-green-700/50 text-green-400 text-xs px-2 py-0.5 rounded-full">
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* TEKNİK GÖSTERGELER CARD */}
        <div className="bg-[#111620] border border-[#253347] rounded-xl p-3.5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#58a6ff]/30">
              <span className="text-[11px] text-[#38bdf8] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span>⚡</span> {t.technicalCard}
              </span>
            </div>

            {/* EMA 9 / 20 / 50 Header Badge Row */}
            <div className="mb-3 p-2 rounded-lg bg-[#182232] border border-[#2a3f5c]">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                EMA (9 / 20 / 50)
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white">
                <span className="bg-[#3b82f6]/20 text-[#60a5fa] px-2 py-0.5 rounded border border-[#3b82f6]/30">
                  {fmt(d1.ema9, 1)}
                </span>
                <span className="text-slate-500">/</span>
                <span className="bg-[#3b82f6]/20 text-[#60a5fa] px-2 py-0.5 rounded border border-[#3b82f6]/30">
                  {fmt(d1.ema20, 1)}
                </span>
                <span className="text-slate-500">/</span>
                <span className="bg-[#3b82f6]/20 text-[#60a5fa] px-2 py-0.5 rounded border border-[#3b82f6]/30">
                  {fmt(d1.ema50, 1)}
                </span>
              </div>
            </div>

            {/* Grid of Key-Value Technical Indicators */}
            <div className="space-y-1.5">
              {[
                ["EMA 200", `$${fmt(d1.ema200, 1)}`, "text-slate-200"],
                ["RSI (14)", fmt(d1.rsi, 1), d1.rsi >= 60 ? "text-emerald-400" : d1.rsi <= 40 ? "text-amber-400" : "text-slate-200"],
                ["MACD", fmt(data.momentum.macd, 3), data.momentum.macd >= 0 ? "text-emerald-400" : "text-red-400"],
                ["ADX (14)", fmt(data.momentum.adx, 1), "text-slate-200"],
                ["ROC (10)", `${fmt(data.momentum.roc10, 1)}%`, data.momentum.roc10 >= 0 ? "text-emerald-400" : "text-red-400"],
                ["BB%", fmt(data.momentum.bbPercent, 2), "text-slate-200"],
              ].map(([label, value, textColor]) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 transition-colors border-b border-white/[0.04] text-xs"
                >
                  <span className="text-slate-400 font-medium">{label}</span>
                  <span className={`font-mono font-semibold ${textColor}`}>{value}</span>
                </div>
              ))}

              {d1.pattern && d1.pattern !== "—" && (
                <div className="flex items-center justify-between pt-1.5 px-2 text-xs">
                  <span className="text-slate-400 font-medium">Formasyon</span>
                  <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide">
                    {d1.pattern}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PİYASA VERİLERİ CARD */}
        <div className="bg-[#111620] border border-[#253347] rounded-xl p-3.5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#58a6ff]/30">
              <span className="text-[11px] text-[#38bdf8] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span>📊</span> {t.marketCard}
              </span>
            </div>

            <div className="space-y-1.5">
              {[
                ["52H High", `$${fmt(data.context.hi52)}`, "text-slate-100"],
                ["52L Low", `$${fmt(data.context.lo52)}`, "text-slate-100"],
                ["52H Distance", `${fmt(data.context.pct52h, 1)}%`, data.context.pct52h >= 0 ? "text-emerald-400" : "text-red-400"],
                ["ATR%", `${fmt(data.context.atrPct)}%`, "text-amber-400"],
                ["RVOL", `${fmt(data.rvol)}x`, data.rvol >= 1.5 ? "text-emerald-400 font-bold" : "text-slate-200"],
                ["Volume", fmtVol(data.volume), "text-slate-200"],
                ["Avg Vol 30d", fmtVol(data.avgVol30), "text-slate-400"],
              ].map(([label, value, textColor], i, arr) => (
                <div
                  key={label}
                  className={`flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5 transition-colors text-xs ${
                    i < arr.length - 1 ? "border-b border-white/[0.04]" : ""
                  }`}
                >
                  <span className="text-slate-400 font-medium">{label}</span>
                  <span className={`font-mono font-semibold ${textColor}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#111620] border border-[#253347] rounded-lg p-3.5 flex flex-col gap-2">
          <div className="text-xs text-white/40 uppercase tracking-widest font-medium mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.tradePlanCard}</div>
          {!isStock ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 border border-[#253347] bg-[#111620] rounded-md py-7 px-3 text-center">
              <span className="text-[11px] text-white/50 max-w-[210px] leading-snug">
                {NO_PLAN_LABELS[locale] || NO_PLAN_LABELS.en}
              </span>
            </div>
          ) : tradePlanLocked ? (
            <LockPrompt message={t.unlockTradePlan} />
          ) : !data.tradePlan.valid ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 border border-[#253347] bg-[#111620] rounded-md py-7 px-3 text-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400/70">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566ZM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5Zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>
              </svg>
              <span className="text-[11px] font-medium tracking-wider text-amber-400/90 uppercase">
                {data.aiCommentary?.noPlanMessage?.title || "AKTİF İŞLEM KURGUSU YOK"}
              </span>
              <span className="text-[11px] text-white/50 max-w-[210px] leading-snug">
                {data.aiCommentary?.noPlanMessage?.description || "Mevcut piyasa koşulları altında aktif bir işlem planı bulunmamaktadır."}
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="border rounded-md py-2 text-center bg-green-500/10 border-green-500/40">
                  <div className="text-[11px] font-medium tracking-wider text-green-400">{t.entry}</div>
                  <div className="text-sm font-mono font-medium mt-0.5 text-green-400">
                    ${fmt(data.tradePlan.entryZone.low)}–${fmt(data.tradePlan.entryZone.high)}
                  </div>
                </div>
                <div className="border rounded-md py-2 text-center bg-red-500/10 border-red-500/40">
                  <div className="text-[11px] font-medium tracking-wider text-red-400">{t.stop}</div>
                  <div className="text-base font-mono font-medium mt-0.5 text-red-400">${fmt(data.tradePlan.stop.price)}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {data.tradePlan.targets.map((tg, i) => (
                  <div key={tg.label} className="flex items-center justify-between border rounded-md py-1.5 px-2.5 bg-blue-500/10 border-blue-500/40">
                    <span className="text-[11px] font-medium tracking-wider text-blue-400">{t.target} {i + 1}</span>
                    <span className="text-sm font-mono font-medium text-blue-400">${fmt(tg.price)}</span>
                    <span className="text-[11px] font-mono font-medium text-amber-400">{fmt(tg.rr, 1)}x</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#111620] border border-[#253347] rounded-md py-2 text-center">
                <div className="text-xs text-white/40 font-medium">{t.riskPct}</div>
                <div className="text-base font-medium text-amber-400">{fmt(Math.abs(data.tradePlan.stop.pct))}%</div>
              </div>
            </>
          )}
          {!hidePermalink && (
            <a href={`/global/${locale}/graphic/${ticker}`} className="text-center text-sm font-medium text-[#00d2ff] border border-[#00d2ff]/40 bg-[#00d2ff]/10 rounded-md py-1.5 hover:bg-[#00d2ff]/20 transition-colors">
              {locale === "tr" ? "Grafik Detay" : "Chart Detail"} ↗
            </a>
          )}
        </div>
      </div>

      {/* 24/7 AI Market Commentary & Technical Analysis Panel */}
      {data.aiCommentary && (
        <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#58a6ff]/30 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-xs font-medium text-cyan-300 uppercase tracking-widest">
                {locale === "tr" ? "24/7 Yapay Zeka Grafik & Piyasa Yorumlayıcısı" : locale === "es" ? "Comentarista IA de Mercado 24/7" : locale === "fr" ? "Commentateur IA du Marché 24/7" : locale === "pt" ? "Comentador IA do Mercado 24/7" : "24/7 AI Market & Technical Commentary"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
                {data.aiCommentary.assetClassLabel}
              </span>
              <span className={`text-[10px] font-medium uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                data.aiCommentary.bias === "BULLISH" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" :
                data.aiCommentary.bias === "BEARISH" ? "bg-red-500/10 border-red-500/40 text-red-400" :
                data.aiCommentary.bias === "BREAKOUT_WATCH" ? "bg-amber-500/10 border-amber-500/40 text-amber-400" :
                "bg-slate-500/10 border-slate-500/40 text-slate-300"
              }`}>
                {data.aiCommentary.biasLabel}
              </span>
            </div>
          </div>

          {rationaleLocked ? (
            <LockPrompt message={t.unlockTradePlan} />
          ) : (
            <div className="space-y-2.5 text-sm text-white/80 leading-relaxed">
              <p className="bg-[#161f2e] p-2.5 rounded border border-[#2b3c54]">
                {data.aiCommentary.summary}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="bg-[#161f2e]/60 p-2 rounded border border-[#253347]">
                  <span className="text-cyan-400 font-medium block mb-1">🎯 {locale === "tr" ? "Kritik Seviyeler & Pivotlar" : "Key Levels & Pivots"}:</span>
                  <span className="text-white/70">{data.aiCommentary.keyLevels}</span>
                </div>
                <div className="bg-[#161f2e]/60 p-2 rounded border border-[#253347]">
                  <span className="text-amber-400 font-medium block mb-1">💧 {locale === "tr" ? "Likidite & Hacim Akışı" : "Liquidity & Volume Flow"}:</span>
                  <span className="text-white/70">{data.aiCommentary.liquidityVolume}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {data.tradePlan.valid && isStock && (
        <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5">
          <div className="text-xs text-white/40 uppercase tracking-widest font-medium mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.rationaleCard}</div>
          {rationaleLocked ? (
            <LockPrompt message={t.unlockTradePlan} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-white/70 leading-relaxed">
              <p><span className="text-[#58a6ff] font-medium">{t.entryConditionLabel}:</span> {data.tradePlan.entryCondition}</p>
              <p><span className="text-[#58a6ff] font-medium">{t.stopRationaleLabel}:</span> {data.tradePlan.stopRationale}</p>
              <p><span className="text-[#58a6ff] font-medium">EMA:</span> {data.tradePlan.rationale.ema}</p>
              <p><span className="text-[#58a6ff] font-medium">VWAP:</span> {data.tradePlan.rationale.vwap}</p>
              <p><span className="text-[#58a6ff] font-medium">{t.volumeLabel}:</span> {data.tradePlan.rationale.volume}</p>
              <p><span className="text-[#58a6ff] font-medium">RSI:</span> {data.tradePlan.rationale.rsi}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5">
        <div className="text-xs text-white/40 uppercase tracking-widest font-medium mb-2.5 pb-2 border-b border-[#58a6ff]/30">{t.scoreCard}</div>
        <div className="grid grid-cols-3 gap-3">
          {scoreBars.map(({ label, score, color }) => (
            <div key={label}>
              <div className="flex justify-between mb-1 items-center">
                <span className="text-xs text-white/50 font-medium">{label}</span>
                <span className="text-sm font-mono font-medium" style={{ color }}>{score}</span>
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
