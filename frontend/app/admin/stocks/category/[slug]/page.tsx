import { getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import { fetchLiveQuotes } from "@/lib/homeFeed";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORY_MAP[slug];
  if (!category) return { title: "Category Not Found | BOGA AI" };

  const titles: Record<string, string> = {
    "top-scores": "Top AI Stock Scores Today | High-Conviction Picks - BOGA AI",
    "breakout": "Breakout Stocks Today | Best Technical Squeeze Patterns - BOGA AI",
    "undervalued": "Undervalued Stocks US | Best Value Investing Picks - BOGA AI",
    "momentum": "Momentum Stocks Today | Strongest Relative Strength Equities - BOGA AI",
    "reversal": "Reversal Stocks US | Best Oversold Stocks to Watch - BOGA AI",
    "passive-income": "Passive Income Stocks | Best High-Yield Dividend Picks - BOGA AI",
  };

  return {
    metadataBase: new URL("https://bogastock.com"),
    title: titles[slug] || `${category.label} Stocks | BOGA AI Daily +500`,
    description: category.description,
    alternates: {
      canonical: `https://bogastock.com/category/${slug}`,
    },
  };
}

const CATEGORY_MAP: Record<string, { key: string; label: string; description: string }> = {
  "top-scores": {
    key: "top_scores",
    label: "Top Scores",
    description: "Today's strongest technical and fundamental setups combined with AI conviction."
  },
  "breakout": {
    key: "breakout",
    label: "Breakout",
    description: "Stocks showing volatility squeeze patterns and high volume preparing for major price moves."
  },
  "undervalued": {
    key: "value",
    label: "Undervalued",
    description: "High-quality companies trading at a significant discount to their intrinsic value and historical multiples."
  },
  "momentum": {
    key: "momentum",
    label: "Momentum",
    description: "Strength-on-strength setups. Stocks in established uptrends with strong institutional accumulation."
  },
  "reversal": {
    key: "reversal",
    label: "Reversal",
    description: "Oversold candidates showing early divergence and volume reversal patterns."
  },
  "passive-income": {
    key: "dividend",
    label: "Passive Income",
    description: "Safe, high-yield dividend payers with consistent payout growth and strong cash flow coverage."
  }
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = CATEGORY_MAP[slug];

  if (!category) {
    notFound();
  }

  const [master, allTickers] = await Promise.all([
    getMasterData(),
    getAllTickers()
  ]);

  if (!master) {
    return <div className="min-h-screen bg-[#0d1117]" />;
  }

  const menu = master.menus[category.key] || { tickers: [] };
  const tickerMap = new Map(allTickers.map((t) => [t.ticker, t]));
  const staticStocks = menu.tickers
    .map((t) => tickerMap.get(t))
    .filter(Boolean);

  // change_pct'i canli veriyle overlay et — Sector Heat Map / Swing / Trend /
  // Top 100 panelleriyle ayni kaynaktan beslenmesi icin (bkz. lib/homeFeed.ts).
  const liveQuotes = await fetchLiveQuotes(staticStocks.map((s) => s!.ticker));
  const stocks = staticStocks.map((s) => {
    const changePct = liveQuotes[s!.ticker]?.price?.change_pct;
    return changePct != null ? { ...s!, change_pct: changePct } : s!;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <TickerTape data={master} />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">{category.label}</span>
        </nav>

        {/* Hero Section */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            {category.label}
          </h1>
          <p className="text-white text-lg max-w-3xl leading-relaxed">
            {category.description}
          </p>
        </header>

        {/* Stats Strip */}
        <div className="flex gap-6 mb-8 pb-8 border-b border-[#1e2a3a]">
          <div>
             <p className="text-[10px] text-[#00d2ff] uppercase tracking-wider mb-1">Total Found</p>
             <p className="text-2xl font-mono font-medium text-white">{stocks.length}</p>
          </div>
          <div className="border-l border-[#1e2a3a] pl-6">
             <p className="text-[10px] text-[#00d2ff] uppercase tracking-wider mb-1">Average Score</p>
             <p className="text-2xl font-mono font-medium text-[#3b82f6]">
                {(stocks.reduce((acc, s) => acc + s!.master_score, 0) / (stocks.length || 1)).toFixed(1)}
             </p>
          </div>
          <div className="border-l border-[#1e2a3a] pl-6">
             <p className="text-[10px] text-[#00d2ff] uppercase tracking-wider mb-1">Last Updated</p>
             <p className="text-2xl font-mono font-medium text-white">
               {new Date(master.generated_at).toLocaleString("en-US", {
                 timeZone: "America/New_York",
                 hour: "2-digit",
                 minute: "2-digit",
                 month: "short",
                 day: "numeric",
               })}
             </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Side Tabs / Category Menu */}
          <aside className="lg:w-64 shrink-0">
            <div className="sticky top-24 glass-card p-4 flex flex-col gap-2">
              <h3 className="text-[10px] text-[#00d2ff] font-black uppercase tracking-widest pl-2 mb-2">Categories</h3>
              {Object.values(CATEGORY_MAP).map((c) => (
                <Link
                  key={c.key}
                  href={`/category/${Object.keys(CATEGORY_MAP).find(k => CATEGORY_MAP[k]?.key === c.key)}`}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all uppercase tracking-widest ${
                    c.key === category.key 
                      ? "bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30" 
                      : "text-white hover:bg-[#1e2a3a] hover:text-white"
                  }`}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Controls / Filter placeholder */}
            <div className="flex items-center justify-between mb-8">
               <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-[#1e2a3a] text-white text-xs font-semibold border border-[#3b82f6]/30">
                     Highest Score
                  </button>
                  <button className="px-3 py-1.5 rounded-lg bg-[#141924] text-white text-xs font-semibold border border-[#1e2a3a] hover:bg-[#1e2a3a] hover:text-white transition-all">
                     Biggest Gainers
                  </button>
               </div>
               <div className="text-xs text-[#00d2ff]">
                  Showing {stocks.length} equities
               </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stocks.map((stock, idx) => (
            <Link
              href={`/stock/${stock!.ticker}`}
              key={stock!.ticker}
              className="glass-card hover:bg-[#1a2030] transition-all duration-300 group flex flex-col p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-medium text-white group-hover:text-[#3b82f6] transition-colors">
                    {stock!.ticker}
                  </h3>
                  <p className="text-xs text-[#00d2ff] truncate max-w-[150px]">{stock!.company}</p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-medium ${getScoreBadgeClass(stock!.score_type)}`}>
                  {stock!.score_type.replace("_", " ")}
                </span>
              </div>

              {/* Score + Change (No price) */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-3xl font-mono font-black text-[#3b82f6]">
                    {stock!.master_score.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-[#00d2ff] font-medium uppercase tracking-widest leading-none">BOGA AI Score</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-mono font-black ${getChangeColor(stock!.change_pct)}`}>
                    {stock!.change_pct >= 0 ? "+" : ""}{stock!.change_pct.toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-[#00d2ff] font-medium uppercase tracking-widest leading-none">Change</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-auto">
                <div className="h-1.5 w-full bg-[#1e2a3a] rounded-full overflow-hidden">
                  <div
                    className="h-full score-gradient-noble rounded-full transition-all duration-1000 delay-300"
                    style={{ width: `${stock!.master_score}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {stocks.length === 0 && (
          <div className="text-center py-20">
             <p className="text-[#00d2ff]">No stocks currently meet the criteria for this category.</p>
          </div>
        )}

        {/* Ad Slot */}
        <div className="mt-16 glass-card flex items-center justify-center h-24 text-[#00d2ff] text-sm">
          AD-C1 &middot; 728&times;90 Leaderboard
        </div>
        </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
