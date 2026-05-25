"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const DeepAnalysisReport = dynamic(() => import("@/components/DeepAnalysisReport"), { ssr: false });

interface ArchiveEntry { slug: string; date: string; time: string; }

export default function AIArchivePage() {
  const [ticker, setTicker]   = useState("");
  const [input, setInput]     = useState("");
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewData, setViewData] = useState<any>(null);
  const [viewTicker, setViewTicker] = useState("");

  const search = async (t: string) => {
    if (!t) return;
    setLoading(true);
    setTicker(t.toUpperCase());
    setEntries([]);
    const res = await fetch(`/api/deep-analysis-archive?ticker=${t.toUpperCase()}`);
    const data = await res.json();
    setEntries(data.entries || []);
    setLoading(false);
  };

  const openReport = async (t: string, slug: string) => {
    const res  = await fetch(`/api/deep-analysis-archive?ticker=${t}&slug=${slug}`);
    const data = await res.json();
    setViewData(data);
    setViewTicker(t);
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/ai" className="text-[#06b6d4] hover:underline text-sm font-black uppercase tracking-wider">← AI Analiz</Link>
        <span className="text-slate-600">|</span>
        <h1 className="text-lg font-black uppercase tracking-widest text-white">Derin Analiz Arşivi</h1>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-8">
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && search(input)}
          placeholder="Hisse kodu gir (örn. TSLA)"
          className="flex-1 bg-[#0d1321] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-[#06b6d4]"
        />
        <button
          onClick={() => search(input)}
          disabled={loading || !input}
          className="px-6 py-3 rounded-xl bg-[#1d4ed8] text-white font-black text-sm uppercase tracking-wider hover:bg-[#2563eb] disabled:opacity-50 transition-all"
        >
          {loading ? "..." : "Ara"}
        </button>
      </div>

      {/* Results */}
      {ticker && (
        <div>
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{ticker} — {entries.length} Arşivlenmiş Rapor</div>
          {entries.length === 0 && !loading && (
            <div className="text-slate-500 text-sm bg-[#0d1321] border border-[#1e3a5f] rounded-xl p-6 text-center">
              Bu hisse için arşivlenmiş rapor bulunamadı.
            </div>
          )}
          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.slug} className="flex items-center justify-between bg-[#0d1321] border border-[#1e3a5f]/60 rounded-xl px-4 py-3 hover:border-[#06b6d4]/40 transition-all">
                <div>
                  <div className="font-black text-white text-sm">{ticker}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{e.date} — {e.time} (İST)</div>
                </div>
                <button
                  onClick={() => openReport(ticker, e.slug)}
                  className="px-4 py-1.5 rounded-lg bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-[11px] font-black uppercase tracking-wider hover:bg-[#06b6d4]/20 transition-all"
                >
                  Görüntüle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report viewer overlay */}
      {viewData && viewTicker && (
        <DeepAnalysisReport
          ticker={viewTicker}
          stockData={viewData.rawData ?? {}}
          onClose={() => setViewData(null)}
        />
      )}
    </div>
  );
}
