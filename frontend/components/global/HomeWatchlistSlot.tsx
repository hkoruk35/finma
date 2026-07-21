'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { TrendStatus } from '@/lib/homeFeed';
import { copy, type Locale } from '@/lib/i18n/copy';
import Sparkline from './Sparkline';
import TickerHoverChart from '../TickerHoverChart';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import PremiumModal from './PremiumModal';
import ShareButton from '../ShareButton';

interface Stock {
  ticker: string;
  sector: string;
  status: TrendStatus;
  price: number;
  change_pct: number;
  sparkline: number[];
}

interface LiveWatchData {
  ticker: string;
  sector?: string;
  price?: { current: number; prev_close: number; change_pct: number; volume?: number };
  tracker_1h?: { ema_status: string; rsi: number; signal: string; change_pct_1d: number; };
}

export const STATUS_STYLE: Record<TrendStatus, { color: string; tr: string; en: string; pt: string; es: string; fr: string }> = {
  BULLISH: { color: '#22c55e', tr: 'YÜKSELİŞ', en: 'BULLISH', pt: 'ALTA', es: 'ALCISTA', fr: 'HAUSSIER' },
  BEARISH: { color: '#ef4444', tr: 'DÜŞÜŞ', en: 'BEARISH', pt: 'BAIXA', es: 'BAJISTA', fr: 'BAISSIER' },
  NEUTRAL: { color: '#f59e0b', tr: 'NÖTR', en: 'NEUTRAL', pt: 'NEUTRO', es: 'NEUTRO', fr: 'NEUTRE' },
};

const ACCENT_PERSONAL = '#a78bfa';
const MIN_TICKERS_FOR_HOME = 5;

export function statusLabel(status: TrendStatus, locale: Locale) {
  const s = STATUS_STYLE[status];
  if (locale === 'tr') return s.tr;
  if (locale === 'pt') return s.pt;
  if (locale === 'es') return s.es;
  if (locale === 'fr') return s.fr;
  return s.en;
}

function getLabels(locale: Locale) {
  if (locale === 'tr') return {
    title: 'İzleme Listem',
    all: 'TÜMÜ',
    stock: 'HİSSE / SEKTÖR',
    status: 'DURUM',
    price: 'FİYAT',
    sortLabel: 'Kişisel takip listeniz',
    href: '/global/tr/my-watchlist',
  };
  if (locale === 'pt') return {
    title: 'Minha Lista',
    all: 'TODOS',
    stock: 'AÇÃO / SETOR',
    status: 'STATUS',
    price: 'PREÇO',
    sortLabel: 'Sua lista pessoal',
    href: '/global/pt/my-watchlist',
  };
  if (locale === 'es') return {
    title: 'Mi Lista',
    all: 'TODO',
    stock: 'ACCIÓN / SECTOR',
    status: 'ESTADO',
    price: 'PRECIO',
    sortLabel: 'Tu lista de seguimiento personal',
    href: '/global/es/my-watchlist',
  };
  if (locale === 'fr') return {
    title: 'Ma Liste',
    all: 'TOUT',
    stock: 'ACTION / SECTEUR',
    status: 'STATUT',
    price: 'PRIX',
    sortLabel: 'Votre liste de surveillance personnelle',
    href: '/global/fr/my-watchlist',
  };
  return {
    title: 'My Watchlist',
    all: 'ALL',
    stock: 'STOCK / SECTOR',
    status: 'STATUS',
    price: 'PRICE',
    sortLabel: 'Your personal watchlist',
    href: '/global/en/my-watchlist',
  };
}

interface Props {
  locale: Locale;
  defaultStocks: Stock[];
  defaultViewAllHref: string;
  defaultSortLabel?: string;
  compactMode?: boolean;
  disableHoverChart?: boolean;
  onTickerSelect?: (ticker: string) => void;
}

export default function HomeWatchlistSlot({ locale, defaultStocks, defaultViewAllHref, defaultSortLabel, compactMode, disableHoverChart, onTickerSelect }: Props) {
  const [personalTickers, setPersonalTickers] = useState<string[]>([]);
  const [liveData, setLiveData] = useState<Record<string, LiveWatchData>>({});
  const [loaded, setLoaded] = useState(false);
  const { isFreeTrial } = useMemberPlan();
  const [showModal, setShowModal] = useState(false);
  const sectorNames = copy[locale].top100.sectors as Record<string, string>;
  const gridCols = compactMode ? 'grid-cols-[1fr_48px_64px]' : 'grid-cols-[1fr_56px_64px_72px]';
  const labels = getLabels(locale);

  useEffect(() => {
    fetch('/api/watchlist/custom', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { tickers: [] })
      .then(data => {
        const tickers: string[] = data.tickers || [];
        setPersonalTickers(tickers);
        if (tickers.length >= MIN_TICKERS_FOR_HOME) {
          // Fetch live data for first 5
          const top5 = tickers.slice(0, 5);
          return fetch(`/api/watchlist-data?tickers=${top5.join(',')}`)
            .then(r => r.ok ? r.json() : [])
            .then((rows: LiveWatchData[]) => {
              const map: Record<string, LiveWatchData> = {};
              rows.forEach(item => { if (item?.ticker) map[item.ticker] = item; });
              setLiveData(map);
            });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Determine signal → status
  const signalToStatus = (signal: string | undefined): TrendStatus => {
    if (signal === 'BUY') return 'BULLISH';
    if (signal === 'SELL') return 'BEARISH';
    return 'NEUTRAL';
  };

  const usePersonal = loaded && personalTickers.length >= MIN_TICKERS_FOR_HOME;
  const locked = isFreeTrial;

  const top5Personal = personalTickers.slice(0, 5).map(ticker => {
    const d = liveData[ticker];
    const changePct = d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0;
    return {
      ticker,
      sector: d?.sector ?? '',
      status: signalToStatus(d?.tracker_1h?.signal),
      price: d?.price?.current ?? 0,
      change_pct: changePct,
      sparkline: [] as number[],
    } as Stock;
  });

  const stocks = usePersonal ? top5Personal : defaultStocks;
  const title = usePersonal ? labels.title : 'Watchlist';
  const viewAllHref = usePersonal ? labels.href : defaultViewAllHref;
  const sortLabel = usePersonal ? labels.sortLabel : defaultSortLabel;
  const accent = ACCENT_PERSONAL;

  return (
    <>
      {showModal && <PremiumModal locale={locale} onClose={() => setShowModal(false)} />}

      <div className="bg-gradient-to-br from-[#0a1428] to-[#050b14] border-2 border-[#1e2a3a]/60 rounded-2xl overflow-hidden flex flex-col h-full w-full snap-center flex-shrink-0 md:min-w-0 md:flex-shrink md:w-auto md:snap-align-none shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a]">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 rounded-full" style={{ background: accent }} />
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">{title}</h3>
              {usePersonal && (
                <span className="text-[9px] font-bold text-[#a78bfa] uppercase tracking-wider opacity-70">
                  {locale === 'tr' ? '★ Kişisel' : locale === 'pt' ? '★ Pessoal' : locale === 'es' ? '★ Personal' : locale === 'fr' ? '★ Personnelle' : '★ Personal'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#1e293b] border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/5"
              style={{ color: accent, borderColor: `${accent}4d` }}
            >
              {locale === 'tr' ? 'TÜMÜ' : locale === 'pt' ? 'TODOS' : locale === 'es' ? 'TODO' : locale === 'fr' ? 'TOUT' : 'ALL'}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        {stocks.length > 0 ? (
          <>
            {/* Column labels */}
            <div className={`grid ${gridCols} gap-2 px-5 py-2 border-b border-[#1e2a3a] text-[9px] font-bold uppercase tracking-wider text-white/60`}>
              <span>{labels.stock}</span>
              <span />
              {!compactMode && <span className="text-center">{labels.status}</span>}
              <span className="text-right">{labels.price}</span>
            </div>

            {/* Rows */}
            <div className="flex-1 divide-y divide-[#1e2a3a]/70">
              {stocks.map((stock, idx) => {
                const st = STATUS_STYLE[stock.status];
                const slabel = statusLabel(stock.status, locale);
                return (
                  <div
                    key={stock.ticker}
                    className={`grid ${gridCols} gap-2 items-center px-5 py-3.5 transition-colors duration-150 group hover:bg-white/[0.03] ${(locked || onTickerSelect) ? 'cursor-pointer' : ''}`}
                    onClick={locked ? () => setShowModal(true) : (onTickerSelect ? () => onTickerSelect(stock.ticker) : undefined)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-white/50 w-3">{idx + 1}</span>
                      <div className="min-w-0">
                        {locked ? (
                          <>
                            <div className="font-medium text-sm tracking-tight select-none flex items-center gap-1" style={{ color: '#f59e0b' }}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                              <span style={{ fontSize: 11, fontWeight: 700 }}>Premium</span>
                            </div>
                            <div className="text-[11px] text-white/70 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        ) : (
                          <>
                            {disableHoverChart ? (
                              <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                            ) : (
                              <TickerHoverChart ticker={stock.ticker}>
                                <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                              </TickerHoverChart>
                            )}
                            <div className="text-[11px] text-white/70 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="justify-self-center">
                      <Sparkline data={stock.sparkline} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} />
                    </div>

                    {!compactMode && (
                      <span
                        className="justify-self-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap"

                      style={{ background: `${st.color}26`, color: st.color }}
                    >
                      {slabel}
                    </span>
                    )}

                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-white/90">
                        {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '—'}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-[1px] rounded text-[10px] font-bold font-mono ${
                          stock.change_pct >= 0 ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'
                        }`}
                      >
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sort label footer */}
            {sortLabel && (
              <div className="px-5 py-2 border-t border-[#1e2a3a] text-[9px] text-white/60 italic">
                {usePersonal ? (
                  <Link href={labels.href} className="text-[#a78bfa] hover:underline font-bold">
                    {locale === 'tr' ? '→ Tüm takip listemin tam görünümü' : locale === 'pt' ? '→ Ver minha lista completa' : locale === 'es' ? '→ Ver mi lista completa' : locale === 'fr' ? '→ Voir ma liste complète' : '→ View my full watchlist'}
                  </Link>
                ) : (
                  sortLabel
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-xs text-white/60">
              {locale === 'tr' ? 'Veri bulunmamaktadır' : 'No data available'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
