"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import DeepAnalysisContent from "@/components/DeepAnalysisContent";

/**
 * Eskiden /global/{locale}/analysis/{ticker} altında 6 dilde ayrı ayrı
 * public/üye sayfası olarak yayındaydı. Artık kullanıcıya gösterilmiyor,
 * indekslenmiyor (proxy.ts admin auth guard + robots.ts "/admin/" disallow
 * zaten kapsıyor) — sadece admin panelinden erişilen tek bir iç araç.
 * Dil ayrımı gerekmediği için tek rota (İngilizce arayüz) olarak tutuldu.
 */
export default function AdminAnalysisPage() {
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
      .then((r) => r.json())
      .then((d) => {
        if (d?.stockData) setStockData(d.stockData);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [ticker]);

  return (
    <div className="p-4 md:p-5 bg-[#0a0e17] min-h-screen text-slate-300">
      <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-4">
        <Link href="/admin" className="hover:text-[#3b82f6] transition-colors">
          Admin
        </Link>
        <span className="opacity-30">/</span>
        <span className="text-white italic">{ticker} Deep Analysis</span>
      </nav>
      {error ? (
        <div className="text-rose-400 text-sm text-center py-16">Failed to load stock data. Please try again.</div>
      ) : (
        <DeepAnalysisContent ticker={ticker} stockData={stockData} lang="en" />
      )}
    </div>
  );
}
