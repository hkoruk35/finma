'use client';

import Link from 'next/link';

interface Stock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
}

interface HomeSimpleCardProps {
  title: string;
  accent: string;
  stocks: Stock[];
  viewAllHref: string;
  locale: 'tr' | 'en';
}

export default function HomeSimpleCard({
  title,
  accent,
  stocks,
  viewAllHref,
  locale,
}: HomeSimpleCardProps) {
  const emptyMessage = locale === 'tr' ? 'Veri bulunmamaktadır' : 'No data available';
  const allLabel = locale === 'tr' ? 'TÜMÜ' : 'ALL';

  return (
    <div className="glass-card border-2 border-[#1e2a3a]/50 rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a]">
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

      {/* Rows */}
      {stocks.length > 0 ? (
        <div className="flex-1 divide-y divide-[#1e2a3a]/70">
          {stocks.map((stock, idx) => (
            <Link
              key={stock.ticker}
              href={locale === 'tr' ? `/global/tr/${stock.ticker}` : `/global/en/${stock.ticker}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors duration-150 group"
              style={{ '--accent': accent } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-mono font-bold text-white/25 w-3">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="font-black text-white text-sm tracking-tight transition-colors group-hover:text-[var(--accent)]">
                    {stock.ticker}
                  </div>
                  <div className="text-[11px] text-white/40 truncate max-w-[120px]">{stock.sector || '—'}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
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
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-xs text-white/40">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
