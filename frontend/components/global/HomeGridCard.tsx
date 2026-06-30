'use client';

import Link from 'next/link';
import type { TrendStatus } from '@/lib/homeFeed';
import Sparkline from './Sparkline';

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
  subtitle?: string;
  accent: string;
  stocks: Stock[];
  viewAllHref: string;
  locale: 'tr' | 'en';
  sortLabel?: string;
}

const STATUS_STYLE: Record<TrendStatus, { color: string; tr: string; en: string }> = {
  BULLISH: { color: '#22c55e', tr: 'YÜKSELİŞ', en: 'BULLISH' },
  BEARISH: { color: '#ef4444', tr: 'DÜŞÜŞ', en: 'BEARISH' },
  NEUTRAL: { color: '#f59e0b', tr: 'NÖTR', en: 'NEUTRAL' },
};

const ROW_COLS = 'grid-cols-[1fr_56px_64px_72px]';

export default function HomeSimpleCard({
  title,
  subtitle,
  accent,
  stocks,
  viewAllHref,
  locale,
  sortLabel,
}: HomeSimpleCardProps) {
  const emptyMessage = locale === 'tr' ? 'Veri bulunmamaktadır' : 'No data available';
  const allLabel = locale === 'tr' ? 'TÜMÜ' : 'ALL';

  return (
    <div className="glass-card border-2 border-[#1e2a3a]/50 rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1e2a3a]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 rounded-full" style={{ background: accent }} />
            <h3 className="text-sm font-black text-white uppercase tracking-tight">{title}</h3>
          </div>
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#1e293b] border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/5"
            style={{ color: accent, borderColor: `${accent}4d` }}
          >
            {allLabel}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
        {subtitle && <p className="text-xs text-white/50 ml-4">{subtitle}</p>}
      </div>

      {stocks.length > 0 ? (
        <>
          {/* Column labels */}
          <div className={`grid ${ROW_COLS} gap-2 px-5 py-2 border-b border-[#1e2a3a] text-[9px] font-bold uppercase tracking-wider text-white/30`}>
            <span>{locale === 'tr' ? 'HİSSE / SEKTÖR' : 'STOCK / SECTOR'}</span>
            <span />
            <span className="text-center">{locale === 'tr' ? 'DURUM' : 'STATUS'}</span>
            <span className="text-right">{locale === 'tr' ? 'FİYAT' : 'PRICE'}</span>
          </div>

          {/* Rows */}
          <div className="flex-1 divide-y divide-[#1e2a3a]/70 bg-[#0a0e17]/30">
            {stocks.map((stock, idx) => {
              const statusStyle = STATUS_STYLE[stock.status];
              const statusLabel = locale === 'tr' ? statusStyle.tr : statusStyle.en;
              return (
                <Link
                  key={stock.ticker}
                  href={locale === 'tr' ? `/global/tr/${stock.ticker}` : `/global/en/${stock.ticker}`}
                  className={`grid ${ROW_COLS} gap-2 items-center px-5 py-3.5 hover:bg-white/[0.04] transition-colors duration-150 group`}
                  style={{ '--accent': accent } as React.CSSProperties}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-white/25 w-3">{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="font-black text-white text-sm tracking-tight transition-colors group-hover:text-[var(--accent)]">
                        {stock.ticker}
                      </div>
                      <div className="text-[11px] text-white/40 truncate">{stock.sector || '—'}</div>
                    </div>
                  </div>

                  <div className="justify-self-center">
                    <Sparkline data={stock.sparkline} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} />
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
                </Link>
              );
            })}
          </div>

          {/* Sort label footer */}
          {sortLabel && (
            <div className="px-5 py-2 border-t border-[#1e2a3a] text-[9px] text-white/40 italic">
              {sortLabel}
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-xs text-white/40">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
