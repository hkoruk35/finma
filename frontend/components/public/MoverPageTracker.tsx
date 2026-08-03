'use client';

import type { Locale } from '@/lib/i18n/copy';
import Top7Tracker from './Top7Tracker';

export type MoverMode = 'gainers' | 'losers' | 'mostActive';

/**
 * /global/{locale}/gainers|losers|mostactive sayfalarının içeriği.
 * Top7Tracker'ın aynı tam-teknik tablo (EMA/RSI/hacim/sinyal/hover-chart/
 * heatmap) yapısını mode prop'uyla paylaşır; ticker kimliği
 * /api/home-movers'tan gelir (çözümleme Top7Tracker içinde). Önceki kompakt
 * HomeListCard görünümünün yerini aldı — 2026-08-03, kullanıcı /top7 ile
 * aynı tablo yapısını talep etti.
 */
export default function MoverPageTracker({ mode, locale }: { mode: MoverMode; locale: Locale }) {
  return <Top7Tracker locale={locale} mode={mode} />;
}
