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

const CRYPTOS = [
  { symbol: 'BTC', label: 'Bitcoin', price: '$87,420', chg: '-2.41%', dir: 'down', market_cap: '$1.7T' },
  { symbol: 'ETH', label: 'Ethereum', price: '$3,245', chg: '+1.12%', dir: 'up', market_cap: '$390B' },
  { symbol: 'SOL', label: 'Solana', price: '$198', chg: '+5.63%', dir: 'up', market_cap: '$92B' },
  { symbol: 'BNB', label: 'BNB', price: '$612', chg: '+0.84%', dir: 'up', market_cap: '$85B' },
]

export default function CryptoPage() {
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
          Kripto Piyasası
        </h1>
        <p style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#8B97AA' }}>
          Bitcoin, Ethereum, Solana — Kripto para canlı analizi
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
          24/7 Canlı Veri
        </span>
      </div>

      {/* Kripto grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {CRYPTOS.map((crypto) => (
          <div key={crypto.symbol} style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 4 }}>
                {crypto.label}
              </div>
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: '#4C5A6B',
                }}
              >
                {crypto.symbol}
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
                {crypto.price}
              </span>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: crypto.dir === 'up' ? '#10B981' : '#F43F5E',
                }}
              >
                {crypto.chg}
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
              Market Cap: <strong style={{ color: '#8B97AA' }}>{crypto.market_cap}</strong>
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
              Trend Analizi
            </button>
          </div>
        ))}
      </div>

      {/* Kripto Baskısı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={S.card}>
          <div style={S.label}>Market Durumu</div>
          <div style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 8 }}>
            Risk-On Ortam
          </div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Bitcoin strong rally devam ediyor. Altcoin'ler de pozitif momentum gösteriyor.
          </p>
        </div>

        <div style={S.card}>
          <div style={S.label}>Volatilite</div>
          <div style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#F59E0B', fontWeight: 600, marginBottom: 8 }}>
            Orta Düzey
          </div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            24 saatlik hareketlilik normal seviyelerde. Fırsat bekleme zamanı.
          </p>
        </div>
      </div>

      {/* AI Analiz */}
      <div style={S.card}>
        <div style={S.label}>🤖 AI Sentiment</div>
        <p
          style={{
            fontSize: 'clamp(13px, 3vw, 14px)',
            lineHeight: 1.6,
            color: '#B8C5D4',
            margin: 0,
          }}
        >
          Kripto pazarında bullish sentiment hakimdir. Bitcoin makro göstergelere kuvvet kazandıkça,
          genel piyasa katılımcıları risk almaya istekli görülmektedir. Ethereum network aktivitesi
          yüksek seviyelerde kalıyor. Altcoin'ler selektif başarı göstermektedir.
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 8, color: '#EDF2FA' }}>
              Pro Trend Analizi
            </h2>
            <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#8B97AA', marginBottom: 20 }}>
              Derinlemesine teknik analiz ve tahmin modellerine erişim
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
              Üye Ol
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
