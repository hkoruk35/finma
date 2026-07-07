import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import {
  getLangFromParams,
  getAllLangParams,
  LANG_CONFIG,
  TRADE_LABELS,
  type LangCode,
} from "@/lib/analysis-langs";
import {
  getArchivedDates,
  getArchivedAnalysis,
  getAllArchivedTickers,
} from "@/lib/analysis-archive";
import { getMasterData, formatPrice } from "@/lib/data";
import ChartSection from "@/components/stock/ChartSection";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ lang: string; slug: string; ticker: string; date: string }>;
}

export async function generateStaticParams() {
  const tickers = getAllArchivedTickers();
  const params: { lang: string; slug: string; ticker: string; date: string }[] = [];
  for (const { lang, slug } of getAllLangParams()) {
    for (const ticker of tickers) {
      for (const date of getArchivedDates(ticker)) {
        params.push({ lang, slug, ticker: ticker.toLowerCase(), date });
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug, ticker, date } = await params;
  const langCode = getLangFromParams(lang, slug);
  if (!langCode) return {};

  const pick = getArchivedAnalysis(ticker.toUpperCase(), date);
  if (!pick) return {};

  const titles: Record<string, string> = {
    en: `${pick.ticker} Analysis ${date} (Archive) — BOGA AI`,
    tr: `${pick.ticker} Analizi ${date} (Arşiv) — BOGA AI`,
    es: `Análisis ${pick.ticker} ${date} (Archivo) — BOGA AI`,
    pt: `Análise ${pick.ticker} ${date} (Arquivo) — BOGA AI`,
    fr: `Analyse ${pick.ticker} ${date} (Archive) — BOGA AI`,
    id: `Analisis ${pick.ticker} ${date} (Arsip) — BOGA AI`,
    de: `${pick.ticker} Analyse ${date} (Archiv) — BOGA AI`,
    it: `Analisi ${pick.ticker} ${date} (Archivio) — BOGA AI`,
    ru: `${pick.ticker} Анализ ${date} (Архив) — BOGA AI`,
    ar: `${pick.ticker} تحليل ${date} (الأرشيف) — BOGA AI`,
    ja: `${pick.ticker} 分析 ${date} (アーカイブ) — BOGA AI`,
    ko: `${pick.ticker} 분석 ${date} (아카이브) — BOGA AI`,
  };

  const title = titles[langCode as string] || titles.en;

  return {
    metadataBase: new URL("https://bogastock.com"),
    title,
    alternates: {
      canonical: `https://bogastock.com/${lang}/${slug}/${ticker}/${date}`,
    },
  };
}

export default async function ArchiveAnalysisPage({ params }: Props) {
  const { lang, slug, ticker, date } = await params;
  const langCode = getLangFromParams(lang, slug);
  if (!langCode) notFound();

  const pick = getArchivedAnalysis(ticker.toUpperCase(), date);
  if (!pick) notFound();

  const master = await getMasterData();
  const labels = TRADE_LABELS[langCode];
  const summary = pick.ai_summary?.homepage_summary?.[langCode] || "";
  const detail =
    pick.ai_summary?.detail_summary?.[langCode] ||
    pick.ai_summary?.detail_summary?.en ||
    "";
  const allDates = getArchivedDates(ticker.toUpperCase());

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-5 flex-wrap">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link
            href={`/${lang}/${slug}/${ticker}`}
            className="hover:text-white transition-colors"
          >
            {pick.ticker}
          </Link>
          <span>/</span>
          <span className="text-[#f59e0b] font-bold">{date}</span>
        </nav>

        {/* Archive badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-black uppercase tracking-widest mb-5">
          <span>📁</span>
          {labels.archive} · {date}
        </div>

        {/* Language switcher */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {Object.entries(LANG_CONFIG).map(([l, cfg]) => (
            <Link
              key={l}
              href={`/${l}/${cfg.slug}/${ticker}/${date}`}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 border transition-all ${
                l === lang
                  ? "bg-[#f59e0b] border-[#f59e0b] text-black"
                  : "border-[#1e2a3a] text-[#00d2ff] hover:text-white hover:border-[#f59e0b]/40 hover:bg-white/5"
              }`}
            >
              <span>{cfg.flag}</span>
              <span>{l.toUpperCase()}</span>
            </Link>
          ))}
        </div>

        {/* H1 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none">
              {pick.ticker}
            </h1>
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]">
              {pick.market_regime}
            </span>
          </div>
          <p className="text-base text-white font-semibold">{pick.company}</p>
          <p className="text-xs text-[#00d2ff] mt-1">{labels.basedOn} · {date}</p>
        </div>

        {/* Quick Summary */}
        {summary && (
          <div className="glass-card p-5 mb-5 border-l-4 border-l-[#f59e0b]">
            <p className="text-sm md:text-base text-[#fcd34d] font-bold leading-relaxed">
              {summary}
            </p>
          </div>
        )}

        {/* Score + Trade Setup */}
        <div className="glass-card p-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-[#141924] border border-[#1e2a3a]">
                <span className="text-2xl font-black text-white font-mono">
                  {Math.round(pick.score ?? pick.boga_score ?? 0)}
                </span>
                <span className="text-[8px] text-[#00d2ff] uppercase tracking-widest">/ 100</span>
              </div>
              <div>
                <p className="text-[10px] text-[#00d2ff] uppercase tracking-widest mb-1">
                  BOGA AI {labels.score}
                </p>
                <p className="text-sm font-black text-white">{pick.market_regime}</p>
                {pick.boga_zones?.risk_reward && (
                  <p className="text-xs text-[#00d2ff] mt-0.5">
                    {labels.rr}:{" "}
                    <span className="text-white font-bold">{pick.boga_zones.risk_reward}:1</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                <p className="text-[9px] font-black text-[#00d2ff] uppercase tracking-widest mb-1">{labels.entry}</p>
                <p className="font-mono font-black text-white text-sm">${formatPrice(pick.buy_zone?.low ?? 0)}</p>
                <p className="font-mono font-black text-white text-sm">– ${formatPrice(pick.buy_zone?.high ?? 0)}</p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#22c55e]">
                <p className="text-[9px] font-black text-[#00d2ff] uppercase tracking-widest mb-1">{labels.target}</p>
                <p className="font-mono font-black text-[#22c55e] text-sm">${formatPrice(pick.profit_zone?.low ?? 0)}</p>
                <p className="font-mono font-black text-[#22c55e] text-sm">– ${formatPrice(pick.profit_zone?.high ?? 0)}</p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#ef4444]">
                <p className="text-[9px] font-black text-[#00d2ff] uppercase tracking-widest mb-1">{labels.stop}</p>
                <p className="font-mono font-black text-[#ef4444] text-sm">${formatPrice(pick.stop_zone?.low ?? 0)}</p>
                <p className="font-mono font-black text-[#ef4444] text-sm">– ${formatPrice(pick.stop_zone?.high ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart (live — archive shows same ticker) */}
        <ChartSection ticker={pick.ticker} lang={langCode as any} />

        {/* Full Analysis */}
        {detail && (
          <div className="glass-card p-6 mb-5">
            <h2 className="text-[11px] font-black text-[#f59e0b] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-[#f59e0b] rounded-full" />
              {labels.analysisEngine} · {date}
            </h2>
            <div className="text-white leading-[1.85] text-base whitespace-pre-wrap">
              {detail}
            </div>
          </div>
        )}

        {/* Nav between archive dates */}
        <div className="glass-card p-5">
          <h2 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">
            {labels.prevAnalyses} · {pick.ticker}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${lang}/${slug}/${ticker}`}
              className="px-3 py-1.5 rounded-lg border border-[#3b82f6]/40 text-xs font-bold text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
            >
              ← {labels.currentAnalysis}
            </Link>
            {allDates.filter((d) => d !== date).map((d) => (
              <Link
                key={d}
                href={`/${lang}/${slug}/${ticker}/${d}`}
                className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#f59e0b]/40 transition-all"
              >
                {d}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
