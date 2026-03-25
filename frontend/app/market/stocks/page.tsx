'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

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
  tag: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(45,126,248,0.10)',
    color: '#2D7EF8',
  },
}

const INDICES = [
  { symbol: 'ES=F', label: 'S&P 500', price: '5,826.45', chg: '+1.23%', dir: 'up' },
  { symbol: 'NQ=F', label: 'Nasdaq-100', price: '20,432.10', chg: '+0.95%', dir: 'up' },
  { symbol: 'YM=F', label: 'Dow Jones', price: '43,215.65', chg: '+0.87%', dir: 'up' },
  { symbol: 'RTY=F', label: 'Russell 2000', price: '2,087.33', chg: '-0.42%', dir: 'down' },
]

const SECTORS = [
  { name: 'Teknoloji', pct: '+2.14%', dir: 'up' },
  { name: 'Finansal', pct: '+0.98%', dir: 'up' },
  { name: 'Sağlık', pct: '+1.42%', dir: 'up' },
  { name: 'Enerji', pct: '-0.73%', dir: 'down' },
  { name: 'Tüketici Mal', pct: '+0.21%', dir: 'up' },
  { name: 'Endüstriyel', pct: '+0.64%', dir: 'up' },
]

export default function StocksPage() {
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
          ABD Borsaları
        </h1>
        <p style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#8B97AA' }}>
          S&P 500, Nasdaq, Dow Jones — Ana endekslerin canlı analizi
        </p>
      </div>

      {/* Canlı badge */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(10px, 3vw, 12px)',
            padding: '6px 12px',
            background: 'rgba(16,185,129,0.15)',
            color: '#10B981',
            borderRadius: 20,
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span className="lp-blink" style={{ fontSize: 8 }}>
            ●
          </span>
          Canlı AI Analizi
        </span>
      </div>

      {/* Endeksler grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {INDICES.map((idx) => (
          <div key={idx.symbol} style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 4 }}>
                {idx.label}
              </div>
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: '#4C5A6B',
                }}
              >
                {idx.symbol}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 'clamp(13px, 4vw, 18px)', color: '#EDF2FA', fontWeight: 700 }}>
                {idx.price}
              </span>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: idx.dir === 'up' ? '#10B981' : '#F43F5E',
                }}
              >
                {idx.chg}
              </span>
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
              Detaylı Analiz
            </button>
          </div>
        ))}
      </div>

      {/* Sektörler */}
      <div style={{ marginBottom: 24 }}>
        <div style={S.label}>Sektör Performansı</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {SECTORS.map((sec) => (
            <div key={sec.name} style={S.card}>
              <div style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 8 }}>
                {sec.name}
              </div>
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(13px, 4vw, 16px)',
                  color: sec.dir === 'up' ? '#10B981' : '#F43F5E',
                  fontWeight: 700,
                }}
              >
                {sec.pct}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Analiz */}
      <div style={S.card}>
        <div style={S.label}>📊 Piyasa Özeti</div>
        <p
          style={{
            fontSize: 'clamp(13px, 3vw, 14px)',
            lineHeight: 1.6,
            color: '#B8C5D4',
            margin: 0,
          }}
        >
          ABD hisse senedi piyasası güçlü bir yükseliş trendi göstermektedir. S&P 500 endeksi önceki
          kapanışından %1.23 oranında artmıştır. Teknoloji sektörü piyasayı yönlendiren ana kuvvet
          olarak görülmektedir. Volatilite göstergeleri düşük seviyelerde kalarak risk iştahının
          sağlıklı olduğunu göstermektedir.
        </p>
      </div>

      {/* Paywall */}
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 8, color: '#EDF2FA' }}>
              Pro Analiz Kilitli
            </h2>
            <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#8B97AA', marginBottom: 20 }}>
              Detaylı teknik analiz, momentum seviyeleri ve tahmin için üye olun
            </p>
            <button
              onClick={() => {
                /* login modal trigger */
              }}
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
              Ücretsiz Hesap Oluştur
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
