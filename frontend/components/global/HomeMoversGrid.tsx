'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/copy';
import HomeListCard, { type HomeListStock } from './HomeListCard';

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

/**
 * Top7/Top100/Gainers/Losers/MostActive kartlarının tek veri kaynağı
 * /api/home-movers'tır (tier-farkındalı maskeleme orada, per-request
 * yapılır — bkz. o route'un yorumu). Bu yüzden bu bileşen client-side
 * kendi fetch'ini yapar; home/page.tsx'in ISR'lı sunucu bileşeninden
 * veri almaz.
 */
export default function HomeMoversGrid({ locale }: { locale: Locale }) {
  const [data, setData] = useState<MoversResponse | null>(null);
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <HomeListCard title={titles.top7} accent="#a78bfa" viewAllHref={`/global/${locale}/top7`} stocks={d.top7} locale={locale} loading={loading} />
      <HomeListCard title={titles.gainers} accent="#22c55e" viewAllHref={`/global/${locale}/gainers`} stocks={d.gainers} locale={locale} loading={loading} />
      <HomeListCard title={titles.losers} accent="#ef4444" viewAllHref={`/global/${locale}/losers`} stocks={d.losers} locale={locale} loading={loading} />
      <HomeListCard title={titles.mostActive} accent="#3b82f6" viewAllHref={`/global/${locale}/mostactive`} stocks={d.mostActive} locale={locale} loading={loading} />
      <HomeListCard title={titles.top100} accent="#f59e0b" viewAllHref={`/global/${locale}/top100`} stocks={d.top100} locale={locale} loading={loading} />
    </div>
  );
}
