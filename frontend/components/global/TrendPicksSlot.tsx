'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { TrendStatus } from '@/lib/homeFeed';
import { copy, type Locale } from '@/lib/i18n/copy';
import Sparkline from './Sparkline';
import TickerHoverChart from '../TickerHoverChart';
import { STATUS_STYLE, statusLabel } from './HomeWatchlistSlot';

interface Stock {
  ticker: string;
  sector: string;
  status: TrendStatus;
  price: number;
  change_pct: number;
}

interface SwingPickRaw {
  ticker: string;
  company?: string;
  sector?: string;
  current_price?: number;
}

interface LiveWatchData {
  ticker: string;
  sector?: string;
  price?: { current: number; change_pct: number };
  tracker_1h?: { signal: string; change_pct_1d: number };
}

const ACCENT = '#f59e0b';

function getLabels(locale: Locale) {
  if (locale === 'tr') return {
    title: 'Trend Hisseleri',
    all: 'TÜMÜ',
    stock: 'HİSSE / SEKTÖR',
    status: 'DURUM',
    price: 'FİYAT',
    empty: 'Bugün için trend hisse bulunmuyor',
    loading: 'Yükleniyor...',
    href: '/global/tr/swing',
  };
  if (locale === 'pt') return {
    title: 'Ações em Tendência',
    all: 'TODOS',
    stock: 'AÇÃO / SETOR',
    status: 'STATUS',
    price: 'PREÇO',
    empty: 'Nenhuma ação em tendência hoje',
    loading: 'Carregando...',
    href: '/global/pt/swing',
  };
  if (locale === 'es') return {
    title: 'Acciones en Tendencia',
    all: 'TODO',
    stock: 'ACCIÓN / SECTOR',
    status: 'ESTADO',
    price: 'PRECIO',
    empty: 'No hay acciones en tendencia hoy',
    loading: 'Cargando...',
    href: '/global/es/swing',
  };
  if (locale === 'fr') return {
    title: 'Actions Tendance',
    all: 'TOUT',
    stock: 'ACTION / SECTEUR',
    status: 'STATUT',
    price: 'PRIX',
    empty: "Aucune action tendance aujourd'hui",
    loading: 'Chargement...',
    href: '/global/fr/swing',
  };
  return {
    title: 'Trending Stocks',
    all: 'ALL',
    stock: 'STOCK / SECTOR',
    status: 'STATUS',
    price: 'PRICE',
    empty: 'No trending stocks today',
    loading: 'Loading...',
    href: '/global/en/swing',
  };
}

interface Props {
  locale: Locale;
  compactMode?: boolean;
  disableHoverChart?: boolean;
  onTickerSelect?: (ticker: string) => void;
}

export default function TrendPicksSlot({ locale, compactMode, disableHoverChart, onTickerSelect }: Props) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sectorNames = copy[locale].top100.sectors as Record<string, string>;
  const gridCols = compactMode ? 'grid-cols-[1fr_48px_64px]' : 'grid-cols-[1fr_56px_64px_72px]';
  const labels = getLabels(locale);

  useEffect(() => {
    let active = true;

    fetch('/api/swing-picks?min=10', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { picks: [] })
      .then(async (data) => {
        const picks: SwingPickRaw[] = data.picks ?? [];
        if (!active) return;
        if (picks.length === 0) {
          setStocks([]);
          return;
        }

        const tickers = picks.map(p => p.ticker).join(',');
        const liveRows: LiveWatchData[] = await fetch(`/api/watchlist-data?tickers=${tickers}`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => []);
        if (!active) return;

        const liveMap: Record<string, LiveWatchData> = {};
        liveRows.forEach(item => { if (item?.ticker) liveMap[item.ticker] = item; });

        const mapped: Stock[] = picks.map(p => {
          const d = liveMap[p.ticker];
          const signal = d?.tracker_1h?.signal;
          const status: TrendStatus = signal === 'BUY' ? 'BULLISH' : signal === 'SELL' ? 'BEARISH' : 'NEUTRAL';
          return {
            ticker: p.ticker,
            sector: d?.sector ?? p.sector ?? '',
            status,
            price: d?.price?.current ?? p.current_price ?? 0,
            change_pct: d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0,
          };
        });
        setStocks(mapped);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });

    return () => { active = false; };
  }, []);

  return (
    <div className="bg-gradient-to-br from-[#0a1428] to-[#050b14] border-2 border-[#1e2a3a]/60 rounded-2xl overflow-hidden flex flex-col h-full w-full snap-center flex-shrink-0 md:min-w-0 md:flex-shrink md:w-auto md:snap-align-none shadow-[0_0_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-6 rounded-full" style={{ background: ACCENT }} />
          <h3 className="text-sm font-black text-white uppercase tracking-tight">{labels.title}</h3>
        </div>
        <Link
          href={labels.href}
          className="inline-flex items-center gap-1 px-3 py-1 bg-[#1e293b] border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/5"
          style={{ color: ACCENT, borderColor: `${ACCENT}4d` }}
        >
          {labels.all}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
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
                  className={`grid ${gridCols} gap-2 items-center px-5 py-3.5 transition-colors duration-150 group hover:bg-white/[0.03] ${onTickerSelect ? 'cursor-pointer' : ''}`}
                  onClick={onTickerSelect ? () => onTickerSelect(stock.ticker) : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-white/50 w-3">{idx + 1}</span>
                    <div className="min-w-0">
                      {disableHoverChart ? (
                        <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                      ) : (
                        <TickerHoverChart ticker={stock.ticker}>
                          <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                        </TickerHoverChart>
                      )}
                      <div className="text-[11px] text-white/70 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                    </div>
                  </div>

                  <div className="justify-self-center">
                    <Sparkline data={[]} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} />
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
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-xs text-white/60">{loaded ? labels.empty : labels.loading}</p>
        </div>
      )}
    </div>
  );
}
