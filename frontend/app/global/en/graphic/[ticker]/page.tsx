"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

export default function GraphicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = (params?.ticker as string)?.toUpperCase() ?? "";
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .catch(() => router.push("/global/en/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-white/50 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{ticker} Chart</span>
        </nav>
        <div className="glass-card overflow-hidden mb-4">
          <BogaChartEngine
            symbol={ticker}
            lang="en"
            detailMode
            height={600}
            defaultIndicators={["ema20", "ema50", "rsi", "sr"]}
            defaultTimeframe="D"
          />
        </div>
      </main>
      <Footer hidePlatform locale="en" />
    </div>
  );
}
