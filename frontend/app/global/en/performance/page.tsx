import { Metadata } from "next";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import { getSwingPerformance, getAllTickers } from "@/lib/data";
import { getAllTop100Tickers } from "@/lib/homeFeed";
import TickerTape from "@/components/TickerTape";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "System Performance | BOGA AI",
  description: "BOGA AI Swing Engine performance dashboard with detailed trading records and top 100 stocks.",
  alternates: { canonical: "https://bogastock.com/global/en/performance" },
};

export default async function EnPerformancePage() {
  const [swingStats, top100Tickers] = await Promise.all([
    getSwingPerformance(),
    getAllTop100Tickers(100),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Performance Banner */}
        <SwingPerformanceBanner stats={swingStats?.stats} />

        {/* Top 100 Stocks Section */}
        <div className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Top 100 Stocks by Volume</h2>
            <p className="text-sm text-slate-400">Real-time tracking of the most actively traded stocks</p>
          </div>

          {/* Stocks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {top100Tickers.map((stock) => (
              <Link
                key={stock.ticker}
                href={`/global/en/stock/${stock.ticker}`}
                className="group p-3 rounded-lg border border-slate-700 bg-slate-900/30 hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white group-hover:text-[#3b82f6]">{stock.ticker}</span>
                  <span className={`text-xs font-bold ${stock.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-1">{stock.sector}</div>
                <div className="text-xs font-mono text-slate-300">${stock.price.toFixed(2)}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
