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
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX',   pct: '+0.82%', dir: 'up',   comment: 'Yükselen trend'  },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP',  pct: '+1.34%', dir: 'up',   comment: 'Momentum güçlü'  },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI',   pct: '-0.21%', dir: 'down', comment: 'Temkinli seyir'  },
  { symbol: 'DX-Y.NYB', label: 'DOLAR',   sublabel: 'DXY',   pct: '-0.31%', dir: 'down', comment: 'Zayıflama devam' },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'KORKU', pct: '+4.20%', dir: 'up',   comment: 'Risk iştahı ↓'  },
]

export function MarketIndexBadge() {
  const [items, setItems] = useState<IndexItem[]>(FALLBACK)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/market-index', { cache: 'no-store' })
        if (res.ok) {
          const data: IndexItem[] = await res.json()
          if (Array.isArray(data) && data.length > 0) setItems(data)
        }
      } catch { /* keep fallback */ }
    }

    load()
    const iv = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      <style>{`
        .mib-scroll::-webkit-scrollbar { display: none; }
        .mib-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {/* Mobile: single horizontal scroll row */}
      <div
        className="mib-scroll"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          justifyContent: 'flex-start',
          marginBottom: 22,
          paddingBottom: 2,
        }}
      >
        {/* Desktop: center the group */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'nowrap',
          margin: '0 auto',
        }}>
          {items.map(item => (
            <div key={item.symbol} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10,
              padding: '7px 11px',
              minWidth: 82,
              flexShrink: 0,
            }}>
              {/* Label */}
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 8,
                fontWeight: 600,
                color: '#4C5A6B',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: 3,
                whiteSpace: 'nowrap',
              }}>
                {item.sublabel} {item.label}
              </div>
              {/* Pct */}
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 16,
                fontWeight: 700,
                color: item.dir === 'up' ? '#10B981' : '#F43F5E',
                lineHeight: 1,
                marginBottom: 4,
              }}>
                {item.pct}
              </div>
              {/* Comment */}
              <div style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: 9,
                color: '#8B97AA',
                whiteSpace: 'nowrap',
              }}>
                {item.comment}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
