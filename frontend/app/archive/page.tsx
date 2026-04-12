import { getMasterData } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import fs from "fs";
import path from "path";

export default async function ArchivePage() {
  const master = await getMasterData();

  // Discover actual archived dates from the data directory
  let dates: string[] = [];
  try {
    const dataPath = path.resolve(process.cwd(), "..", "data");
    if (fs.existsSync(dataPath)) {
      dates = fs.readdirSync(dataPath)
        .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
        .sort((a, b) => b.localeCompare(a)); // Newest first
    }
  } catch (e) {
    console.error("Failed to read archive dates:", e);
  }

  // Fallback for dev/mock if no folders found
  if (dates.length === 0) {
    const today = new Date();
    for (let i = 1; i <= 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        if (d.getDay() !== 0 && d.getDay() !== 6) {
            dates.push(d.toISOString().split("T")[0]);
        }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-12">
        <header className="mb-12">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Daily Archive</h1>
           </div>
           <p className="text-[#94a3b8] text-lg max-w-2xl leading-relaxed">
              Access the complete BOGA analysis history. Select a trading day to view past scores, signals, and AI summaries.
           </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
           {dates.map((date) => (
              <Link 
                href={`/archive/${date}`} 
                key={date} 
                className="glass-card p-6 flex items-center justify-between group hover:border-[#3b82f6]/50 hover:bg-[#141924] transition-all"
              >
                 <div>
                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-[0.2em] mb-1">Trading Session</p>
                    <p className="text-xl font-mono font-black text-white group-hover:text-[#3b82f6] transition-colors">{date}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-[#0a0e17] border border-[#1e2a3a] flex items-center justify-center text-[#2c3e50] group-hover:text-[#3b82f6] group-hover:border-[#3b82f6]/30 transition-all">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                       <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                    </svg>
                 </div>
              </Link>
           ))}
        </div>

        {/* Info Card */}
        <div className="glass-card p-8 bg-gradient-to-br from-[#141924] to-[#0a0e17] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold text-white mb-3">About the Archive</h3>
            <p className="text-sm text-[#94a3b8] leading-relaxed mb-6">
              The BOGA archive stores full snapshots of the daily +100 stock universe. Unlike the live dashboard which updates every trading morning at 09:00 NY time, these pages preserve the exact signals and AI summaries generated on that specific date.
            </p>
            <div className="flex items-center gap-6 text-[10px] font-bold text-[#64748b] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>
                <span>Snapshot Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#8b5cf6]"></div>
                <span>AI Integrity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                <span>Verified Historials</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
