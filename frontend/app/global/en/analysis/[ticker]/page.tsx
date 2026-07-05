"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import DeepAnalysisContent from "@/components/DeepAnalysisContent";

export default function EnAnalysisPage() {
  const params = useParams();
  const ticker = (params?.ticker as string)?.toUpperCase() ?? "";
  const [stockData, setStockData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ticker, history: [], lang: "en" }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.stockData) setStockData(d.stockData);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [ticker]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <Link href="/global/en/swing" className="hover:text-[#3b82f6] transition-colors">Tracker</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{ticker} Deep Analysis</span>
        </nav>
        {error ? (
          <div className="text-rose-400 text-sm text-center py-16">Failed to load stock data. Please try again.</div>
        ) : (
          <DeepAnalysisContent ticker={ticker} stockData={stockData} lang="en" />
        )}
      </main>
      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
