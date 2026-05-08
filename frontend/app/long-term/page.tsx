import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function LongTermPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full glass-card p-12 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <div className="bg-[#f59e0b] text-black text-[10px] font-black px-3 py-1 rounded-full animate-pulse tracking-widest uppercase">
               Coming Soon
             </div>
          </div>
          
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-4xl mb-6 mx-auto">🏗️</div>
          
          <h1 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Long-Term Portfolio</h1>
          <p className="text-[#475569] text-sm font-bold mb-8 leading-relaxed">
            The BOGA AI Long-Term engine is currently in development. This module will focus on multi-month macro trends, dividends, and institutional value plays.
          </p>
          
          <div className="space-y-3">
            <Link 
              href="/swing" 
              className="block w-full py-3 bg-[#3b82f6] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#2563eb] transition-all"
            >
              Explore Swing Terminal
            </Link>
            <Link 
              href="/daytrade" 
              className="block w-full py-3 bg-[#1e293b] text-[#10b981] border border-[#10b981]/30 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#10b981]/10 transition-all"
            >
              Explore DayTrade Terminal
            </Link>
          </div>
        </div>
        
        <div className="mt-12 text-[10px] text-[#475569] font-black uppercase tracking-[0.3em] flex items-center gap-4">
          <span className="w-12 h-[1px] bg-[#1e2a3a]"></span>
          BOGA AI V1.5 ENGINE
          <span className="w-12 h-[1px] bg-[#1e2a3a]"></span>
        </div>
      </main>
      <Footer />
    </div>
  );
}
