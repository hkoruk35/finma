import { getStockData, getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TradingViewWidget from "@/components/stock/TradingViewWidget";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import SocialShare from "@/components/SocialShare";
import MarketStatus from "@/components/MarketStatus";
import AnalysisTabs from "@/components/stock/AnalysisTabs";

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
      {master && <TickerTape data={master} />}
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
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-5">
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
          <span className="text-[#94a3b8]">{stock.ticker}</span>
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
                    <span className="text-[10px] text-[#64748b]">· {swing.holding_period} horizon</span>
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
                <p className="text-base text-[#94a3b8] font-semibold">{stock.company}</p>
                <span className="text-[#1e2a3a]">·</span>
                <p className="text-sm text-[#64748b] font-medium uppercase tracking-wider">{stock.sector}</p>
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
              <div className="flex items-baseline gap-3">
                <span className="text-4xl md:text-5xl font-mono font-black text-white leading-none tracking-tighter">
                  ${formatPrice(stock.price.current)}
                </span>
                <div className={`flex flex-col ${getChangeColor(stock.price.change_pct)}`}>
                  <span className="text-xl font-mono font-black leading-none">
                    {stock.price.change_pct >= 0 ? "+" : ""}{stock.price.change_pct.toFixed(2)}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-right">Today</span>
                </div>
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
              <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">{p.label}</span>
              <span className={`text-base md:text-lg font-mono font-black ${
                p.value !== undefined && p.value !== null ? getChangeColor(p.value) : "text-[#64748b]"
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
          <div className={`glass-card p-5 mb-4 border border-[#22c55e]/25 bg-[#22c55e]/5`}>
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              {/* Score */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-[#141924] border border-[#1e2a3a]">
                  <span className="text-2xl font-black text-white font-mono">
                    {stock.scores.master_score.toFixed(0)}
                  </span>
                  <span className="text-[8px] text-[#64748b] uppercase tracking-widest">/ 100</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#64748b] uppercase tracking-widest mb-1">BOGA AI Score</p>
                  <p className={`text-lg font-black uppercase ${sig.color}`}>{sig.icon} {sig.label}</p>
                  {swing?.boga_zones?.risk_reward && (
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      Risk/Reward: <span className="text-white font-bold">{swing.boga_zones.risk_reward}:1</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Trading Zones — compact */}
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                  <p className="text-[9px] font-black text-[#64748b] uppercase tracking-widest mb-1">Entry Zone</p>
                  <p className="font-mono font-black text-white text-sm">
                    ${formatPrice(stock.scores_detail.entry_range_low)}
                  </p>
                  <p className="font-mono font-black text-white text-sm">
                    – ${formatPrice(stock.scores_detail.entry_range_high)}
                  </p>
                </div>
                <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#22c55e]">
                  <p className="text-[9px] font-black text-[#64748b] uppercase tracking-widest mb-1">Target</p>
                  <p className="font-mono font-black text-[#22c55e] text-sm">
                    ${formatPrice(stock.scores_detail.target_range_low)}
                  </p>
                  <p className="font-mono font-black text-[#22c55e] text-sm">
                    – ${formatPrice(stock.scores_detail.target_range_high)}
                  </p>
                </div>
                <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#ef4444]">
                  <p className="text-[9px] font-black text-[#64748b] uppercase tracking-widest mb-1">Stop Loss</p>
                  <p className="font-mono font-black text-[#ef4444] text-sm">
                    ${formatPrice(stock.scores_detail.stop_range_low)}
                  </p>
                  <p className="font-mono font-black text-[#ef4444] text-sm">
                    – ${formatPrice(stock.scores_detail.stop_range_high)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Chart ── */}
        <div className="glass-card overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2a3a] bg-[#0d1117]/60">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">
                Live Chart · {stock.ticker}
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-[10px] font-bold text-[#94a3b8]">1D</span>
              <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-[10px] font-bold text-[#94a3b8]">NY TIME</span>
            </div>
          </div>
          <div className="w-full min-h-[260px] md:min-h-[300px]">
            <TradingViewWidget symbol={stock.ticker} />
          </div>
        </div>

        {/* ── AI Analysis Tabs ── */}
        <div className="mb-4">
          <AnalysisTabs stock={stock} />
        </div>

        {/* ── Trading Parameters (for non-swing-pick stocks) ── */}
        {!isSwingPick && (
          <div className="glass-card p-5 mb-4">
            <h3 className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest mb-4 flex items-center gap-2">
              🎯 Trading Parameters
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest mb-1">Entry Zone</p>
                <p className="font-mono font-black text-white text-sm">
                  ${formatPrice(stock.scores_detail.entry_range_low)} – ${formatPrice(stock.scores_detail.entry_range_high)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#22c55e]">
                <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest mb-1">Target</p>
                <p className="font-mono font-black text-[#22c55e] text-sm">
                  ${formatPrice(stock.scores_detail.target_range_low)} – ${formatPrice(stock.scores_detail.target_range_high)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#ef4444]">
                <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest mb-1">Stop Loss</p>
                <p className="font-mono font-black text-[#ef4444] text-sm">
                  ${formatPrice(stock.scores_detail.stop_range_low)} – ${formatPrice(stock.scores_detail.stop_range_high)}
                </p>
              </div>
              <div className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] border-l-4 border-l-[#8b5cf6]">
                <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest mb-1">Risk / Reward</p>
                <p className="font-mono font-black text-[#8b5cf6] text-xl">{stock.scores_detail.risk_reward_ratio}:1</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Sector Context ── */}
        <div className="glass-card p-5 mb-4">
          <h3 className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest mb-3 flex items-center gap-2">
            🌍 Sector Context
          </h3>
          <div className="flex items-center justify-between p-4 bg-[#141924] rounded-xl border border-[#1e2a3a]">
            <div>
              <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1">Sector ETF</p>
              <p className="text-lg font-black text-white">{stock.sector_context?.sector_etf ?? "—"}</p>
            </div>
            <div className="h-10 w-px bg-[#1e2a3a]" />
            <div className="text-right">
              <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1">5-Day Performance</p>
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
            <h3 className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest mb-4">📰 Recent News</h3>
            <div className="space-y-4">
              {stock.news.map((n, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center gap-3 group pb-4 border-b border-[#1e2a3a] last:border-0 last:pb-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-wider">{n.source}</span>
                      <span className="text-[9px] text-[#64748b]">· {new Date(n.published).toLocaleDateString()}</span>
                    </div>
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold text-white group-hover:text-[#3b82f6] transition-colors line-clamp-2">
                      {n.headline}
                    </a>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                    n.sentiment === "positive" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#64748b]/10 text-[#94a3b8]"
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
              <p className="text-xs text-[#64748b]">Help others discover this AI insight.</p>
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

        {/* ── Related Stocks ── */}
        {allTickers.filter(s => s.sector === stock.sector && s.ticker !== stock.ticker).length > 0 && (
          <div className="mb-4">
            <h3 className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest mb-3">
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
                    <p className="text-[10px] font-bold text-[#64748b] uppercase mb-1">{s.ticker}</p>
                    <p className="text-xs font-mono font-black text-[#64748b] truncate mb-1">{s.company}</p>
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
