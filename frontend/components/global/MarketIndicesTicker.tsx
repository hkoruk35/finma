'use client';

interface MarketIndex {
  value: number;
  change_pct: number;
}

interface MarketIndicesTickerProps {
  indices: Record<string, MarketIndex>;
  locale: 'tr' | 'en';
}

const indexLabels = {
  tr: {
    'SPX': 'S&P 500',
    '^GSPC': 'S&P 500',
    '^IXIC': 'NASDAQ',
    '^DJI': 'DOW JONES',
    '^RUT': 'RUSSELL 2000',
    '^VIX': 'VIX',
  },
  en: {
    'SPX': 'S&P 500',
    '^GSPC': 'S&P 500',
    '^IXIC': 'NASDAQ',
    '^DJI': 'DOW JONES',
    '^RUT': 'RUSSELL 2000',
    '^VIX': 'VIX',
  },
};

export default function MarketIndicesTicker({
  indices,
  locale,
}: MarketIndicesTickerProps) {
  const labels = indexLabels[locale];
  const indexEntries = Object.entries(indices || {}).slice(0, 6);

  if (indexEntries.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0a0e17] via-[#0d1117] to-[#0a0e17] border-b border-[#1e2a3a] overflow-hidden">
      <div className="flex animate-scroll space-x-8 px-4 py-3">
        {/* Double the items for seamless loop effect */}
        {[...indexEntries, ...indexEntries].map(([ key, data], idx) => (
          <div key={`${key}-${idx}`} className="flex items-center space-x-3 whitespace-nowrap">
            <span className="text-xs font-bold text-white/70">
              {labels[key as keyof typeof labels] || key}
            </span>
            <span className="font-mono font-bold text-white">
              {data.value.toFixed(2)}
            </span>
            <span
              className={`font-mono font-semibold text-xs ${
                data.change_pct >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {data.change_pct >= 0 ? '+' : ''}{data.change_pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
