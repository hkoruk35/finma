"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import DeepAnalysisContent from "@/components/DeepAnalysisContent";

export default function FrAnalysisPage() {
  const params = useParams();
  const ticker = (params?.ticker as string)?.toUpperCase() ?? "";
  const [stockData, setStockData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ticker, history: [], lang: "fr" }),
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
      <MemberHeader locale="fr" />

      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-4">
            <Link href="/global/fr/ai" className="hover:text-[#3b82f6] transition-colors">Analyse IA</Link>
            <span className="opacity-30">/</span>
            <span className="text-white italic">{ticker}</span>
          </nav>

          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
              <p className="text-red-300 font-medium">Impossible de charger l'analyse pour {ticker}.</p>
            </div>
          ) : !stockData ? (
            <div className="text-center py-20 text-slate-400 font-medium uppercase animate-pulse">
              Chargement de l'analyse...
            </div>
          ) : (
            <DeepAnalysisContent ticker={ticker} stockData={stockData} lang="fr" />
          )}
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
