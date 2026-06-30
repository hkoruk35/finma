"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const DeepAnalysisReport = dynamic(() => import("@/components/DeepAnalysisReport"), { ssr: false });

interface Props {
  /** Ticker to analyze, or null when closed. Controlled by the parent list page. */
  ticker: string | null;
  locale: "tr" | "en";
  onClose: () => void;
}

const TEXT: Record<"tr" | "en", { title: string; body: string; error: string; close: string }> = {
  tr: {
    title: "BOGA AI tarafından güncel analiz yapılıyor",
    body: "Lütfen bekleyin, derin analiz raporu hazırlanıyor...",
    error: "Analiz yüklenemedi. Lütfen tekrar deneyin.",
    close: "Kapat",
  },
  en: {
    title: "BOGA AI is performing the latest analysis",
    body: "Please wait, the deep analysis report is being prepared...",
    error: "Failed to load analysis. Please try again.",
    close: "Close",
  },
};

/**
 * Renders Deep Analysis directly on top of the current page — no navigation, no URL
 * change. The /global/{locale}/ai route is intentionally never visited from here; it
 * must stay hidden from the user. Mount once per list page; control via `ticker`.
 */
export default function DeepAnalysisOverlay({ ticker, locale, onClose }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [stockData, setStockData] = useState<any>(null);
  const t = TEXT[locale];

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setStatus("loading");
    setStockData(null);

    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ticker, history: [], lang: locale }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.stockData) {
          setStockData(data.stockData);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => { if (!cancelled) setStatus("error"); });

    return () => { cancelled = true; };
  }, [ticker, locale]);

  if (!ticker || typeof document === "undefined") return null;

  if (status === "ready" && stockData) {
    return createPortal(
      <DeepAnalysisReport ticker={ticker} stockData={stockData} lang={locale} onClose={onClose} />,
      document.body
    );
  }

  if (status === "error") {
    return createPortal(
      <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-4xl">⚠️</p>
        <p className="text-rose-400 font-black text-sm">{t.error}</p>
        <button onClick={onClose} className="mt-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-black uppercase hover:bg-rose-500/20 transition-all">
          {t.close}
        </button>
      </div>,
      document.body
    );
  }

  // loading
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-[#080c14] flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#06b6d4] flex items-center justify-center animate-pulse">
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      </div>
      <div>
        <p className="text-white font-black text-sm md:text-base uppercase tracking-widest">
          {ticker} — {t.title}
        </p>
        <p className="text-[#06b6d4] text-xs mt-1.5 font-bold">{t.body}</p>
      </div>
      <div className="flex gap-1.5">{[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-[#3b82f6] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
    </div>,
    document.body
  );
}
