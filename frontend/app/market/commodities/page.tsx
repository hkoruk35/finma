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

const COMMODITIES = [
  { symbol: 'GC=F', label: 'Altın', price: '$2,350.80', chg: '+0.87%', dir: 'up', unit: '$/oz' },
  { symbol: 'SI=F', label: 'Gümüş', price: '$28.45', chg: '+0.54%', dir: 'up', unit: '$/oz' },
  { symbol: 'CL=F', label: 'WTI Petrol', price: '$78.32', chg: '-1.20%', dir: 'down', unit: '$/bl' },
  { symbol: 'NG=F', label: 'Doğal Gaz', price: '$2.65', chg: '+0.33%', dir: 'up', unit: '$/MMBtu' },
]

export default function CommoditiesPage() {
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
          Emtia Piyasası
        </h1>
        <p style={{ fontSize: 'clamp(13px, 4vw, 14px)', color: '#8B97AA' }}>
          Altın, Gümüş, Petrol, Doğal Gaz — Küresel emtia fiyatları
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
          Canlı Fiyatlar
        </span>
      </div>

      {/* Emtia grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {COMMODITIES.map((cmd) => (
          <div key={cmd.symbol} style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#EDF2FA', fontWeight: 600, marginBottom: 4 }}>
                {cmd.label}
              </div>
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(10px, 3vw, 11px)',
                  color: '#4C5A6B',
                }}
              >
                {cmd.symbol} • {cmd.unit}
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
                {cmd.price}
              </span>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 'clamp(11px, 3vw, 12px)',
                  color: cmd.dir === 'up' ? '#10B981' : '#F43F5E',
                }}
              >
                {cmd.chg}
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
              Analiz Göster
            </button>
          </div>
        ))}
      </div>

      {/* Emtia Baskısı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={S.card}>
          <div style={S.label}>Altın Talebinin Saç Ayağı</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Altın, makroekonomik belirsizlik durumunda güvenli liman olarak kaldığında değer kazanmaya devam etmektedir.
          </p>
        </div>

        <div style={S.card}>
          <div style={S.label}>Enerji Piyasası</div>
          <p style={{ fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA', margin: 0 }}>
            Ham petrol fiyatları global arz-talep dengesinden etkilenmektedir. Geopolitik riskler izlenmektedir.
          </p>
        </div>
      </div>

      {/* AI Analiz */}
      <div style={S.card}>
        <div style={S.label}>📈 Emtia Özeti</div>
        <p
          style={{
            fontSize: 'clamp(13px, 3vw, 14px)',
            lineHeight: 1.6,
            color: '#B8C5D4',
            margin: 0,
          }}
        >
          Emtia piyasası karışık sinyaller vermektedir. Altın güçlü talep görmekte ve fiyatlar yükselmektedir.
          Petrol fiyatları geopolitik endişeler nedeniyle dalgalı bir seyir izlemektedir. Gümüş endüstriyel talep
          ile birlikte hareket etmektedir. Tarım emtiaları sezon dinamiklerinden etkilenmektedir.
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>💎</div>
            <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 8, color: '#EDF2FA' }}>
              Derinlemesine Analiz
            </h2>
            <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#8B97AA', marginBottom: 20 }}>
              Fiyat tahminleri ve portföy önerileri için üye ol
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
              Ücretsiz Başla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
