'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import type { Locale } from '@/lib/i18n/copy';

interface Suggestion {
  ticker: string;
  company: string;
}

const REGISTER_PATH: Record<Locale, string> = {
  tr: 'kayit',
  en: 'register',
  es: 'register',
  fr: 'register',
  pt: 'register',
};

function getCopy(locale: Locale) {
  if (locale === 'tr') return {
    placeholder: 'Hisse, endeks, döviz veya kripto ara (örn. AAPL, MSFT, BTCUSD)...',
    hint: 'BOGA AI, tüm ABD borsasında anlık genel kontrol yapabilir.',
  };
  if (locale === 'es') return {
    placeholder: 'Buscar acción, índice, divisa o cripto (ej. AAPL, MSFT, BTCUSD)...',
    hint: 'BOGA AI puede analizar todo el mercado de EE. UU. en tiempo real.',
  };
  if (locale === 'fr') return {
    placeholder: 'Rechercher une action, un indice, une devise ou une crypto (ex. AAPL, MSFT, BTCUSD)...',
    hint: "BOGA AI peut analyser l'ensemble du marché américain en temps réel.",
  };
  if (locale === 'pt') return {
    placeholder: 'Buscar ação, índice, moeda ou cripto (ex. AAPL, MSFT, BTCUSD)...',
    hint: 'A BOGA AI pode analisar todo o mercado dos EUA em tempo real.',
  };
  return {
    placeholder: 'Search stock, index, currency, or crypto (e.g. AAPL, MSFT, BTCUSD)...',
    hint: 'BOGA AI can instantly scan the entire U.S. stock market.',
  };
}

/**
 * Ana sayfanın en üstündeki arama kutusu — TickerSearchBox ile AYNI kaynağı
 * kullanır (/api/tickers/search, "aynı kaynak/aynı sonuç" isteği), sadece
 * daha geniş ve sonucu görüntülemek (ilgili /graphic sayfasına gitmek) için
 * giriş yapmış olmayı şart koşar. Öneri listesi (ticker+şirket adı) herkese
 * açık kalır — kilitlenen sadece SONUCA gidiş (BOGA'nın o ticker için ürettiği
 * analiz sayfası), Yahoo'nun genel arama indeksi değil.
 */
export default function HomeSearchBar({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { tier, loading: tierLoading } = useMemberPlan();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const copy = getCopy(locale);

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToTicker = (ticker: string) => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    // Sonucu (BOGA analiz sayfasını) görmek için giriş şart — sadece
    // tier'ı henüz çözülmüşse (tierLoading false) ve gerçekten anonimse
    // kayıt sayfasına yönlendir; yükleme sırasında yanlışlıkla kilitlemeyelim.
    if (!tierLoading && tier === 'anonymous') {
      router.push(`/global/${locale}/${REGISTER_PATH[locale]}`);
      return;
    }
    router.push(`/global/${locale}/graphic/${ticker.toUpperCase()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter' && query.trim()) goToTicker(query.trim());
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (pick) goToTicker(pick.ticker);
      else if (query.trim()) goToTicker(query.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl mx-auto mb-6">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={copy.placeholder}
          className="w-full rounded-2xl bg-[#141924] border border-[#1e2a3a] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6] transition-colors pl-12 pr-4 py-4 text-base shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-500 text-center">{copy.hint}</p>

      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto rounded-xl bg-[#141924] border border-[#1e2a3a] shadow-xl">
          {suggestions.map((s, i) => (
            <button
              key={s.ticker}
              type="button"
              onClick={() => goToTicker(s.ticker)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                i === activeIndex ? 'bg-[#3b82f6]/15' : 'hover:bg-white/5'
              }`}
            >
              <span className="font-medium text-white shrink-0">{s.ticker}</span>
              <span className="text-slate-400 text-xs truncate min-w-0">{s.company}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
