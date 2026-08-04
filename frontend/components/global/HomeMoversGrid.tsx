'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n/copy';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import HomeListCard, { type HomeListStock } from './HomeListCard';
import TrendPicksSlot from './TrendPicksSlot';

interface MoversResponse {
  top7: HomeListStock[];
  top100: HomeListStock[];
  gainers: HomeListStock[];
  losers: HomeListStock[];
  mostActive: HomeListStock[];
}

const EMPTY: MoversResponse = { top7: [], top100: [], gainers: [], losers: [], mostActive: [] };

function getTitles(locale: Locale) {
  if (locale === 'tr') return { top7: 'Top 7', gainers: 'En Çok Artanlar', losers: 'En Çok Düşenler', mostActive: 'En Çok İşlem Görenler', top100: 'Top 100' };
  if (locale === 'pt') return { top7: 'Top 7', gainers: 'Maiores Altas', losers: 'Maiores Baixas', mostActive: 'Mais Negociadas', top100: 'Top 100' };
  if (locale === 'es') return { top7: 'Top 7', gainers: 'Mayores Alzas', losers: 'Mayores Bajas', mostActive: 'Más Negociadas', top100: 'Top 100' };
  if (locale === 'fr') return { top7: 'Top 7', gainers: 'Plus Fortes Hausses', losers: 'Plus Fortes Baisses', mostActive: 'Plus Échangées', top100: 'Top 100' };
  return { top7: 'Top 7', gainers: 'Top Gainers', losers: 'Top Losers', mostActive: 'Most Active', top100: 'Top 100' };
}

const CARD_WIDTH = 'shrink-0 snap-start w-[85%] sm:w-[320px]';
const CARD_STEP = 336;

export default function HomeMoversGrid({ locale }: { locale: Locale }) {
  const [data, setData] = useState<MoversResponse | null>(null);
  const { tier } = useMemberPlan();
  const requireAuthToOpen = tier === 'anonymous';
  const titles = getTitles(locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByCard = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * CARD_STEP, behavior: 'smooth' });

  useEffect(() => {
    let active = true;
    fetch('/api/home-movers?limit=7', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setData(EMPTY); });
    return () => { active = false; };
  }, []);

  const loading = data === null;
  const d = data ?? EMPTY;

  const cards = [
    { key: 'top7', title: titles.top7, accent: '#3b82f6', href: `/global/${locale}/top7`, stocks: d.top7, gated: false },
    { key: 'gainers', title: titles.gainers, accent: '#3b82f6', href: `/global/${locale}/gainers`, stocks: d.gainers, gated: requireAuthToOpen },
    { key: 'losers', title: titles.losers, accent: '#3b82f6', href: `/global/${locale}/losers`, stocks: d.losers, gated: requireAuthToOpen },
    { key: 'top100', title: titles.top100, accent: '#3b82f6', href: `/global/${locale}/top100`, stocks: d.top100, gated: requireAuthToOpen },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        aria-label="Previous"
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-8 h-8 rounded-full bg-[#0f1117] border border-[#1e2a3a] text-white/70 hover:text-white hover:border-[#38bdf8]/60 shadow-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div
        ref={scrollRef}
        className="flex items-start overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-2"
        onWheel={(e) => { if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY; }}
      >
        {cards.map((c) => (
          <div key={c.key} className={CARD_WIDTH}>
            <HomeListCard
              title={c.title}
              accent={c.accent}
              viewAllHref={c.href}
              stocks={c.stocks}
              locale={locale}
              loading={loading}
              requireAuthToOpen={c.gated}
            />
          </div>
        ))}
        <div className={CARD_WIDTH}>
          <TrendPicksSlot locale={locale} compactMode />
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollByCard(1)}
        aria-label="Next"
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-8 h-8 rounded-full bg-[#0f1117] border border-[#1e2a3a] text-white/70 hover:text-white hover:border-[#38bdf8]/60 shadow-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
