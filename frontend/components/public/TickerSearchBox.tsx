"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  ticker: string;
  company: string;
}

export default function TickerSearchBox({ locale = "en", onSelect }: { locale?: string, onSelect?: (ticker: string) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/tickers/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          setSuggestions(d.results ?? []);
          setOpen(true);
          setActiveIndex(-1);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToTicker = (ticker: string) => {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    if (onSelect) { onSelect(ticker.toUpperCase()); } else { router.push(`/global/${locale}/graphic/${ticker.toUpperCase()}`); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && query.trim()) goToTicker(query.trim());
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (pick) goToTicker(pick.ticker);
      else if (query.trim()) goToTicker(query.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative mb-4 md:max-w-sm">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={
          locale === "tr" ? "Hisse ara (örn. AAPL, MSFT)..."
          : locale === "es" ? "Buscar acción (ej. AAPL, MSFT)..."
          : locale === "fr" ? "Rechercher un titre (ex. AAPL, MSFT)..."
          : locale === "pt" ? "Buscar ação (ex. AAPL, MSFT)..."
          : "Search ticker (e.g. AAPL, MSFT)..."
        }
        className="w-full px-4 py-2.5 rounded-lg bg-[#1a2b4d] border border-[#2a3f66] text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#3b82f6] transition-colors"
      />
      <p className="mt-1.5 text-[10px] text-slate-500">
        {locale === "tr" ? "BOGA AI, tüm ABD borsasında anlık genel kontrol yapabilir."
        : locale === "es" ? "BOGA AI puede analizar todo el mercado de EE. UU. en tiempo real."
        : locale === "fr" ? "BOGA AI peut analyser l'ensemble du marché américain en temps réel."
        : locale === "pt" ? "A BOGA AI pode analisar todo o mercado dos EUA em tempo real."
        : "BOGA AI can instantly scan the entire U.S. stock market."}
      </p>
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg bg-[#1a2b4d] border border-[#2a3f66] shadow-xl">
          {suggestions.map((s, i) => (
            <button
              key={s.ticker}
              type="button"
              onClick={() => goToTicker(s.ticker)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                i === activeIndex ? "bg-[#3b82f6]/15" : "hover:bg-white/5"
              }`}
            >
              <span className="font-bold text-white shrink-0">{s.ticker}</span>
              <span className="text-slate-400 text-xs truncate min-w-0">{s.company}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
