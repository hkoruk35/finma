'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n/copy';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import HomeListCard, { type HomeListStock } from './HomeListCard';

const ACCENT = '#a78bfa';

interface LiveWatchRow {
  ticker: string;
  sector?: string;
  price?: { current: number; change_pct: number };
  tracker_1h?: { change_pct_1d: number };
  recent_closes?: number[];
}

function getLabels(locale: Locale) {
  if (locale === 'tr') return { title: 'İzleme Listem', empty: 'Bu liste boş', addHint: 'Hisse ekle' };
  if (locale === 'pt') return { title: 'Minha Lista', empty: 'Esta lista está vazia', addHint: 'Adicionar ação' };
  if (locale === 'es') return { title: 'Mi Lista', empty: 'Esta lista está vacía', addHint: 'Agregar acción' };
  if (locale === 'fr') return { title: 'Ma Liste', empty: 'Cette liste est vide', addHint: 'Ajouter une action' };
  return { title: 'Watchlist', empty: 'This list is empty', addHint: 'Add stock' };
}

/**
 * Sağ sütunun üst kartı — kişisel takip listesi. CustomWatchlistTracker.tsx
 * ile AYNI veri kaynağını kullanır (giriş yapmışsa /api/watchlist/custom,
 * misafirse localStorage "boga_guest_watchlist"), ama kasıtlı olarak
 * HomeWatchlistSlot'un otomatik 5-hisse tohumlama/Top7-fallback davranışını
 * TEKRARLAMAZ — burada gerçekten boşsa boş durumu ("+" ile ekle) gösterilir,
 * yoksa bu kart ortadaki Top7 kartıyla aynı içeriği tekrarlamış olurdu.
 */
export default function HomePersonalWatchlistCard({ locale }: { locale: Locale }) {
  const { plan, loading: planLoading } = useMemberPlan();
  const isLoggedIn = plan !== null;
  const [stocks, setStocks] = useState<HomeListStock[] | null>(null);
  const labels = getLabels(locale);
  const viewAllHref = `/global/${locale}/my-watchlist`;

  useEffect(() => {
    if (planLoading) return;
    let active = true;

    async function load() {
      let tickers: string[] = [];
      if (isLoggedIn) {
        try {
          const r = await fetch('/api/watchlist/custom', { cache: 'no-store' });
          if (r.ok) tickers = (await r.json()).tickers ?? [];
        } catch {}
      } else if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('boga_guest_watchlist');
          if (raw) tickers = JSON.parse(raw) ?? [];
        } catch {}
      }

      if (!active) return;
      if (!Array.isArray(tickers) || tickers.length === 0) {
        setStocks([]);
        return;
      }

      const top = tickers.slice(0, 7);
      try {
        const r = await fetch(`/api/watchlist-data?tickers=${top.join(',')}`);
        const rows = r.ok ? await r.json() : [];
        if (!active) return;
        const map: Record<string, LiveWatchRow> = {};
        (rows as LiveWatchRow[]).forEach((row) => { if (row?.ticker) map[row.ticker] = row; });
        setStocks(
          top.map((ticker) => {
            const d = map[ticker];
            return {
              ticker,
              sector: d?.sector && d.sector !== 'Unknown' ? d.sector : 'Technology',
              price: d?.price?.current ?? 0,
              change_pct: d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0,
              sparkline: d?.recent_closes ?? [],
            };
          })
        );
      } catch {
        if (active) setStocks([]);
      }
    }

    load();
    return () => { active = false; };
  }, [isLoggedIn, planLoading]);

  if (stocks === null) {
    return <HomeListCard title={labels.title} accent={ACCENT} viewAllHref={viewAllHref} stocks={[]} locale={locale} loading />;
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e2a3a]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: ACCENT }} />
            <h3 className="text-xs font-medium text-white uppercase tracking-tight truncate">{labels.title}</h3>
          </div>
          <Link
            href={viewAllHref}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1e293b] border border-[#a78bfa]/30 text-[#a78bfa] hover:bg-white/5 transition-colors shrink-0"
            aria-label={labels.addHint}
            title={labels.addHint}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </Link>
        </div>
        <div className="px-3 py-6 text-center">
          <p className="text-xs text-white/50">{labels.empty}</p>
        </div>
      </div>
    );
  }

  return <HomeListCard title={labels.title} accent={ACCENT} viewAllHref={viewAllHref} stocks={stocks} locale={locale} />;
}
