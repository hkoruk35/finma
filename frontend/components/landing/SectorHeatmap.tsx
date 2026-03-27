'use client';

import React, { useState, useEffect } from 'react';

interface HeatmapData {
  ticker: string;
  name: string;
  price: number;
  change_percent: number;
  type: 'sector' | 'index';
}

interface HeatmapResponse {
  success: boolean;
  timestamp: string;
  last_update_ny: string;
  data: HeatmapData[];
  error?: string;
}

export function SectorHeatmap() {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchHeatmapData();
    // Her saat başında güncelle
    const timer = setInterval(fetchHeatmapData, 3600000);
    return () => clearInterval(timer);
  }, []);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/market/sector-heatmap', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Veri yüklenemedi');

      const json: HeatmapResponse = await response.json();

      if (json.success && json.data) {
        setData(json.data);
        setLastUpdate(json.last_update_ny);
      } else {
        setError(json.error || 'Veri alınamadı');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getColor = (change: number) => {
    if (change > 1.5) return '#10b981'; // Yeşil (güçlü artış)
    if (change > 0.5) return '#6ee7b7'; // Açık yeşil (hafif artış)
    if (change > 0) return '#d1fae5'; // Çok açık yeşil (küçük artış)
    if (change > -0.5) return '#fee2e2'; // Çok açık kırmızı (küçük düşüş)
    if (change > -1.5) return '#fca5a5'; // Açık kırmızı (hafif düşüş)
    return '#dc2626'; // Kırmızı (güçlü düşüş)
  };

  const getTextColor = (change: number) => {
    if (change > 0.5) return '#065f46'; // Koyu yeşil
    if (change < -0.5) return '#7f1d1d'; // Koyu kırmızı
    return '#374151'; // Gri
  };

  const sectors = data.filter(d => d.type === 'sector');
  const indexes = data.filter(d => d.type === 'index');

  return (
    <div style={{ marginTop: 60, marginBottom: 60, width: '100%' }}>
      {/* Başlık */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#f5f5f5',
          marginBottom: 8,
        }}>
          📊 ABD Borsası Sektor Isı Haritası
        </h3>
        {lastUpdate && (
          <p style={{
            fontSize: 12,
            color: '#9ca3af',
            marginBottom: 15,
          }}>
            Son Güncelleme: {lastUpdate} (NY Saati)
          </p>
        )}
      </div>

      {/* Sektörler Grid (3x3) */}
      {!loading && sectors.length > 0 && (
        <div style={{
          marginBottom: 40,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          '@media (max-width: 768px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
          }
        }} className="grid grid-cols-3 md:grid-cols-3 gap-3 mb-8">
          {sectors.map(item => (
            <div
              key={item.ticker}
              style={{
                backgroundColor: getColor(item.change_percent),
                borderRadius: 8,
                padding: 12,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                minHeight: 80,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'scale(1)';
              }}
            >
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: getTextColor(item.change_percent),
                marginBottom: 4,
              }}>
                {item.ticker}
              </div>
              <div style={{
                fontSize: 11,
                color: getTextColor(item.change_percent),
                marginBottom: 6,
                opacity: 0.8,
              }}>
                {item.name}
              </div>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: getTextColor(item.change_percent),
              }}>
                {item.change_percent > 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* İndeksler Grid (3x1) */}
      {!loading && indexes.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h4 style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#9ca3af',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Başlıca İndeksler
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }} className="grid grid-cols-3 gap-3">
            {indexes.map(item => (
              <div
                key={item.ticker}
                style={{
                  backgroundColor: getColor(item.change_percent),
                  borderRadius: 8,
                  padding: 12,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'scale(1)';
                }}
              >
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: getTextColor(item.change_percent),
                  marginBottom: 4,
                }}>
                  {item.name}
                </div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: getTextColor(item.change_percent),
                }}>
                  {item.change_percent > 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center',
          color: '#9ca3af',
          padding: '40px 0',
        }}>
          <div style={{ fontSize: 14, marginBottom: 15 }}>Sektor verileri yükleniyor...</div>
          <div style={{
            width: 40,
            height: 40,
            border: '2px solid #374151',
            borderTop: '2px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{
          backgroundColor: '#7f1d1d',
          borderRadius: 8,
          padding: 15,
          color: '#fee2e2',
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 20,
        }}>
          ⚠️ {error}
          <button
            onClick={fetchHeatmapData}
            style={{
              marginTop: 10,
              padding: '6px 12px',
              backgroundColor: '#10b981',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Yeniden Yükle
          </button>
        </div>
      )}

      {/* Boş veri */}
      {!loading && data.length === 0 && !error && (
        <div style={{
          textAlign: 'center',
          color: '#9ca3af',
          padding: '40px 0',
          fontSize: 13,
        }}>
          Veri bulunamadı
        </div>
      )}

      {/* Mobil uyarısı */}
      <style>{`
        @media (max-width: 768px) {
          [data-heatmap-grid] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          [data-heatmap-indexes] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
