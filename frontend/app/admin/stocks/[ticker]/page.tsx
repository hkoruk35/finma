"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const StockReportView = dynamic(() => import("@/components/StockReportView"), { ssr: false });

export default function StockDetailPage() {
  const params = useParams();
  const tickerParam = Array.isArray(params.ticker) ? params.ticker[0] : params.ticker;
  const ticker = (tickerParam || "").toUpperCase();

  const [stockData, setStockData] = useState<any>(null);
  const [masterData, setMasterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;

    const fetchStockData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: ticker,
            history: [],
            lang: "en"
          }),
        });

        if (!res.ok) {
          setError("Failed to fetch stock data");
          return;
        }

        const data = await res.json();
        setStockData(data.stockData || {});
        setMasterData(data.masterData || null);
      } catch (err) {
        setError("Error loading stock details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, [ticker]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 w-full">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3b82f6] mx-auto mb-4" />
              <p className="text-[#00d2ff] font-medium">Yükleniyor...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-[#ef4444] font-medium">{error}</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto w-full px-4 py-6">
            <StockReportView ticker={ticker} stockData={stockData} masterData={masterData} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
