'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TrendStatus } from '@/lib/homeFeed';
import { copy, type Locale } from '@/lib/i18n/copy';
import TickerHoverChart from '../TickerHoverChart';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import PremiumModal from './PremiumModal';
import CompareCheckbox from './CompareCheckbox';
import Sparkline from './Sparkline';
import { formatNumber } from "@/lib/formatNumber";

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
  recent_closes?: number[];
}

export const STATUS_STYLE: Record<TrendStatus, { color: string; tr: string; en: string; pt: string; es: string; fr: string }> = {
  BULLISH: { color: '#22c55e', tr: 'YÜKSELİŞ', en: 'BULLISH', pt: 'ALTA', es: 'ALCISTA', fr: 'HAUSSIER' },
  BEARISH: { color: '#ef4444', tr: 'DÜŞÜŞ', en: 'BEARISH', pt: 'BAIXA', es: 'BAJISTA', fr: 'BAISSIER' },
  NEUTRAL: { color: '#f59e0b', tr: 'NÖTR', en: 'NEUTRAL', pt: 'NEUTRO', es: 'NEUTRO', fr: 'NEUTRE' },
};

export function statusLabel(status: TrendStatus, locale: Locale) {
  const s = STATUS_STYLE[status];
  if (!s) return 'NEUTRAL';
  if (locale === 'tr') return s.tr;
  if (locale === 'pt') return s.pt;
  if (locale === 'es') return s.es;
  if (locale === 'fr') return s.fr;
  return s.en;
}

const ACCENT_PERSONAL = '#a78bfa';
const MIN_TICKERS_FOR_HOME = 5;

function getLabels(locale: Locale) {
  if (locale === 'tr') return {
    title: 'İzleme Listem',
    all: 'TÜMÜ',
    stock: 'HİSSE / SEKTÖR',
    status: 'DURUM',
    price: 'FİYAT',
    sortLabel: 'Kişisel takip listeniz',
    href: '/global/tr/my-watchlist',
    customizeTooltip: "Premium'da Özelleştir",
  };
  if (locale === 'pt') return {
    title: 'Minha Lista',
    all: 'TODOS',
    stock: 'AÇÃO / SETOR',
    status: 'STATUS',
    price: 'PREÇO',
    sortLabel: 'Sua lista pessoal',
    href: '/global/pt/my-watchlist',
    customizeTooltip: 'Personalize com Premium',
  };
  if (locale === 'es') return {
    title: 'Mi Lista',
    all: 'TODO',
    stock: 'ACCIÓN / SECTOR',
    status: 'ESTADO',
    price: 'PRECIO',
    sortLabel: 'Tu lista de seguimiento personal',
    href: '/global/es/my-watchlist',
    customizeTooltip: 'Personaliza con Premium',
  };
  if (locale === 'fr') return {
    title: 'Ma Liste',
    all: 'TOUT',
    stock: 'ACTION / SECTEUR',
    status: 'STATUT',
    price: 'PRIX',
    sortLabel: 'Votre liste de surveillance personnelle',
    href: '/global/fr/my-watchlist',
    customizeTooltip: 'Personnalisez avec Premium',
  };
  return {
    title: 'My Watchlist',
    all: 'ALL',
    stock: 'STOCK / SECTOR',
    status: 'STATUS',
    price: 'PRICE',
    sortLabel: 'Your personal watchlist',
    href: '/global/en/my-watchlist',
    customizeTooltip: 'Customize with Premium',
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
  selectable?: boolean;
  selectedTickers?: string[];
  onToggleSelect?: (ticker: string) => void;
}

export default function HomeWatchlistSlot({ locale, defaultStocks, defaultViewAllHref, defaultSortLabel, compactMode, disableHoverChart, onTickerSelect, selectable, selectedTickers, onToggleSelect }: Props) {
  const router = useRouter();
  const [personalTickers, setPersonalTickers] = useState<string[]>([]);
  const [liveData, setLiveData] = useState<Record<string, LiveWatchData>>({});
  const [loaded, setLoaded] = useState(false);
  const { isPremium } = useMemberPlan();
  const [showModal, setShowModal] = useState(false);
  const sectorNames = copy[locale].top100.sectors as Record<string, string>;
  const labels = getLabels(locale);

  useEffect(() => {
    fetch('/api/watchlist/custom', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { tickers: [] })
      .then(data => {
        const tickers: string[] = data.tickers || [];
        setPersonalTickers(tickers);
        if (tickers.length >= MIN_TICKERS_FOR_HOME) {
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

  const usePersonal = loaded && personalTickers.length >= MIN_TICKERS_FOR_HOME;

  const top5Personal = personalTickers.slice(0, 5).map(ticker => {
    const d = liveData[ticker];
    const changePct = d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0;
    const signal = d?.tracker_1h?.signal;
    const emaStatus = d?.tracker_1h?.ema_status;
    let status: TrendStatus = 'NEUTRAL';
    if (signal === 'STRONG' || emaStatus === 'Bullish' || emaStatus === 'Yükseliş') status = 'BULLISH';
    else if (signal === 'WEAK' || emaStatus === 'Bearish' || emaStatus === 'Düşüş') status = 'BEARISH';
    return {
      ticker,
      sector: d?.sector && d.sector !== 'Unknown' ? d.sector : 'Technology',
      status,
      price: d?.price?.current ?? 0,
      change_pct: changePct,
      sparkline: d?.recent_closes ?? [],
    } as Stock;
  });

  const stocks = usePersonal ? top5Personal : defaultStocks;
  const title = usePersonal
    ? labels.title
    : locale === 'tr' ? 'Top 7'
    : locale === 'pt' ? 'Top 7'
    : locale === 'es' ? 'Top 7'
    : locale === 'fr' ? 'Top 7'
    : 'Top 7';
  const { plan } = useMemberPlan();
  let viewAllHref = defaultViewAllHref || `/global/${locale}/top7`;
  if (usePersonal) {
    viewAllHref = labels.href;
  }
  const sortLabel = usePersonal ? labels.sortLabel : defaultSortLabel;
  const accent = ACCENT_PERSONAL;

  return (
    <>
      {showModal && <PremiumModal locale={locale} onClose={() => setShowModal(false)} />}

      <div className={`bg-[#0a0e17] border border-[#1e2a3a]/60 ${compactMode ? 'rounded-xl' : 'rounded-2xl'} overflow-hidden flex flex-col h-full w-full snap-center flex-shrink-0 md:min-w-0 md:flex-shrink md:w-auto md:snap-align-none shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${compactMode ? 'px-3 py-2.5' : 'px-5 py-4'} border-b border-[#1e2a3a]`}>
          <div className="flex items-center gap-2 relative group cursor-default min-w-0">
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: accent }} />
            <div className="min-w-0">
              <h3 className={`${compactMode ? 'text-xs' : 'text-sm'} font-medium text-white uppercase tracking-tight truncate`}>{title}</h3>
              {usePersonal && (
                <span className="text-[9px] font-medium text-[#a78bfa] uppercase tracking-wider opacity-70 block truncate">
                  {locale === 'tr' ? '★ Kişisel' : locale === 'pt' ? '★ Pessoal' : locale === 'es' ? '★ Personal' : locale === 'fr' ? '★ Personnelle' : '★ Personal'}
                </span>
              )}
            </div>
            {compactMode && (
              <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-20 hidden group-hover:block whitespace-nowrap rounded-md bg-[#1e293b] border border-[#a78bfa]/40 px-2 py-1 text-[10px] font-medium text-[#a78bfa] shadow-lg">
                {labels.customizeTooltip}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={viewAllHref}
              className={`inline-flex items-center gap-1 ${compactMode ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'} bg-[#1e293b] border rounded-full font-medium uppercase tracking-wider transition-all duration-200 hover:bg-white/5`}
              style={{ color: accent, borderColor: `${accent}4d` }}
            >
              {locale === 'tr' ? 'TÜMÜ' : locale === 'pt' ? 'TODOS' : locale === 'es' ? 'TODO' : locale === 'fr' ? 'TOUT' : 'ALL'}
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        {stocks.length > 0 ? (
          <>
            {/* Column labels */}
            <div className={`grid ${compactMode ? 'grid-cols-[1fr_40px_60px]' : 'grid-cols-[1fr_56px_72px]'} gap-2 ${compactMode ? 'px-3 py-1.5 text-[9px]' : 'px-5 py-2 text-[11px]'} border-b border-[#1e2a3a] font-medium uppercase tracking-[0.5px] text-slate-500`}>
              <div className="flex items-center gap-2">
                {selectable && <span className="w-3.5 shrink-0" />}
                <span>{labels.stock}</span>
              </div>
              <span />
              <span className="text-right">{labels.price}</span>
            </div>

            {/* Rows */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1e2a3a]/70">
              {stocks.map((stock, idx) => {
                const isRowLocked = usePersonal && !isPremium && idx > 0;
                const handleClick = () => {
                  if (onTickerSelect) {
                    onTickerSelect(stock.ticker);
                  } else if (isRowLocked) {
                    setShowModal(true);
                  } else {
                    router.push(`/global/${locale}/graphic/${stock.ticker}`);
                  }
                };
                return (
                  <div
                    key={stock.ticker}
                    className={`grid ${compactMode ? 'grid-cols-[1fr_40px_60px]' : 'grid-cols-[1fr_56px_72px]'} gap-2 items-center ${compactMode ? 'px-3 py-2' : 'px-5 py-3.5'} transition-colors duration-150 group hover:bg-white/[0.03] cursor-pointer`}
                    onClick={handleClick}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectable && (
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <CompareCheckbox
                            checked={!!selectedTickers?.includes(stock.ticker)}
                            onToggle={() => onToggleSelect?.(stock.ticker)}
                          />
                        </div>
                      )}
                      <span className="text-[10px] font-mono font-medium text-slate-500 w-3 shrink-0">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        {isRowLocked ? (
                          <>
                            <div className="font-medium text-sm tracking-tight select-none flex items-center gap-1" style={{ color: "#f59e0b" }}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                              <span style={{ fontSize: 11, fontWeight: 700 }}>Premium</span>
                            </div>
                            <div className="text-[12px] text-slate-500 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        ) : disableHoverChart ? (
                          <>
                            <div className="text-[15px] font-medium text-white truncate">{stock.ticker}</div>
                            <div className="text-[12px] text-slate-500 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        ) : (
                          <>
                            <TickerHoverChart ticker={stock.ticker}>
                              <div className="text-[15px] font-medium text-white truncate">{stock.ticker}</div>
                            </TickerHoverChart>
                            <div className="text-[12px] text-slate-500 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="justify-self-center">
                      {/* Mobile */}
                      <div className="md:hidden">
                        <Sparkline data={stock.sparkline} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} width={32} height={16} />
                      </div>
                      {/* Desktop */}
                      <div className="hidden md:block">
                        <Sparkline data={stock.sparkline} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} width={56} height={22} />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-medium text-white/90">
                        {stock.price > 0 ? `$${formatNumber(stock.price, 2, locale)}` : '—'}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-[1px] rounded text-[9px] font-medium font-mono ${
                          stock.change_pct >= 0
                            ? 'bg-[#22c55e] text-white'
                            : 'bg-[#ef4444] text-white'
                        }`}
                      >
                        {stock.change_pct >= 0 ? '+' : ''}{formatNumber(stock.change_pct, 2, locale)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sort label footer */}
            {sortLabel && (
              <div className={`px-5 py-2 border-t border-[#1e2a3a] text-[9px] text-white/60 italic`}>
                {sortLabel}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-xs text-white/60">{locale === 'tr' ? 'Veri bulunmamaktadır' : locale === 'pt' ? 'Nenhum dado disponível' : 'No data available'}</p>
          </div>
        )}
      </div>
    </>
  );
}
