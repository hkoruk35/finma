import { getStockData, getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import dynamic from "next/dynamic";
import MarketStatus from "@/components/MarketStatus";
import { LANG_CONFIG } from "@/lib/analysis-langs";
import { getArchivedDates } from "@/lib/analysis-archive";

export const revalidate = 300; // ISR: 5 dakikada bir yenile (eski değer: 1 saniye = performans katili)

// Ağır bileşenler lazy-load: kod bölme ile JS bundle küçülür, LCP hızlanır
const ChartSection = dynamic(() => import("@/components/stock/ChartSection"), {
  loading: () => <div className="h-[420px] bg-[#141924] animate-pulse rounded-xl" />,
});
const DetailTabs = dynamic(() => import("@/components/stock/DetailTabs"), {
  loading: () => <div className="h-48 bg-[#141924] animate-pulse rounded-xl" />,
});
const SocialShare = dynamic(() => import("@/components/SocialShare"));

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  const stock = await getStockData(ticker);

  if (!stock) return { title: "Stock Not Found | BOGA AI" };

  const dateStr = new Date().toISOString().split("T")[0];
  const scoreType = stock.scores.score_type.replace(/_/g, " ");
  const title = `${stock.ticker} AI Analysis ${dateStr} | ${stock.company} — BOGA AI`;
  const description = `${stock.ticker} (${stock.company}) — BOGA AI Score: ${stock.scores.master_score.toFixed(1)}/100 | ${scoreType} | $${formatPrice(stock.price.current)} | Entry: $${formatPrice(stock.scores_detail.entry_range_low)}–$${formatPrice(stock.scores_detail.entry_range_high)}`;

  return {
    metadataBase: new URL("https://bogastock.com"),
    title,
    description,
    alternates: { canonical: `https://bogastock.com/stock/${ticker.toLowerCase()}` },
    openGraph: {
      title,
      description,
      url: `https://bogastock.com/stock/${ticker.toLowerCase()}`,
      images: [{ url: "https://bogastock.com/finmawave.png", width: 1200, height: 630, alt: `${stock.ticker} AI Analysis` }],
    },
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  const [stock, master, allTickers] = await Promise.all([
    getStockData(ticker),
    getMasterData(),
    getAllTickers(),
  ]);

  if (!stock) notFound();

  const swing = (stock as any)._swing;
  const scoreType = stock.scores.score_type;
  const isSwingPick = !!swing;
  const archivedDates = getArchivedDates(ticker);

  // Signal icon and color based on score type
  const signalConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    HIGH_CONVICTION: { icon: "🚀", label: "High Conviction Buy", color: "text-[#22c55e]", bg: "bg-[#22c55e]/10 border-[#22c55e]/30" },
    POSITIVE_BIAS:   { icon: "📈", label: "Positive Bias",       color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10 border-[#3b82f6]/30" },
    NEUTRAL_STAY:    { icon: "⚖️",  label: "Neutral — Hold",      color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10 border-[#f59e0b]/30" },
    NEGATIVE_BIAS:   { icon: "📉", label: "Negative Bias",       color: "text-[#ef4444]", bg: "bg-[#ef4444]/10 border-[#ef4444]/30" },
    UNDERPERFORM:    { icon: "⚠️",  label: "Underperform",        color: "text-[#ef4444]", bg: "bg-[#ef4444]/10 border-[#ef4444]/30" },
  };
  const sig = signalConfig[scoreType] ?? signalConfig["NEUTRAL_STAY"];

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      {/* Schema.org */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "Article",
          "headline": `${stock.ticker} — ${stock.company} AI Analysis`,
          "image": "https://bogastock.com/finmawave.png",
          "author": { "@type": "Organization", "name": "BOGA AI" },
          "publisher": { "@type": "Organization", "name": "BOGA AI", "logo": { "@type": "ImageObject", "url": "https://bogastock.com/finmawave.png" } },
          "datePublished": stock.date || new Date().toISOString()
        })
      }} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-5">
          <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org", "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bogastock.com" },
                { "@type": "ListItem", "position": 2, "name": stock.ticker, "item": `https://bogastock.com/stock/${ticker.toLowerCase()}` }
              ]
            })
          }} />
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/swing-picks" className="hover:text-white transition-colors">Top Picks</Link>
          <span>/</span>
          <span className="text-white">{stock.ticker}</span>
        </nav>

        {/* ── HERO: Ticker Header ── */}
        <div className="glass-card px-5 py-5 md:px-8 mb-3 border-b-2 border-b-[#3b82f6]/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              {/* Swing pick badge */}
              {isSwingPick && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[10px] font-black text-[#3b82f6] uppercase tracking-widest">
                    #{swing.rank} — BOGA AI Top Pick
                  </span>
                  {swing.holding_period && (
                    <span className="text-[10px] text-[#00d2ff]">· {swing.holding_period} horizon</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none">
                  {stock.ticker}
                </h1>
                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border ${sig.bg} ${sig.color}`}>
                  {sig.icon} {sig.label}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base text-white font-semibold">{stock.company}</p>
                <span className="text-[#1e2a3a]">·</span>
                <p className="text-sm text-[#00d2ff] font-medium uppercase tracking-wider">{stock.sector}</p>
                {swing?.market_regime && (
                  <>
                    <span className="text-[#1e2a3a]">·</span>
                    <span className={`text-xs font-bold ${swing.market_regime.toLowerCase().includes("bull") ? "text-[#22c55e]" : "text-[#f59e0b]"}`}>
                      Market: {swing.market_regime}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col md:items-end gap-1">
              <div className="flex flex-col md:items-end">
                <div className="flex items-baseline gap-3">
                  <span id="stock-price-current" className="text-4xl md:text-5xl font-mono font-black text-white leading-none tracking-tighter">
                    ${formatPrice(stock.price.current)}
                  </span>
                  <div className={`flex flex-col ${getChangeColor(stock.price.change_pct)}`}>
                    <span id="stock-price-change" className="text-xl font-mono font-black leading-none">
                      {stock.price.change_pct >= 0 ? "+" : ""}{stock.price.change_pct.toFixed(2)}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-right">Today</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#00d2ff] uppercase tracking-widest mt-1">
                  ANALYSIS DATE: {stock.date ? new Date(stock.date).toLocaleDateString() : "—"}
                </span>
              </div>
              <MarketStatus />
            </div>
          </div>
        </div>

        {/* ── Returns Strip ── */}
        <div className="glass-card grid grid-cols-4 divide-x divide-[#1e2a3a] mb-4">
          {[
            { label: "1D", value: stock.price.change_pct },
            { label: "1W", value: stock.price.change_pct_1w },
            { label: "1M", value: stock.price.change_pct_1m },
            { label: "1Y", value: stock.price.change_pct_1y },
          ].map((p) => (
            <div key={p.label} className="px-3 py-3 md:px-5 flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-[#00d2ff] uppercase tracking-widest">{p.label}</span>
              <span id={p.label === "1D" ? "stock-returns-1d" : undefined} className={`text-base md:text-lg font-mono font-black ${
                p.value !== undefined && p.value !== null ? getChangeColor(p.value) : "text-[#00d2ff]"
              }`}>
                {p.value !== undefined && p.value !== null
                  ? `${p.value >= 0 ? "+" : ""}${p.value.toFixed(2)}%`
                  : "—"}
              </span>
            </div>
          ))}
        </div>

        {/* ── BOGA AI Decision Banner (for swing picks) ── */}
        {isSwingPick && (
          <div className="relative overflow-hidden mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Score Section */}
              <div className="lg:col-span-3 glass-card p-5 flex flex-col items-center justify-center border-b-4 border-b-[#3b82f6]">
                <div className="relative flex items-center justify-center w-24 h-24 mb-3">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="48" cy="48" r="42" fill="none" stroke="#1e2a3a" strokeWidth="6" />
                    <circle cx="48" cy="48" r="42" fill="none" stroke="#3b82f6" strokeWidth="6" 
                            strokeDasharray={`${(stock.scores.master_score / 100) * 264} 264`} 
                            strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-black text-white font-mono leading-none">
                      {stock.scores.master_score.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-widest mt-1">Score</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className={`text-base font-black uppercase tracking-tight ${sig.color}`}>{sig.icon} {sig.label}</p>
                  {swing?.boga_zones?.risk_reward && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mt-2">
                       <span className="text-[9px] text-[#00d2ff] font-black uppercase tracking-widest">R:R</span>
                       <span className="text-xs text-white font-bold">{swing.boga_zones.risk_reward}:1</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trading Zones — Luxury Cards */}
              <div className="lg:col-span-9 flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white tracking-widest uppercase">🎯 TRADING PARAMETERS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 rounded-md bg-[#141924] border border-[#1e2a3a]">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mr-2">Analysis Date:</span>
                      <span className="text-xs text-[#00d2ff] font-mono font-bold">{stock.date ? new Date(stock.date).toLocaleDateString() : "—"}</span>
                    </div>
                    <div className="px-3 py-1 rounded-md bg-[#141924] border border-[#1e2a3a]">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mr-2">Base Price:</span>
                      <span className="text-xs text-[#22c55e] font-mono font-bold">${formatPrice(stock.price.current)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Entry Zone */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#141924] to-[#0d1117] rounded-2xl p-5 border border-[#1e2a3a] border-l-4 border-l-[#94a3b8] group hover:border-[#94a3b8]/40 transition-all">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#94a3b8]/5 blur-2xl rounded-full" />
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-[#94a3b8]/10">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v20M2 12h20M7 7l10 10M7 17L17 7" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Entry Zone</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#00d2ff] uppercase mb-1">Buy Range</span>
                    <div className="flex items-baseline gap-2">
                      <span id="stock-entry-range-low" className="text-2xl font-black text-white font-mono tracking-tighter">
                        ${formatPrice(stock.scores_detail.entry_range_low)}
                      </span>
                      <span className="text-[#00d2ff] font-black">–</span>
                      <span id="stock-entry-range-high" className="text-2xl font-black text-white font-mono tracking-tighter">
                        ${formatPrice(stock.scores_detail.entry_range_high)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Zone */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#141924] to-[#0d1117] rounded-2xl p-5 border border-[#1e2a3a] border-l-4 border-l-[#22c55e] group hover:border-[#22c55e]/40 transition-all">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#22c55e]/5 blur-2xl rounded-full" />
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-[#22c55e]/10">
                      <svg className="w-4 h-4 text-[#22c55e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" />
                        <path d="M9 12l2 2 4-4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-black text-[#22c55e] uppercase tracking-[0.15em]">Profit Target</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#00d2ff] uppercase mb-1">Exit Range</span>
                    <div className="flex items-baseline gap-2 text-[#22c55e]">
                      <span id="stock-target-low" className="text-2xl font-black font-mono tracking-tighter">
                        ${formatPrice(stock.scores_detail.target_range_low)}
                      </span>
                      <span className="text-[#00d2ff] font-black">–</span>
                      <span id="stock-target-high" className="text-2xl font-black font-mono tracking-tighter">
                        ${formatPrice(stock.scores_detail.target_range_high)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stop Loss Zone */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#141924] to-[#0d1117] rounded-2xl p-5 border border-[#1e2a3a] border-l-4 border-l-[#ef4444] group hover:border-[#ef4444]/40 transition-all">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#ef4444]/5 blur-2xl rounded-full" />
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-[#ef4444]/10">
                      <svg className="w-4 h-4 text-[#ef4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-black text-[#ef4444] uppercase tracking-[0.15em]">Stop Loss</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#00d2ff] uppercase mb-1">Safety Cut-off</span>
                    <div className="flex items-baseline gap-2 text-[#ef4444]">
                      <span id="stock-stop-low" className="text-2xl font-black font-mono tracking-tighter">
                        ${formatPrice(stock.scores_detail.stop_range_low)}
                      </span>
                      <span className="text-[#00d2ff] font-black">–</span>
                      <span id="stock-stop-high" className="text-2xl font-black font-mono tracking-tighter">
                        ${formatPrice(stock.scores_detail.stop_range_high)}
                      </span>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Chart ── */}
        <ChartSection
          ticker={stock.ticker}
          exchange={(stock as any)._exchange ?? undefined}
          companyMismatch={(stock as any)._company_mismatch ?? undefined}
        />

        {/* ── Tabs (Tracker & Analysis) ── */}
        <div className="mb-4">
          <DetailTabs stock={stock} />
        </div>

        {/* ── Trading Parameters (for non-swing-pick stocks) ── */}
        {!isSwingPick && (
          <div className="glass-card p-5 mb-4">
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              🎯 Trading Parameters
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                <p className="text-[9px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Entry Zone</p>
                <p className="font-mono font-black text-white text-sm">
                  ${formatPrice(stock.scores_detail.entry_range_low)} – ${formatPrice(stock.scores_detail.entry_range_high)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#22c55e]">
                <p className="text-[9px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Target</p>
                <p className="font-mono font-black text-[#22c55e] text-sm">
                  ${formatPrice(stock.scores_detail.target_range_low)} – ${formatPrice(stock.scores_detail.target_range_high)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#ef4444]">
                <p className="text-[9px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Stop Loss</p>
                <p className="font-mono font-black text-[#ef4444] text-sm">
                  ${formatPrice(stock.scores_detail.stop_range_low)} – ${formatPrice(stock.scores_detail.stop_range_high)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#8b5cf6]">
                <p className="text-[9px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Risk / Reward</p>
                <p className="font-mono font-black text-[#8b5cf6] text-xl">{stock.scores_detail.risk_reward_ratio}:1</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Sector Context ── */}
        <div className="glass-card p-5 mb-4">
          <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            🌍 Sector Context
          </h3>
          <div className="flex items-center justify-between p-4 bg-[#141924] rounded-xl border border-[#1e2a3a]">
            <div>
              <p className="text-[10px] text-[#00d2ff] uppercase font-bold tracking-widest mb-1">Sector ETF</p>
              <p className="text-lg font-black text-white">{stock.sector_context?.sector_etf ?? "—"}</p>
            </div>
            <div className="h-10 w-px bg-[#1e2a3a]" />
            <div className="text-right">
              <p className="text-[10px] text-[#00d2ff] uppercase font-bold tracking-widest mb-1">5-Day Performance</p>
              <p className={`text-lg font-black ${(stock.sector_context?.sector_performance_5d ?? 0) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                {(stock.sector_context?.sector_performance_5d ?? 0) >= 0 ? "+" : ""}
                {(stock.sector_context?.sector_performance_5d ?? 0).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* ── News ── */}
        {stock.news && stock.news.length > 0 && (
          <div className="glass-card p-5 mb-4">
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">📰 Recent News</h3>
            <div className="space-y-4">
              {stock.news.map((n, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center gap-3 group pb-4 border-b border-[#1e2a3a] last:border-0 last:pb-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-wider">{n.source}</span>
                      <span className="text-[9px] text-[#00d2ff]">· {new Date(n.published).toLocaleDateString()}</span>
                    </div>
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold text-white group-hover:text-[#3b82f6] transition-colors line-clamp-2">
                      {n.headline}
                    </a>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                    n.sentiment === "positive" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#64748b]/10 text-white"
                  }`}>
                    {n.sentiment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Share ── */}
        <div className="glass-card p-5 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-[11px] font-black text-white uppercase tracking-tight">Share This Analysis</h3>
              <p className="text-xs text-[#00d2ff]">Help others discover this AI insight.</p>
            </div>
            <div className="flex-1 max-w-md">
              <SocialShare
                ticker={stock.ticker}
                score={stock.scores.master_score}
                scoreType={stock.scores.score_type}
                hideHeader={true}
              />
            </div>
          </div>
        </div>

        {/* ── Previous Analyses Archive ── */}
        {archivedDates.length > 0 && (
          <div className="glass-card p-5 mb-4">
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-3">
              Previous Analyses · {stock.ticker}
            </h3>
            <div className="flex flex-wrap gap-2">
              {archivedDates.map((date) => (
                <Link
                  key={date}
                  href={`/en/analysis/${stock.ticker.toLowerCase()}/${date}`}
                  className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#f59e0b]/40 transition-all"
                >
                  {date}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Related Stocks ── */}
        {allTickers.filter(s => s.sector === stock.sector && s.ticker !== stock.ticker).length > 0 && (
          <div className="mb-4">
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-3">
              Related in {stock.sector}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {allTickers
                .filter(s => s.sector === stock.sector && s.ticker !== stock.ticker)
                .slice(0, 5)
                .map((s) => (
                  <Link
                    href={`/stock/${s.ticker}`}
                    key={s.ticker}
                    className="glass-card p-3 hover:bg-[#1a2030] transition-all"
                  >
                    <p className="text-[10px] font-bold text-[#00d2ff] uppercase mb-1">{s.ticker}</p>
                    <p className="text-xs font-mono font-black text-[#00d2ff] truncate mb-1">{s.company}</p>
                    <p className={`text-sm font-mono font-black ${s.change_pct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                    </p>
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
