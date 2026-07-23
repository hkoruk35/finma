'use client';

import { useState } from "react";
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

interface HomeSimpleCardProps {
  title: string;
  accent: string;
  stocks: Stock[];
  viewAllHref: string;
  locale: Locale;
  sortLabel?: string;
  /** When true, ticker names and "view all" link are locked behind premium */
  requirePremium?: boolean;
}

const STATUS_STYLE: Record<TrendStatus, { color: string; tr: string; en: string; pt: string }> = {
  BULLISH: { color: '#22c55e', tr: 'YÜKSELİŞ', en: 'BULLISH', pt: 'ALTA' },
  BEARISH: { color: '#ef4444', tr: 'DÜŞÜŞ', en: 'BEARISH', pt: 'BAIXA' },
  NEUTRAL: { color: '#f59e0b', tr: 'NÖTR', en: 'NEUTRAL', pt: 'NEUTRO' },
};

const ROW_COLS = 'grid-cols-[1fr_56px_64px_72px]';

export default function HomeSimpleCard({
  title,
  accent,
  stocks,
  viewAllHref,
  locale,
  sortLabel,
  requirePremium = false,
}: HomeSimpleCardProps) {
  const emptyMessage = locale === 'tr' ? 'Veri bulunmamaktadır' : locale === 'pt' ? 'Nenhum dado disponível' : 'No data available';
  const allLabel = locale === 'tr' ? 'TÜMÜ' : locale === 'pt' ? 'TODOS' : 'ALL';
  const sectorNames = copy[locale].top100.sectors as Record<string, string>;
  const sectorLabel = (sector: string) => (sector ? sectorNames[sector] ?? sector : '—');

  const { isPremium } = useMemberPlan();
  const locked = requirePremium && !isPremium;
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {showModal && <PremiumModal locale={locale} onClose={() => setShowModal(false)} />}

      <div className="bg-gradient-to-br from-[#0a1428] to-[#050b14] border-2 border-[#1e2a3a]/60 rounded-2xl overflow-hidden flex flex-col h-full w-full snap-center flex-shrink-0 md:min-w-0 md:flex-shrink md:w-auto md:snap-align-none shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a]">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 rounded-full" style={{ background: accent }} />
            <h3 className="text-sm font-black text-white uppercase tracking-tight">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton locale={locale} shareText={`${title} — BOGA AI`} url={`https://bogastock.com${viewAllHref}`} accent={accent} />
            <a
              href={viewAllHref}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#1e293b] border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/5"
              style={{ color: accent, borderColor: `${accent}4d` }}
            >
              {allLabel}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>

        {stocks.length > 0 ? (
          <>
            {/* Column labels */}
            <div className={`grid ${ROW_COLS} gap-2 px-5 py-2 border-b border-[#1e2a3a] text-[9px] font-bold uppercase tracking-wider text-white/60`}>
              <span>{locale === 'tr' ? 'HİSSE / SEKTÖR' : locale === 'pt' ? 'AÇÃO / SETOR' : 'STOCK / SECTOR'}</span>
              <span />
              <span className="text-center">{locale === 'tr' ? 'DURUM' : locale === 'pt' ? 'STATUS' : 'STATUS'}</span>
              <span className="text-right">{locale === 'tr' ? 'FİYAT' : locale === 'pt' ? 'PREÇO' : 'PRICE'}</span>
            </div>

            {/* Rows */}
            <div className="flex-1 divide-y divide-[#1e2a3a]/70">
              {stocks.map((stock, idx) => {
                const statusStyle = STATUS_STYLE[stock.status];
                const statusLabel = locale === 'tr' ? statusStyle.tr : locale === 'pt' ? statusStyle.pt : statusStyle.en;
                const isRowLocked = requirePremium && !isPremium && idx > 0;
                const handleRowClick = () => {
                  if (isRowLocked) {
                    window.location.href = viewAllHref;
                  } else {
                    window.location.href = `/global/${locale}/graphic/${stock.ticker}`;
                  }
                };
                return (
                  <div
                    key={stock.ticker}
                    className="grid grid-cols-[1fr_56px_64px_72px] gap-2 items-center px-5 py-3.5 transition-colors duration-150 group cursor-pointer hover:bg-white/[0.03]"
                    style={{ '--accent': accent } as React.CSSProperties}
                    onClick={handleRowClick}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-white/50 w-3">{idx + 1}</span>
                      <div className="min-w-0">
                        {isRowLocked ? (
                          <>
                            <div className="font-black text-sm tracking-tight select-none flex items-center gap-1" style={{ color: "#f59e0b" }}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                              <span style={{ fontSize: 11, fontWeight: 700 }}>Premium</span>
                            </div>
                            <div className="text-[11px] text-white/70 truncate">{sectorLabel(stock.sector)}</div>
                          </>
                        ) : (
                          <>
                            <TickerHoverChart ticker={stock.ticker}>
                              <div className="font-black text-white text-sm tracking-tight">
                                {stock.ticker}
                              </div>
                            </TickerHoverChart>
                            <div className="text-[11px] text-white/70 truncate">{sectorLabel(stock.sector)}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="justify-self-center">
                      <Sparkline data={stock.sparkline} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} />
                    </div>

                    <span
                      className="justify-self-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap"
                      style={{ background: `${statusStyle.color}26`, color: statusStyle.color }}
                    >
                      {statusLabel}
                    </span>

                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-white/90">${stock.price.toFixed(2)}</div>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-[1px] rounded text-[10px] font-bold font-mono ${
                          stock.change_pct >= 0
                            ? 'bg-[#22c55e]/15 text-[#22c55e]'
                            : 'bg-[#ef4444]/15 text-[#ef4444]'
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
                {sortLabel}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-xs text-white/60">{emptyMessage}</p>
          </div>
        )}
      </div>
    </>
  );
}
