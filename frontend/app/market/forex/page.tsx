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

const FOREX = [
  { symbol: 'EURUSD', label: 'EUR/USD', rate: '1.0850', chg: '+0.12%', dir: 'up', trend: 'Güçlü Euro' },
  { symbol: 'USDJPY', label: 'USD/JPY', rate: '149.25', chg: '-0.31%', dir: 'down', trend: 'Zayıf Yen' },
  { symbol: 'GBPUSD', label: 'GBP/USD', rate: '1.2750', chg: '+0.09%', dir: 'up', trend: 'Sterlin Yükseliş' },
  { symbol: 'USDTRY', label: 'USD/TRY', rate: '32.45', chg: '+0.44%', dir: 'up', trend: 'Dolar Güç' },
]

export default function ForexPage() {
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
          Döviz Piyasası
        </h1>
        <p style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#8B97AA' }}>
          EUR/USD, GBP/USD, USD/JPY — Küresel döviz kuru analizi
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
          24/7 Forex
        </span>
      </div>

      {/* Döviz grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {FOREX.map((fx) => (
          <div key={fx.symbol} style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 4 }}>
                {fx.label}
              </div>
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(10px, 3vw, 11px)',
                  color: '#4C5A6B',
                }}
              >
                {fx.symbol}
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
                {fx.rate}
              </span>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: fx.dir === 'up' ? '#10B981' : '#F43F5E',
                }}
              >
                {fx.chg}
              </span>
            </div>

            <div
              style={{
                fontSize: 'clamp(11px, 3vw, 12px)',
                color: '#2D7EF8',
                marginBottom: 12,
                padding: '6px 8px',
                background: 'rgba(45,126,248,0.08)',
                borderRadius: 6,
              }}
            >
              {fx.trend}
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
              Teknik Analiz
            </button>
          </div>
        ))}
      </div>

      {/* Forex Baskısı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={S.card}>
          <div style={S.label}>Euro Dinamiği</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Avrupa Merkez Bankası politika beklentileri EUR/USD kuru üzerinde etkili olmaktadır.
          </p>
        </div>

        <div style={S.card}>
          <div style={S.label}>Sterlin Görünümü</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            İngiltere ekonomisinin performansı GBP/USD oranını yönlendirmektedir.
          </p>
        </div>

        <div style={S.card}>
          <div style={S.label}>Yen Talebinin Saç Ayağı</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Japon Merkez Bankası'nın para politikası USD/JPY'nin ana belirleyicisi.
          </p>
        </div>
      </div>

      {/* AI Analiz */}
      <div style={S.card}>
        <div style={S.label}>🌍 Forex Özeti</div>
        <p
          style={{
            fontSize: 'clamp(13px, 3vw, 14px)',
            lineHeight: 1.6,
            color: '#B8C5D4',
            margin: 0,
          }}
        >
          Döviz piyasası merkez bankaları politika beklentileri tarafından yönlendirilmektedir. Dolar güçlü
          kalırken, Euro zayıf görünmektedir. Yen talebinin saç ayağı gözlenmektedir. Yükselen pazar
          para birimleri seçici bir şekilde performans göstermektedir. Carry trade aktivitesi dikkatli
          izlenmektedir.
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>💱</div>
            <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 8, color: '#EDF2FA' }}>
              Pro Forex Analizi
            </h2>
            <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#8B97AA', marginBottom: 20 }}>
              Forex stratejileri ve risk yönetimi için üye ol
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
