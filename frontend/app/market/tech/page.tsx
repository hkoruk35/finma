'use client'

import { useState } from 'react'

const S = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px',
  },
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: '#4C5A6B',
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
}

const TECH_STOCKS = [
  { symbol: 'NVDA', label: 'NVIDIA', price: '$876.45', chg: '+4.12%', dir: 'up', market_cap: '$2.1T' },
  { symbol: 'AAPL', label: 'Apple', price: '$182.35', chg: '+0.88%', dir: 'up', market_cap: '$2.8T' },
  { symbol: 'MSFT', label: 'Microsoft', price: '$415.20', chg: '+1.88%', dir: 'up', market_cap: '$3.1T' },
  { symbol: 'META', label: 'Meta', price: '$428.75', chg: '+3.55%', dir: 'up', market_cap: '$1.3T' },
  { symbol: 'TSLA', label: 'Tesla', price: '$185.90', chg: '-1.23%', dir: 'down', market_cap: '$590B' },
  { symbol: 'AMD', label: 'AMD', price: '$188.45', chg: '+1.44%', dir: 'up', market_cap: '$305B' },
]

export default function TechPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 'clamp(24px, 6vw, 40px)',
            fontWeight: 800,
            marginBottom: 8,
            color: '#EDF2FA',
          }}
        >
          Teknoloji Sektörü
        </h1>
        <p style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#8B97AA' }}>
          NVIDIA, Apple, Microsoft, Meta — Teknoloji devleri
        </p>
      </div>

      {/* Canlı badge */}
      <div style={{ marginBottom: 20 }}>
        <span
          style={{
            fontSize: 'clamp(10px, 3vw, 12px)',
            padding: '6px 12px',
            background: 'rgba(16,185,129,0.15)',
            color: '#10B981',
            borderRadius: 20,
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span className="lp-blink" style={{ fontSize: 8 }}>
            ●
          </span>
          Pazar Öncü Sektör
        </span>
      </div>

      {/* Tech stocks grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {TECH_STOCKS.map((stock) => (
          <div key={stock.symbol} style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 4 }}>
                {stock.label}
              </div>
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: '#4C5A6B',
                }}
              >
                {stock.symbol}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(13px, 4vw, 18px)',
                  color: '#EDF2FA',
                  fontWeight: 700,
                }}
              >
                {stock.price}
              </span>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: stock.dir === 'up' ? '#10B981' : '#F43F5E',
                }}
              >
                {stock.chg}
              </span>
            </div>

            <div
              style={{
                fontSize: 'clamp(11px, 3vw, 12px)',
                color: '#4C5A6B',
                marginBottom: 12,
                padding: '8px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 6,
              }}
            >
              Market Cap: <strong style={{ color: '#8B97AA' }}>{stock.market_cap}</strong>
            </div>

            <button
              onClick={() => setShowModal(true)}
              style={{
                width: '100%',
                background: 'rgba(45,126,248,0.12)',
                border: '1px solid rgba(45,126,248,0.25)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#2D7EF8',
                fontSize: 'clamp(11px, 3vw, 12px)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Hisse Analizi
            </button>
          </div>
        ))}
      </div>

      {/* Tech Sektörü Özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={S.card}>
          <div style={S.label}>AI Furyası</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Yapay zeka haberlemeleri teknoloji hisselerini yönlendirmeye devam ediyor.
          </p>
        </div>

        <div style={S.card}>
          <div style={S.label}>Değerleme</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Mega-cap teknoloji hisse senetleri prime valuationlar almaya devam etmektedir.
          </p>
        </div>

        <div style={S.card}>
          <div style={S.label}>İnovasyon Temesi</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Bulut bilişim ve çip tasarımı devam eden büyüme sürücüleridir.
          </p>
        </div>
      </div>

      {/* AI Analiz */}
      <div style={S.card}>
        <div style={S.label}>📱 Teknoloji Sektörü Özeti</div>
        <p
          style={{
            fontSize: 'clamp(13px, 3vw, 14px)',
            lineHeight: 1.6,
            color: '#B8C5D4',
            margin: 0,
          }}
        >
          Teknoloji sektörü güçlü bir toparlanma göstermektedir ve yapay zeka tematik gücü
          hisse senetlerinin değerlemesini yukarı doğru itmeye devam etmektedir. NVIDIA çip talep
          liderliğini sürdürüyor. Apple ve Microsoft bulut ve AI altyapı yatırımlarından yararlanıyor.
          Meta'nın AI çabaları pazar dikkatini çekiyor. Genel risk-on ortamı teknoloji sektörüne
          yardımcı olmaktadır.
        </p>
      </div>

      {/* Paywall Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'rgba(12,16,23,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 'clamp(20px, 5vw, 40px)',
              maxWidth: 500,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>💻</div>
            <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 8, color: '#EDF2FA' }}>
              Pro Hisse Analizi
            </h2>
            <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#8B97AA', marginBottom: 20 }}>
              Detaylı teknoloji analizi ve tahminler
            </p>
            <button
              style={{
                width: '100%',
                background: '#2D7EF8',
                border: 'none',
                borderRadius: 10,
                padding: 'clamp(10px, 3vw, 14px)',
                color: '#fff',
                fontSize: 'clamp(12px, 3vw, 14px)',
                fontWeight: 600,
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}
            >
              Erişim Talep Et
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
