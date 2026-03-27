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
        // timestamp busts any CDN edge cache
        const res = await fetch(`/api/market-index?t=${Date.now()}`, { cache: 'no-store' })
        if (res.ok) {
          const data: IndexItem[] = await res.json()
          if (Array.isArray(data) && data.length > 0) setItems(data)
        }
      } catch { /* keep current state */ }
    }

    load()
    const iv = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      <style>{`
        .mib-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          width: 100%;
          margin-bottom: 22px;
        }
        .mib-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 7px 8px;
          min-width: 0;
          overflow: hidden;
        }
        .mib-label {
          font-family: 'DM Mono', monospace;
          font-size: 7px;
          font-weight: 600;
          color: #4C5A6B;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }
        .mib-pct {
          font-family: 'DM Mono', monospace;
          font-weight: 700;
          font-size: clamp(11px, 3vw, 16px);
          line-height: 1;
          margin-bottom: 4px;
          white-space: nowrap;
        }
        .mib-comment {
          font-family: 'Manrope', sans-serif;
          font-size: clamp(7px, 2vw, 9px);
          color: #8B97AA;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }
      `}</style>

      <div className="mib-grid">
        {items.map(item => (
          <div key={item.symbol} className="mib-card">
            <div className="mib-label">{item.sublabel} {item.label}</div>
            <div
              className="mib-pct"
              style={{ color: item.dir === 'up' ? '#10B981' : '#F43F5E' }}
            >
              {item.pct}
            </div>
            <div className="mib-comment">{item.comment}</div>
          </div>
        ))}
      </div>
    </>
  )
}
