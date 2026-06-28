'use client';

import Link from 'next/link';

interface Stock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
  volume?: number;
}

interface HomeSimpleCardProps {
  title: string;
  stocks: Stock[];
  viewAllHref: string;
  locale: 'tr' | 'en';
}

export default function HomeSimpleCard({
  title,
  stocks,
  viewAllHref,
  locale,
}: HomeSimpleCardProps) {
  const emptyMessage = locale === 'tr'
    ? 'Veri bulunmamaktadır'
    : 'No data available';

  return (
    <div className="flex flex-col h-full rounded-xl border border-[#1e2a3a] bg-[#0d1117] overflow-hidden">
      {/* Header - Minimal */}
      <div className="px-4 py-3 border-b border-[#1e2a3a]">
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {stocks.length > 0 ? (
          <>
            {/* Stock list */}
            <div className="flex-1 divide-y divide-[#1e2a3a]">
              {stocks.map((stock) => (
                <Link
                  key={stock.ticker}
                  href={
                    locale === 'tr'
                      ? `/global/tr/${stock.ticker}`
                      : `/global/en/${stock.ticker}`
                  }
                  className="px-4 py-3 hover:bg-[#161b22] transition-colors duration-150 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white group-hover:text-[#3b82f6] transition-colors mb-0.5">
                        {stock.ticker}
                      </div>
                      <div className="text-[11px] text-white/40 truncate">
                        {stock.sector || '—'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono text-white/80">
                        ${stock.price.toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-bold font-mono ${
                          stock.change_pct >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Footer with View All */}
            <div className="px-4 py-2 border-t border-[#1e2a3a] bg-[#0a0e17]">
              <Link
                href={viewAllHref}
                className="text-[11px] font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                Tümünü Gör →
              </Link>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-white/40">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
