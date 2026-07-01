import { getMasterData, getAllTickers } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import IndexCards from "@/components/IndexCards";
import StatsBar from "@/components/StatsBar";
import CategoryTabs from "@/components/CategoryTabs";
import SectorHeatMap from "@/components/SectorHeatMap";
import Top3Section from "@/components/Top3Section";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface ArchiveDatePageProps {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: ArchiveDatePageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Archive: ${date} | BOGA AI Analysis History`,
    description: `View historical AI stock scores and market analysis from the trading session on ${date}. Explore past top performers and sector trends.`,
  };
}

export default async function ArchiveDatePage({ params }: ArchiveDatePageProps) {
  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const [master, allTickers] = await Promise.all([
    getMasterData(date),
    getAllTickers(date),
  ]);

  // If no data found for this date, show 404
  if (!master || allTickers.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0d1117]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 flex items-center justify-center text-[#ef4444] mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">No Data for {date}</h1>
          <p className="text-white mb-8 text-center max-w-sm">
            We couldn't find any archived market data for this specific trading day. 
            The system may have been offline or data was not preserved.
          </p>
          <Link href="/admin/archive" className="px-6 py-2 bg-[#3b82f6] text-white rounded-lg font-bold hover:bg-[#2563eb] transition-all">
            Back to Archive
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ticker Tape */}
      <TickerTape data={master} />

      {/* Header */}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Archive Banner */}
        <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-xl p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
             </div>
             <div>
                <p className="text-sm font-bold text-white">Viewing Historical Archive</p>
                <p className="text-xs text-[#3b82f6]">Data captured on {date}</p>
             </div>
          </div>
          <Link href="/admin/archive" className="text-xs font-bold text-[#3b82f6] hover:underline uppercase tracking-widest">
            Back to List
          </Link>
        </div>

        {/* Index Quick View */}
        <section className="mb-8 animate-fade-in text-opacity-50 grayscale-[20%]">
          <IndexCards data={master} />
        </section>

        {/* Hero */}
        <section className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d2ff] font-mono">BOGA AI · DAILY ARCHIVE</span>
          </div>
          <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white leading-none">
            Analysis Archive
            <span className="text-[#3b82f6] ml-2 not-italic">{date}</span>
          </h1>
        </section>

        {/* Top 3 of the Day */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <Top3Section master={master} allTickers={allTickers} />
        </section>

        {/* Stats Bar */}
        <section className="mb-8 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <StatsBar data={master} />
        </section>

        {/* Category Tabs */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <CategoryTabs master={master} allTickers={allTickers} />
        </section>

        {/* Sector Heat Map */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <SectorHeatMap data={master} allTickers={allTickers} />
        </section>

        {/* Disclaimer */}
        <div className="glass-card p-6 text-center text-[#00d2ff] text-xs leading-relaxed max-w-3xl mx-auto mb-12">
           This page displays historical data and analysis as it appeared on {date}. 
           Financial conditions and stock prices have likely changed since this snapshot. 
           Always verify current data before making trading decisions.
        </div>
      </main>

      <Footer />
    </div>
  );
}
