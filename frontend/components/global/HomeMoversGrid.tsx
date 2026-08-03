'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/copy';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import HomeListCard, { type HomeListStock } from './HomeListCard';
import TrendPicksSlot from './TrendPicksSlot';
import TrendCandidatesSlot from './TrendCandidatesSlot';

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

/**
 * Top7/Top100/Gainers/Losers/MostActive kartlarının tek veri kaynağı
 * /api/home-movers'tır. Ticker kimliği artık maskelenmiyor (herkes gerçek
 * ticker görür) — kısıtlama sadece satıra TIKLAYIP /graphic'e geçişte:
 * anonim ziyaretçi (useMemberPlan().tier === "anonymous") için tıklama
 * kayıt sayfasına yönlendirilir (requireAuthToOpen, bkz. HomeListCard.tsx).
 * Top7 bu kısıtlamadan muaf — sabit/herkese açık (Magnificent 7).
 *
 * Sıra (2026-08-03 kullanıcı talebiyle sabitlendi): Top7 → Gainers → Losers
 * → MostActive → Top100 → Trend Hisseleri (TrendPicksSlot, "Trending
 * Stocks") → Trend Adayları (TrendCandidatesSlot). Trend Hisseleri kasıtlı
 * olarak PREMIUM kalan tek liste; Trend Adayları kendi mevcut
 * premium-kilit kuralını (isTrendPickTierUnlocked ile aynı ilke) koruyor —
 * kullanıcının talebi bu ikisini adlandırmadığı için davranışları
 * değiştirilmedi, sadece sona eklendi.
 */
export default function HomeMoversGrid({ locale }: { locale: Locale }) {
  const [data, setData] = useState<MoversResponse | null>(null);
  const { tier } = useMemberPlan();
  const requireAuthToOpen = tier === 'anonymous';
  const titles = getTitles(locale);

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
    { key: 'top7', title: titles.top7, accent: '#a78bfa', href: `/global/${locale}/top7`, stocks: d.top7, gated: false },
    { key: 'gainers', title: titles.gainers, accent: '#22c55e', href: `/global/${locale}/gainers`, stocks: d.gainers, gated: requireAuthToOpen },
    { key: 'losers', title: titles.losers, accent: '#ef4444', href: `/global/${locale}/losers`, stocks: d.losers, gated: requireAuthToOpen },
    { key: 'mostActive', title: titles.mostActive, accent: '#3b82f6', href: `/global/${locale}/mostactive`, stocks: d.mostActive, gated: requireAuthToOpen },
    { key: 'top100', title: titles.top100, accent: '#f59e0b', href: `/global/${locale}/top100`, stocks: d.top100, gated: requireAuthToOpen },
  ];

  return (
    <div
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
      <div className={CARD_WIDTH}>
        <TrendCandidatesSlot locale={locale} compactMode />
      </div>
    </div>
  );
}
