'use client'

import { useEffect, useState } from 'react'

interface TickerItem {
  symbol: string
  label: string
  category: string
  pct: string
  dir: 'up' | 'down'
}

const FALLBACK: TickerItem[] = [
  // 5 Main Indices
  { symbol: 'SPX',   label: 'S&P 500',       category: 'Endeks',  pct: '+1.24%',  dir: 'up'   },
  { symbol: 'DJI',   label: 'DOW',           category: 'Endeks',  pct: '+0.87%',  dir: 'up'   },
  { symbol: 'IXIC',  label: 'NASDAQ',        category: 'Endeks',  pct: '+2.18%',  dir: 'up'   },
  { symbol: 'VIX',   label: 'VIX',           category: 'Endeks',  pct: '-5.32%',  dir: 'down' },
  { symbol: 'RUT',   label: 'Russell 2K',    category: 'Endeks',  pct: '+1.45%',  dir: 'up'   },
  // 11 Sector ETFs
  { symbol: 'XLC',   label: 'Communication', category: 'Sektor',  pct: '+2.15%',  dir: 'up'   },
  { symbol: 'XLY',   label: 'Consumer Disc.', category: 'Sektor', pct: '+1.89%',  dir: 'up'   },
  { symbol: 'XLE',   label: 'Energy',        category: 'Sektor',  pct: '-0.45%',  dir: 'down' },
  { symbol: 'XLF',   label: 'Financials',    category: 'Sektor',  pct: '+0.92%',  dir: 'up'   },
  { symbol: 'XLV',   label: 'Healthcare',    category: 'Sektor',  pct: '+1.23%',  dir: 'up'   },
  { symbol: 'XLI',   label: 'Industrials',   category: 'Sektor',  pct: '+1.56%',  dir: 'up'   },
  { symbol: 'XLRE',  label: 'Real Estate',   category: 'Sektor',  pct: '+0.78%',  dir: 'up'   },
  { symbol: 'XLK',   label: 'Technology',    category: 'Sektor',  pct: '+2.34%',  dir: 'up'   },
  { symbol: 'XLP',   label: 'Cons. Staples', category: 'Sektor',  pct: '+0.45%',  dir: 'up'   },
  { symbol: 'XLU',   label: 'Utilities',     category: 'Sektor',  pct: '-0.23%',  dir: 'down' },
]

export function LandingTicker() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch('/api/ticker-data', { cache: 'no-store' })
        if (res.ok) {
          const data: TickerItem[] = await res.json()
          if (Array.isArray(data) && data.length > 0) setItems(data)
        }
      } catch {
        // keep fallback
      }
    }
    fetchTicker()
    // Refresh every 15 minutes
    const iv = setInterval(fetchTicker, 15 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  // duplicate 2× for seamless loop
  const doubled = [...items, ...items]

  return (
    <div style={{ width: '100%', overflow: 'hidden', height: 28 }}>
      <style>{`
        @keyframes ltkrScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ltkr-track {
          display: flex;
          height: 100%;
          width: max-content;
          animation: ltkrScroll 55s linear infinite;
        }
        .ltkr-track.paused { animation-play-state: paused; }
      `}</style>

      <div
        className={`ltkr-track${paused ? ' paused' : ''}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '0 14px',
              height: '100%',
              borderRight: '1px solid rgba(255,255,255,0.04)',
              whiteSpace: 'nowrap',
              cursor: 'default',
            }}
          >
            {/* Symbol */}
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              color: '#8B97AA',
              letterSpacing: '0.5px',
            }}>
              {item.label}
            </span>

            {/* % change */}
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              color: item.dir === 'up' ? '#10B981' : '#F43F5E',
            }}>
              {item.pct}
            </span>

            {/* Category */}
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 8,
              color: '#2A3849',
              letterSpacing: '0.5px',
            }}>
              {item.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
