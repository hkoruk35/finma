'use client'

import { useEffect, useState } from 'react'

interface Mover {
  symbol: string
  name: string
  sector: string
  price: number
  change_pct: number
  volume: number
}

interface MoversData {
  gainers: Mover[]
  losers: Mover[]
  mostActive: Mover[]
  updatedAt: string
}

const FALLBACK_DATA: MoversData = {
  gainers: [
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Teknoloji', price: 167.52, change_pct: 3.2, volume: 194056113 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'İletişim', price: 525.72, change_pct: 1.8, volume: 28975085 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Teknoloji', price: 356.77, change_pct: 1.5, volume: 37661564 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'İletişim', price: 274.34, change_pct: 1.2, volume: 35491598 },
    { symbol: 'AMZN', name: 'Amazon.com', sector: 'Tüketici', price: 199.34, change_pct: 0.9, volume: 55772474 },
  ],
  losers: [
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Otomotiv', price: 361.83, change_pct: -3.31, volume: 60637943 },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finans', price: 282.84, change_pct: -3.45, volume: 6995384 },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Finans', price: 295.52, change_pct: -3.42, volume: 9970427 },
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Teknoloji', price: 248.8, change_pct: -2.39, volume: 46525772 },
    { symbol: 'BRK-B', name: 'Berkshire H.', sector: 'Finans', price: 468.49, change_pct: -1.61, volume: 5330301 },
  ],
  mostActive: [
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Teknoloji', price: 167.52, change_pct: 3.2, volume: 194056113 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Otomotiv', price: 361.83, change_pct: -3.31, volume: 60637943 },
    { symbol: 'AMZN', name: 'Amazon.com', sector: 'Tüketici', price: 199.34, change_pct: -4.18, volume: 55772474 },
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Teknoloji', price: 248.8, change_pct: -2.39, volume: 46525772 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Teknoloji', price: 356.77, change_pct: -2.76, volume: 37661564 },
  ],
  updatedAt: new Date().toISOString(),
}

export function MarketMoversColumn() {
  const [data, setData] = useState<MoversData>(FALLBACK_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const res = await fetch('/api/market-movers', { cache: 'no-store' })
        if (res.ok) {
          const movers: MoversData = await res.json()
          setData(movers)
        }
      } catch {
        // keep fallback
      } finally {
        setLoading(false)
      }
    }

    fetchMovers()
    // Refresh every 5 minutes (matches bot 901 schedule)
    const iv = setInterval(fetchMovers, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const MoverItem = ({ item }: { item: Mover }) => {
    const isPositive = item.change_pct >= 0
    const changeColor = isPositive ? '#10B981' : '#F43F5E'
    const changeStr = isPositive ? `+${item.change_pct.toFixed(2)}%` : `${item.change_pct.toFixed(2)}%`

    return (
      <div
        style={{
          padding: '10px 0',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45,126,248,0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Top: Symbol + Change% */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 12,
              fontWeight: 700,
              color: '#EDF2FA',
            }}
          >
            {item.symbol}
          </span>
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              fontWeight: 700,
              color: changeColor,
            }}
          >
            {changeStr}
          </span>
        </div>

        {/* Bottom: Name + Sector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span
            style={{
              fontFamily: 'Manrope, sans-serif',
              color: '#8B97AA',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              marginRight: 8,
            }}
          >
            {item.name}
          </span>
          <span
            style={{
              fontFamily: 'Manrope, sans-serif',
              color: '#4C5A6B',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {item.sector || '—'}
          </span>
        </div>
      </div>
    )
  }

  const Section = ({ title, items }: { title: string; items: Mover[] }) => (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: 12,
          fontWeight: 700,
          color: '#EDF2FA',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(45,126,248,0.30)',
        }}
      >
        {title}
      </div>
      <div>
        {items.map((item, i) => (
          <MoverItem key={i} item={item} />
        ))}
      </div>
    </div>
  )

  return (
    <div
      style={{
        background: 'rgba(6,10,15,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 16,
        backdropFilter: 'blur(12px)',
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <Section title="🔺 Yükselenler" items={data.gainers} />
      <Section title="🔻 Düşenler" items={data.losers} />
      <Section title="⚡ İşlem Liderleri" items={data.mostActive} />

      <div
        style={{
          fontSize: 9,
          color: '#2A3849',
          textAlign: 'center',
          marginTop: 12,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {new Date(data.updatedAt).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}
