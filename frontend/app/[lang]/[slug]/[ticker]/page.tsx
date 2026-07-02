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
import { getArchivedDates } from "@/lib/analysis-archive";
import { getSwingAllPicks, getMasterData, formatPrice, getStockData, getAllTickers } from "@/lib/data";
import ChartSection from "@/components/stock/ChartSection";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import AIReportFormatter from "@/components/stock/AIReportFormatter";

export const dynamic = "force-static";
export const revalidate = 1; // force rapid refresh for update

interface Props {
  params: Promise<{ lang: string; slug: string; ticker: string }>;
}

export async function generateStaticParams() {
  const allTickers = await getAllTickers();
  const tickers = allTickers.map((t: any) => t.ticker);
  const params: { lang: string; slug: string; ticker: string }[] = [];
  for (const { lang, slug } of getAllLangParams()) {
    for (const ticker of tickers) {
      params.push({ lang, slug, ticker: ticker.toLowerCase() });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug, ticker } = await params;
  const langCode = getLangFromParams(lang, slug);
  if (!langCode) return {};

  const [swingData, stockDetail] = await Promise.all([
    getSwingAllPicks(),
    getStockData(ticker)
  ]);

  const pick = swingData?.picks.find(
    (p: any) => p.ticker.toLowerCase() === ticker.toLowerCase()
  ) || stockDetail;

  if (!pick || !pick.ticker) return {};

  const summary =
    pick.ai_summary?.homepage_summary?.[langCode] ||
    pick.ai_summary?.detail_summary?.[langCode]?.slice(0, 160) ||
    "";

  const titles: Record<string, string> = {
    en: `${pick.ticker} Stock Analysis — BOGA AI Score ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    tr: `${pick.ticker} Hisse Analizi — BOGA AI Skor ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    es: `Análisis de Acciones ${pick.ticker} — BOGA AI Puntuación ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    pt: `Análise de Ações ${pick.ticker} — BOGA AI Score ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    fr: `Analyse d'Action ${pick.ticker} — BOGA AI Score ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    id: `Analisis Saham ${pick.ticker} — Skor BOGA AI ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    de: `${pick.ticker} Aktienanalyse — BOGA AI Score ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    it: `Analisi Azionaria ${pick.ticker} — BOGA AI Punteggio ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    ru: `Анализ акций ${pick.ticker} — Оценка BOGA AI ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    ar: `تحليل سهم ${pick.ticker} — نقاط BOGA AI ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    ja: `${pick.ticker} 株式分析 — BOGA AIスコア ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
    ko: `${pick.ticker} 주식 분석 — BOGA AI 점수 ${Math.round(pick.score || pick.scores?.master_score || 0)}/100`,
  };

  const title = titles[langCode as string] || titles.en;

  const langAlternates: Record<string, string> = {};
  for (const [l, cfg] of Object.entries(LANG_CONFIG)) {
    langAlternates[l] = `https://bogastock.com/${l}/${cfg.slug}/${ticker}`;
  }

  return {
    metadataBase: new URL("https://bogastock.com"),
    title,
    description: summary.slice(0, 160),
    alternates: {
      canonical: `https://bogastock.com/${lang}/${slug}/${ticker}`,
      languages: langAlternates,
    },
    openGraph: {
    title,
      description: summary.slice(0, 160),
      url: `https://bogastock.com/${lang}/${slug}/${ticker}`,
      images: [{ url: "https://bogastock.com/finmawave.png", width: 1200, height: 630 }],
    },
  };
}

export default async function LangAnalysisPage({ params }: Props) {
  const { lang, slug, ticker } = await params;
  const langCode = getLangFromParams(lang, slug);
  if (!langCode) notFound();

  const [swingData, master, stockDetail] = await Promise.all([
    getSwingAllPicks(),
    getMasterData(),
    getStockData(ticker)
  ]);

  // Priority: 1. Direct swing pick 2. Stock detail (which may have synced swing data)
  const pick = swingData?.picks.find(
    (p: any) => p.ticker.toLowerCase() === ticker.toLowerCase()
  ) || stockDetail;

  if (!pick || !pick.ticker) notFound();

  const labels = TRADE_LABELS[langCode];
  
  // Extract summaries with logic for both formats
  const aiSummary = pick.ai_summary;
  let summary = "";
  let detail = "";

  if (typeof aiSummary === "object" && aiSummary !== null) {
    summary = aiSummary.homepage_summary?.[langCode] || aiSummary.homepage?.[langCode] || "";
    detail = aiSummary.detail_summary?.[langCode] || aiSummary.detail?.[langCode] || aiSummary.detail_summary?.en || aiSummary.detail?.en || "";
  } else if (typeof aiSummary === "string") {
    summary = aiSummary;
    detail = aiSummary; // Fallback
  }

  const archivedDates = getArchivedDates(pick.ticker);
  const dateStr = swingData?.date || new Date().toISOString().split("T")[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${pick.ticker} — ${pick.company}`,
    author: { "@type": "Organization", name: "BOGA AI" },
    publisher: { "@type": "Organization", name: "BOGA AI", logo: { "@type": "ImageObject", url: "https://bogastock.com/finmawave.png" } },
    datePublished: dateStr,
    description: summary,
    url: `https://bogastock.com/${lang}/${slug}/${ticker}`,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-5 flex-wrap">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">{LANG_CONFIG[langCode].name}</span>
          <span>/</span>
          <span className="text-white font-bold">{pick.ticker}</span>
        </nav>

        {/* Language switcher */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {Object.entries(LANG_CONFIG).map(([l, cfg]) => (
            <Link
              key={l}
              href={`/${l}/${cfg.slug}/${ticker}`}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 border transition-all ${
                l === lang
                  ? "bg-[#3b82f6] border-[#3b82f6] text-white"
                  : "border-[#1e2a3a] text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 hover:bg-white/5"
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
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]">
              {pick.market_regime}
            </span>
          </div>
          <p className="text-base text-white font-semibold">{pick.company}</p>
          <p className="text-xs text-[#00d2ff] mt-1">{labels.basedOn} · {dateStr}</p>
        </div>

        {/* Quick Summary */}
        {summary && (
          <div className="glass-card p-5 mb-5 border-l-4 border-l-[#3b82f6]">
            <p className="text-sm md:text-base text-[#93c5fd] font-bold leading-relaxed">
              {summary}
            </p>
          </div>
        )}

        {/* Score + Trade Setup */}
        <div className="glass-card p-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            {/* Score */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-[#141924] border border-[#1e2a3a]">
                <span className="text-2xl font-black text-white font-mono">
                  {Math.round(pick.score)}
                </span>
                <span className="text-[8px] text-[#00d2ff] uppercase tracking-widest">/ 100</span>
              </div>
              <div>
                <p className="text-[10px] text-[#00d2ff] uppercase tracking-widest mb-1">
                  BOGA AI {labels.score}
                </p>
                <p className="text-sm font-black text-white">{pick.market_regime}</p>
                {pick.holding_period && (
                  <p className="text-xs text-[#00d2ff] mt-0.5">
                    {labels.holdingPeriod}:{" "}
                    <span className="text-white font-bold">{pick.holding_period}</span>
                  </p>
                )}
                {pick.boga_zones?.risk_reward && (
                  <p className="text-xs text-[#00d2ff] mt-0.5">
                    {labels.rr}:{" "}
                    <span className="text-white font-bold">{pick.boga_zones.risk_reward}:1</span>
                  </p>
                )}
              </div>
            </div>

            {/* Zones */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                <p className="text-[9px] font-black text-[#00d2ff] uppercase tracking-widest mb-1">
                  {labels.entry}
                </p>
                <p className="font-mono font-black text-white text-sm">
                  ${formatPrice(pick.buy_zone?.low ?? pick.scores_detail?.entry_range_low ?? 0)}
                </p>
                <p className="font-mono font-black text-white text-sm">
                  – ${formatPrice(pick.buy_zone?.high ?? pick.scores_detail?.entry_range_high ?? 0)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#22c55e]">
                <p className="text-[9px] font-black text-[#00d2ff] uppercase tracking-widest mb-1">
                  {labels.target}
                </p>
                <p className="font-mono font-black text-[#22c55e] text-sm">
                  ${formatPrice(pick.profit_zone?.low ?? pick.scores_detail?.target_range_low ?? pick.scores_detail?.target_price ?? 0)}
                </p>
                <p className="font-mono font-black text-[#22c55e] text-sm">
                  – ${formatPrice(pick.profit_zone?.high ?? pick.scores_detail?.target_range_high ?? 0)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#ef4444]">
                <p className="text-[9px] font-black text-[#00d2ff] uppercase tracking-widest mb-1">
                  {labels.stop}
                </p>
                <p className="font-mono font-black text-[#ef4444] text-sm">
                  ${formatPrice(pick.stop_zone?.low ?? pick.scores_detail?.stop_range_low ?? 0)}
                </p>
                <p className="font-mono font-black text-[#ef4444] text-sm">
                  – ${formatPrice(pick.stop_zone?.high ?? pick.scores_detail?.stop_range_high ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <ChartSection ticker={pick.ticker} />

        {/* Full Analysis */}
        {detail && (
          <div className="glass-card p-6 mb-5">
            <h2 className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-[#3b82f6] rounded-full" />
              {labels.analysisEngine}
            </h2>
            <AIReportFormatter content={detail} />
          </div>
        )}

        {/* SEO Index - Multi-language navigation */}
        <div className="glass-card p-6 mb-5">
           <h3 className="text-[10px] font-black text-[#00d2ff] uppercase tracking-[0.2em] mb-4">Discover {pick.ticker} Analysis in Other Languages</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(LANG_CONFIG).map(([l, cfg]) => (
                <Link 
                  key={l}
                  href={`/${l}/${cfg.slug}/${ticker}`}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                >
                   <div className="flex items-center gap-2 mb-1">
                      <span>{cfg.flag}</span>
                      <span className="text-[10px] font-black text-white uppercase">{l}</span>
                   </div>
                   <p className="text-[9px] text-[#00d2ff] group-hover:text-blue-400 truncate font-semibold">
                      {pick.ticker} {cfg.name}
                   </p>
                </Link>
              ))}
           </div>
        </div>

        {/* Link to full interactive page */}
        <div className="glass-card p-4 mb-5 flex items-center justify-between gap-4">
          <p className="text-xs text-[#00d2ff]">
            {labels.fullDataPrompt}
          </p>
          <Link
            href={`/stock/${pick.ticker}`}
            className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg text-xs font-black text-white transition-colors whitespace-nowrap"
          >
            {pick.ticker} →
          </Link>
        </div>

        {/* Previous Analyses Archive */}
        {archivedDates.length > 0 && (
          <div className="glass-card p-5">
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">
              {labels.prevAnalyses} · {pick.ticker}
            </h2>
            <div className="flex flex-wrap gap-2">
              {archivedDates.map((date) => (
                <Link
                  key={date}
                  href={`/${lang}/${slug}/${ticker}/${date}`}
                  className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
                >
                  {date}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
