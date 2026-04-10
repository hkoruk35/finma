import { getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORY_MAP[slug];
  if (!category) return { title: "Category Not Found | FinMA" };

  const titles: Record<string, string> = {
    "top-scores": "Top AI Stock Scores Today | High-Conviction Picks - FinMA",
    "breakout": "Breakout Stocks Today | Best Technical Squeeze Patterns - FinMA",
    "undervalued": "Undervalued Stocks US | Best Value Investing Picks - FinMA",
    "momentum": "Momentum Stocks Today | Strongest Relative Strength Equities - FinMA",
    "reversal": "Reversal Stocks US | Best Oversold Stocks to Watch - FinMA",
    "passive-income": "Passive Income Stocks | Best High-Yield Dividend Picks - FinMA",
  };

  return {
    metadataBase: new URL("https://finmasmart.com"),
    title: titles[slug] || `${category.label} Stocks | FinMA Daily +500`,
    description: category.description,
    alternates: {
      canonical: `https://finmasmart.com/category/${slug}`,
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
  const stocks = menu.tickers
    .map((t) => tickerMap.get(t))
    .filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <TickerTape data={master} />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">{category.label}</span>
        </nav>

        {/* Hero Section */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            {category.label}
          </h1>
          <p className="text-[#94a3b8] text-lg max-w-3xl leading-relaxed">
            {category.description}
          </p>
        </header>

        {/* Stats Strip */}
        <div className="flex gap-6 mb-8 pb-8 border-b border-[#1e2a3a]">
          <div>
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Total Found</p>
             <p className="text-2xl font-mono font-bold text-white">{stocks.length}</p>
          </div>
          <div className="border-l border-[#1e2a3a] pl-6">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Average Score</p>
             <p className="text-2xl font-mono font-bold text-[#3b82f6]">
                {(stocks.reduce((acc, s) => acc + s!.master_score, 0) / (stocks.length || 1)).toFixed(1)}
             </p>
          </div>
          <div className="border-l border-[#1e2a3a] pl-6">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Last Updated</p>
             <p className="text-2xl font-mono font-bold text-white">09:00 AM</p>
          </div>
        </div>

        {/* Controls / Filter placeholder */}
        <div className="flex items-center justify-between mb-8">
           <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-[#1e2a3a] text-white text-xs font-semibold border border-[#3b82f6]/30">
                 Highest Score
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-[#141924] text-[#94a3b8] text-xs font-semibold border border-[#1e2a3a] hover:bg-[#1e2a3a] hover:text-white transition-all">
                 Biggest Gainers
              </button>
           </div>
           <div className="text-xs text-[#64748b]">
              Showing {stocks.length} equities
           </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stocks.map((stock, idx) => (
            <Link
              href={`/stock/${stock!.ticker}`}
              key={stock!.ticker}
              className="glass-card hover:bg-[#1a2030] transition-all duration-300 group flex flex-col p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-[#3b82f6] transition-colors">
                    {stock!.ticker}
                  </h3>
                  <p className="text-xs text-[#64748b] truncate max-w-[150px]">{stock!.company}</p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${getScoreBadgeClass(stock!.score_type)}`}>
                  {stock!.score_type.replace("_", " ")}
                </span>
              </div>

              {/* Score + Change (No price) */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-3xl font-mono font-black text-[#3b82f6]">
                    {stock!.master_score.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest leading-none">FinMA Score</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-mono font-black ${getChangeColor(stock!.change_pct)}`}>
                    {stock!.change_pct >= 0 ? "+" : ""}{stock!.change_pct.toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest leading-none">Change</div>
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
             <p className="text-[#64748b]">No stocks currently meet the criteria for this category.</p>
          </div>
        )}

        {/* Ad Slot */}
        <div className="mt-16 glass-card flex items-center justify-center h-24 text-[#64748b] text-sm">
          AD-C1 &middot; 728&times;90 Leaderboard
        </div>
      </main>

      <Footer />
    </div>
  );
}
