'use client';

import Link from 'next/link';

interface StockRow {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  change: string;
  changeNum: number;
  signal: string;
}

interface HomeGridCardProps {
  title: string;
  description?: string;
  stocks: StockRow[];
  viewAllHref: string;
  viewAllLabel: string;
  locale: 'tr' | 'en';
  icon?: string;
}

const SIGNAL_STYLE: Record<string, string> = {
  AL: 'bg-green-500/20 border border-green-500/40 text-green-400',
  SAT: 'bg-red-500/20 border border-red-500/40 text-red-400',
  İZLE: 'bg-amber-500/20 border border-amber-500/40 text-amber-400',
  BEKLE: 'bg-white/5 border border-white/15 text-white/40',
  BUY: 'bg-green-500/20 border border-green-500/40 text-green-400',
  SELL: 'bg-red-500/20 border border-red-500/40 text-red-400',
  WATCH: 'bg-amber-500/20 border border-amber-500/40 text-amber-400',
  WAIT: 'bg-white/5 border border-white/15 text-white/40',
  'TREND': 'bg-blue-500/20 border border-blue-500/40 text-blue-400',
};

export default function HomeGridCard({
  title,
  description,
  stocks,
  viewAllHref,
  viewAllLabel,
  locale,
  icon,
}: HomeGridCardProps) {
  const emptyMessage = locale === 'tr'
    ? 'Veri bulunmamaktadır'
    : 'No data available';

  return (
    <div className="flex flex-col h-full rounded-2xl border border-[#1e2a3a] bg-gradient-to-br from-[#111620] to-[#0a0e17] shadow-xl shadow-black/50 overflow-hidden hover:border-[#2a3f52] transition-colors duration-300">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#1e2a3a] bg-[#0d1117]/50">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && <span className="text-xl">{icon}</span>}
            <h3 className="text-lg font-black text-white">{title}</h3>
          </div>
        </div>
        {description && (
          <p className="text-xs text-white/50">{description}</p>
        )}
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
                  className="px-6 py-4 hover:bg-[#111620]/80 transition-colors duration-200 group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-white group-hover:text-[#3b82f6] transition-colors">
                          {stock.ticker}
                        </span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            SIGNAL_STYLE[stock.signal] ||
                            SIGNAL_STYLE[locale === 'tr' ? 'İZLE' : 'WATCH']
                          }`}
                        >
                          {stock.signal}
                        </span>
                      </div>
                      <div className="text-xs text-white/50 truncate">
                        {stock.sector}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-semibold text-white text-sm">
                        ${stock.price.replace('$', '')}
                      </div>
                      <div
                        className={`font-mono text-xs font-bold ${
                          stock.changeNum >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {stock.change}
                      </div>
                    </div>
                  </div>
                  {/* Optional company name tooltip on hover */}
                  <div className="text-[10px] text-white/30 truncate">
                    {stock.company}
                  </div>
                </Link>
              ))}
            </div>

            {/* Footer with View All */}
            <div className="px-6 py-4 border-t border-[#1e2a3a] bg-[#0d1117]/30">
              <Link
                href={viewAllHref}
                className="inline-flex items-center justify-center w-full py-2 px-3 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-xs font-bold text-[#3b82f6] hover:bg-[#3b82f6]/20 hover:border-[#3b82f6]/50 transition-all duration-200"
              >
                {viewAllLabel} →
              </Link>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-white/50">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
