'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/copy';
import HomeListCard, { type HomeListStock } from '@/components/global/HomeListCard';

export type MoverMode = 'gainers' | 'losers' | 'mostActive';

const ACCENT: Record<MoverMode, string> = {
  gainers: '#22c55e',
  losers: '#ef4444',
  mostActive: '#3b82f6',
};

function getTitle(mode: MoverMode, locale: Locale) {
  const titles: Record<Locale, Record<MoverMode, string>> = {
    tr: { gainers: 'En Çok Artanlar', losers: 'En Çok Düşenler', mostActive: 'En Çok İşlem Görenler' },
    en: { gainers: 'Top Gainers', losers: 'Top Losers', mostActive: 'Most Active' },
    es: { gainers: 'Mayores Alzas', losers: 'Mayores Bajas', mostActive: 'Más Negociadas' },
    fr: { gainers: 'Plus Fortes Hausses', losers: 'Plus Fortes Baisses', mostActive: 'Plus Échangées' },
    pt: { gainers: 'Maiores Altas', losers: 'Maiores Baixas', mostActive: 'Mais Negociadas' },
  };
  return titles[locale][mode];
}

/**
 * /global/{locale}/gainers|losers|mostactive sayfalarının içeriği. Aynı
 * /api/home-movers kaynağını (tier-farkındalı maskeleme dahil) home
 * sayfasındaki HomeMoversGrid ile paylaşır — burada sadece limit=10 ve
 * tek bir mod render edilir. Top100/Top7'nin kendi sayfaları zaten var
 * (/top100, /top7); bu üçü o setin eksik parçalarıydı.
 */
export default function MoverPageTracker({ mode, locale }: { mode: MoverMode; locale: Locale }) {
  const [stocks, setStocks] = useState<HomeListStock[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/home-movers?limit=10', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setStocks(d ? d[mode] ?? [] : []); })
      .catch(() => { if (active) setStocks([]); });
    return () => { active = false; };
  }, [mode]);

  return (
    <HomeListCard
      title={getTitle(mode, locale)}
      accent={ACCENT[mode]}
      stocks={stocks ?? []}
      locale={locale}
      loading={stocks === null}
    />
  );
}
