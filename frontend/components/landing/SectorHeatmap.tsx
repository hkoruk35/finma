'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';

const SECTOR_NAMES: Record<string, string> = {
  XLK: 'Teknoloji', XLF: 'Finans', XLV: 'Sağlık', XLY: 'İhtiyari',
  XLP: 'Temel', XLI: 'Sanayi', XLC: 'İletişim', XLE: 'Enerji',
  XLU: 'Kamu Hizm.', XLRE: 'Gayrimenkul', XLB: 'Hammadde',
};

const SECTOR_STOCKS: Record<string, string[]> = {
  XLK: ['AAPL', 'MSFT', 'NVDA', 'META'],
  XLF: ['JPM', 'BAC', 'GS', 'MS'],
  XLV: ['UNH', 'JNJ', 'LLY', 'ABBV'],
  XLY: ['AMZN', 'TSLA', 'HD', 'MCD'],
  XLI: ['GE', 'CAT', 'UNP', 'LMT'],
  XLC: ['GOOGL', 'NFLX', 'DIS', 'T'],
  XLP: ['PG', 'KO', 'PEP', 'WMT'],
  XLE: ['XOM', 'CVX', 'COP', 'SLB'],
  XLU: ['NEE', 'DUK', 'SO', 'EXC'],
  XLRE: ['PLD', 'AMT', 'CCI', 'EQIX'],
  XLB: ['LIN', 'APD', 'NEM', 'FCX'],
};

const ETF_ORDER = ['XLK', 'XLF', 'XLV', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLRE', 'XLB'];

interface SectorData { etf: string; sector: string; change_pct: number }
interface QuoteData  { ticker: string; change_pct: number }

function getHeatColor(change: number) {
  if (change >= 2)     return { bg: '#14532d', border: '#16a34a', text: '#86efac' };
  if (change >= 1)     return { bg: '#166534', border: '#22c55e', text: '#bbf7d0' };
  if (change >= 0)     return { bg: '#1a3a2a', border: '#15803d', text: '#86efac' };
  if (change >= -1)    return { bg: '#3b1f1f', border: '#f97316', text: '#fdba74' };
  if (change >= -2)    return { bg: '#4c1d1d', border: '#ef4444', text: '#fca5a5' };
  return               { bg: '#5f1111', border: '#dc2626', text: '#fca5a5' };
}

function SmallColor(change: number) {
  if (change >= 1)  return '#22c55e';
  if (change >= 0)  return '#86efac';
  if (change >= -1) return '#f97316';
  return '#ef4444';
}

export function SectorHeatmap() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [stocks, setStocks] = useState<Record<string, QuoteData>>({});
  const [lastUpdate, setLastUpdate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isFetching = useRef(false);

  const fetchData = async () => {
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      setError('');

      // Sektör ETF verileri (market/maps sayfasıyla aynı endpoint)
      const sData = await api.getSectors('1d');
      if (sData && sData.length > 0) {
        setSectors(sData);
      }

      // Bireysel hisse verileri (batch)
      const allTickers = Object.values(SECTOR_STOCKS).flat();
      const unique = Array.from(new Set(allTickers));
      const bData = await api.getBatchQuotes(unique);
      const map: Record<string, QuoteData> = {};
      (Array.isArray(bData) ? bData : []).forEach((q: any) => {
        if (q.symbol) map[q.symbol] = { ticker: q.symbol, change_pct: q.change_pct || 0 };
      });
      if (Object.keys(map).length > 0) {
        setStocks(map);
      }

      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setLastUpdate(now);
    } catch (e) {
      setError('Veri yüklenemedi');
      console.error('SectorHeatmap error:', e);
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3600_000); // saatte bir
    return () => clearInterval(interval);
  }, []);

  const heatmapData = ETF_ORDER.map(etf => {
    const apiSector = sectors.find(s => s.etf === etf);
    const change = apiSector?.change_pct ?? 0;
    return {
      etf,
      name: SECTOR_NAMES[etf] || etf,
      change,
      stocks: (SECTOR_STOCKS[etf] || []).map(t => ({
        ticker: t,
        change: stocks[t]?.change_pct ?? 0,
      })),
    };
  });

  return (
    <div style={{ marginTop: 80, marginBottom: 80, width: '100%' }}>
      {/* Başlık */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f5', marginBottom: 4 }}>
            📊 ABD Borsası Sektor Isı Haritası
          </div>
          {lastUpdate && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Son güncelleme: {lastUpdate}
            </div>
          )}
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid #374151',
            borderRadius: 8,
            color: '#9ca3af',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↻ Yenile
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
          <div className="w-8 h-8 border-2 border-gray-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
          <div style={{ fontSize: 13 }}>Sektor verileri yükleniyor…</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{
          background: 'rgba(127,29,29,0.3)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 10,
          padding: '16px 20px',
          color: '#fca5a5',
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          ⚠️ {error} &nbsp;
          <button onClick={fetchData} style={{
            background: '#10b981', color: '#000', border: 'none',
            borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && heatmapData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {heatmapData.map(sector => {
            const c = getHeatColor(sector.change);
            return (
              <div
                key={sector.etf}
                style={{
                  background: c.bg,
                  border: `1.5px solid ${c.border}`,
                  borderRadius: 12,
                  padding: 14,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 20px ${c.border}30`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                {/* Sektör başlık */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8, marginBottom: 2 }}>
                    {sector.etf}
                  </div>
                  <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 6 }}>
                    {sector.name}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>
                    {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                  </div>
                </div>

                {/* Alt hisseler 2x2 */}
                <div style={{ borderTop: `1px solid ${c.border}40`, paddingTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
                  {sector.stocks.map(stock => (
                    <div
                      key={stock.ticker}
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        border: `1px solid ${SmallColor(stock.change)}35`,
                        borderRadius: 6,
                        padding: '5px 4px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>
                        {stock.ticker}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: SmallColor(stock.change) }}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
