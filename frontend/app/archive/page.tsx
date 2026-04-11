import { getMasterData, getAllTickers } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";

export default async function ArchivePage() {
  const master = await getMasterData();

  // Generate mock dates for the last 30 days
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Skip weekends
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <header className="mb-10">
           <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">Daily Archive</h1>
           <p className="text-[#94a3b8] text-lg max-w-2xl leading-relaxed">
              Historical BOGA scores from the last 30 trading days.
              Review past performance and trends.
           </p>
        </header>

        {/* Member Gate Overlay Hint if needed, for now just rendering the list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
           {dates.map((date) => (
              <div key={date} className="glass-card p-6 flex items-center justify-between group hover:border-[#3b82f6]/30 transition-all cursor-pointer">
                 <div>
                    <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Trading Day</p>
                    <p className="text-lg font-mono font-bold text-white group-hover:text-[#3b82f6] transition-colors">{date}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-[#141924] flex items-center justify-center text-[#2c3e50] group-hover:text-[#3b82f6] transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                 </div>
              </div>
           ))}
        </div>

        {/* Blur / Lock Overlay Placeholder */}
        <div className="relative">
           <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-transparent to-transparent pointer-events-none z-10 h-40 -top-40"></div>
           <div className="glass-card p-12 text-center relative z-20 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6]"></div>
              <div className="max-w-md mx-auto">
                 <div className="w-16 h-16 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-3">Historic Analysis Locked</h2>
                 <p className="text-[#94a3b8] mb-8">
                    Archive access is available to registered members only. 
                    Create a free account to view detailed analysis from past dates.
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/register" className="px-8 py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb] transition-all">
                       Register Free
                    </Link>
                    <Link href="/login" className="px-8 py-3 bg-[#141924] border border-[#1e2a3a] text-white rounded-xl font-bold hover:bg-[#1a2030] transition-all">
                       Sign In
                    </Link>
                 </div>
              </div>
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
