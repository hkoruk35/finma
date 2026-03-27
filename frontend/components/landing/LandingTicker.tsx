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
  { symbol: 'BTC-USD',  label: 'BTC',      category: 'Kripto',  pct: '+2.14%',  dir: 'up'   },
  { symbol: 'ETH-USD',  label: 'ETH',      category: 'Kripto',  pct: '+1.87%',  dir: 'up'   },
  { symbol: 'SOL-USD',  label: 'SOL',      category: 'Kripto',  pct: '+3.42%',  dir: 'up'   },
  { symbol: 'AVAX-USD', label: 'AVAX',     category: 'Kripto',  pct: '-0.92%',  dir: 'down' },
  { symbol: 'DOGE-USD', label: 'DOGE',     category: 'Kripto',  pct: '+5.10%',  dir: 'up'   },
  { symbol: 'NVDA',     label: 'NVDA',     category: 'Hisse',   pct: '+4.12%',  dir: 'up'   },
  { symbol: 'AAPL',     label: 'AAPL',     category: 'Hisse',   pct: '+0.88%',  dir: 'up'   },
  { symbol: 'TSLA',     label: 'TSLA',     category: 'Hisse',   pct: '-1.23%',  dir: 'down' },
  { symbol: 'META',     label: 'META',     category: 'Hisse',   pct: '+3.55%',  dir: 'up'   },
  { symbol: 'MSFT',     label: 'MSFT',     category: 'Hisse',   pct: '+1.88%',  dir: 'up'   },
  { symbol: 'AMD',      label: 'AMD',      category: 'Hisse',   pct: '+1.44%',  dir: 'up'   },
  { symbol: 'GC=F',     label: 'XAU',      category: 'Emtia',   pct: '+0.87%',  dir: 'up'   },
  { symbol: 'SI=F',     label: 'XAG',      category: 'Emtia',   pct: '+0.54%',  dir: 'up'   },
  { symbol: 'CL=F',     label: 'WTI',      category: 'Emtia',   pct: '-1.20%',  dir: 'down' },
  { symbol: 'NG=F',     label: 'NATGAS',   category: 'Emtia',   pct: '+0.33%',  dir: 'up'   },
  { symbol: 'EURUSD=X', label: 'EUR/USD',  category: 'Forex',   pct: '+0.12%',  dir: 'up'   },
  { symbol: 'USDJPY=X', label: 'USD/JPY',  category: 'Forex',   pct: '-0.31%',  dir: 'down' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', category: 'Forex',   pct: '+0.09%',  dir: 'up'   },
  { symbol: 'USDTRY=X', label: 'USD/TRY', category: 'Forex',   pct: '+0.44%',  dir: 'up'   },
  { symbol: 'ZW=F',     label: 'BUĞDAY',  category: 'Emtia',   pct: '-0.68%',  dir: 'down' },
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
