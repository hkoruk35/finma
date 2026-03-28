'use client'

import { useEffect, useState } from 'react'

interface IndexItem {
  symbol: string
  label: string
  sublabel: string
  pct: string
  dir: 'up' | 'down'
  comment: string
}

const FALLBACK: IndexItem[] = [
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX',  pct: '+0.98%', dir: 'up',   comment: 'Yükselen trend'    },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP', pct: '+1.67%', dir: 'up',   comment: 'Momentum güçlü'   },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI',  pct: '+0.45%', dir: 'up',   comment: 'Sanayi güçlü'     },
  { symbol: '^RUT',     label: 'Russell 2000', sublabel: 'RUT',  pct: '+0.76%', dir: 'up', comment: 'Küçük cap güçlü' },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'VIX',  pct: '+3.82%', dir: 'up',   comment: 'Volatilite normal'  },
]

export function MarketIndexBadge() {
  const [items, setItems] = useState<IndexItem[]>(FALLBACK)

  useEffect(() => {
    const fetch5min = async () => {
      try {
        const res = await fetch('/api/market-index', { cache: 'no-store' })
        if (res.ok) {
          const data: IndexItem[] = await res.json()
          if (Array.isArray(data) && data.length > 0) setItems(data)
        }
      } catch { /* keep fallback */ }
    }

    fetch5min()
    const iv = setInterval(fetch5min, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 22,
    }}>
      {items.map(item => (
        <div key={item.symbol} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '8px 14px',
          minWidth: 90,
        }}>
          {/* Label row */}
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 9,
            fontWeight: 600,
            color: '#4C5A6B',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {item.sublabel} {item.label}
          </div>
          {/* Pct */}
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 18,
            fontWeight: 700,
            color: item.dir === 'up' ? '#10B981' : '#F43F5E',
            lineHeight: 1,
            marginBottom: 5,
          }}>
            {item.pct}
          </div>
          {/* Comment */}
          <div style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 10,
            color: '#8B97AA',
          }}>
            {item.comment}
          </div>
        </div>
      ))}
    </div>
  )
}
