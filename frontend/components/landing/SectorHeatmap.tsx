'use client';

import React, { useState, useEffect } from 'react';

interface StockData {
  ticker: string;
  change_percent: number;
}

interface HeatmapData {
  ticker: string;
  name: string;
  change_percent: number;
  type: 'sector' | 'index';
  stocks?: StockData[];
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
    const timer = setInterval(fetchHeatmapData, 3600000);
    return () => clearInterval(timer);
  }, []);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      setError('');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/market/sector-heatmap`, {
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
    if (change > 2) return { bg: '#064e3b', text: '#6ee7b7', border: '#10b981' };
    if (change > 1) return { bg: '#1f3a36', text: '#86efac', border: '#22c55e' };
    if (change > 0) return { bg: '#1e3a2f', text: '#a7f3d0', border: '#14b8a6' };
    if (change > -1) return { bg: '#3f2f2f', text: '#fca5a5', border: '#f97316' };
    if (change > -2) return { bg: '#4f1f1f', text: '#f87171', border: '#ef4444' };
    return { bg: '#5f1111', text: '#fca5a5', border: '#dc2626' };
  };

  const getSmallColor = (change: number) => {
    if (change > 1) return '#10b981';
    if (change > 0) return '#6ee7b7';
    if (change > -1) return '#f97316';
    return '#ef4444';
  };

  const sectors = data.filter(d => d.type === 'sector');
  const indexes = data.filter(d => d.type === 'index');

  return (
    <div style={{ marginTop: 80, marginBottom: 80, width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#f5f5f5',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          📊 ABD Borsası Sektor Isı Haritası
        </div>
        {lastUpdate && (
          <p style={{
            fontSize: 13,
            color: '#9ca3af',
            marginBottom: 0,
          }}>
            Son Güncelleme: {lastUpdate} NY Saati
          </p>
        )}
      </div>

      {/* Sektörler Grid 2x3 (11 sektör) */}
      {!loading && sectors.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {sectors.map(sector => {
            const colors = getColor(sector.change_percent);
            return (
              <div
                key={sector.ticker}
                style={{
                  background: colors.bg,
                  border: `1.5px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(-4px)';
                  el.style.boxShadow = `0 12px 24px ${colors.border}20`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                }}
              >
                {/* Sektor Header */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: colors.text,
                    marginBottom: 3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.9,
                  }}>
                    {sector.ticker}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#d1d5db',
                    marginBottom: 8,
                  }}>
                    {sector.name}
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: colors.text,
                    letterSpacing: '-0.02em',
                  }}>
                    {sector.change_percent > 0 ? '+' : ''}{sector.change_percent.toFixed(2)}%
                  </div>
                </div>

                {/* Alt Hisseler */}
                {sector.stocks && sector.stocks.length > 0 && (
                  <div style={{
                    paddingTop: 12,
                    borderTop: `1px solid ${colors.border}40`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 6,
                  }}>
                    {sector.stocks.map(stock => (
                      <div
                        key={stock.ticker}
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: `1px solid ${getSmallColor(stock.change_percent)}40`,
                          borderRadius: 6,
                          padding: 6,
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.background = 'rgba(0,0,0,0.5)';
                          el.style.borderColor = getSmallColor(stock.change_percent);
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.background = 'rgba(0,0,0,0.3)';
                          el.style.borderColor = `${getSmallColor(stock.change_percent)}40`;
                        }}
                      >
                        <div style={{
                          fontSize: 9,
                          color: '#d1d5db',
                          marginBottom: 2,
                          fontWeight: 600,
                        }}>
                          {stock.ticker}
                        </div>
                        <div style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: getSmallColor(stock.change_percent),
                          letterSpacing: '-0.01em',
                        }}>
                          {stock.change_percent > 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Başlıca İndeksler */}
      {!loading && indexes.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#9ca3af',
            marginBottom: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            ★ Başlıca İndeksler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {indexes.map(item => {
              const colors = getColor(item.change_percent);
              return (
                <div
                  key={item.ticker}
                  style={{
                    background: colors.bg,
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = 'translateY(-4px)';
                    el.style.boxShadow = `0 12px 24px ${colors.border}20`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    fontSize: 13,
                    color: '#d1d5db',
                    marginBottom: 12,
                  }}>
                    {item.name}
                  </div>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: colors.text,
                    letterSpacing: '-0.02em',
                  }}>
                    {item.change_percent > 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center',
          color: '#9ca3af',
          padding: '60px 0',
        }}>
          <div className="w-10 h-10 border-2 border-gray-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p style={{ fontSize: 14, margin: 0 }}>Sektor verileri yükleniyor...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{
          background: 'rgba(127, 29, 29, 0.3)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 12,
          padding: 20,
          color: '#fca5a5',
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 20,
        }}>
          <div style={{ marginBottom: 12 }}>⚠️ {error}</div>
          <button
            onClick={fetchHeatmapData}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = '#059669';
              el.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = '#10b981';
              el.style.transform = 'scale(1)';
            }}
          >
            Yeniden Yükle
          </button>
        </div>
      )}

      {/* Empty */}
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
    </div>
  );
}
