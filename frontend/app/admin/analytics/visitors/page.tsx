'use client';

import { useEffect, useState, useCallback } from 'react';

interface Visitor {
  id: string;
  ip: string;
  country: string;
  city: string;
  page: string;
  timestamp: number;
  userAgent: string;
  sessionStart: number;
}

const ACCENT = '#58a6ff';
const CARD_BG = '#0d1117';
const BORDER_COLOR = '#30363d';
const TEXT_MAIN = '#e6edf3';
const TEXT_SECONDARY = '#8b949e';

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeframe });
      const res = await fetch(`/api/admin/visitors?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVisitors(data.visitors ?? []);
        setLastUpdate(Date.now());
      }
    } catch (err) {
      console.error('Failed to load visitors:', err);
    }
  }, [timeframe]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = visitors.filter((v) => {
    if (filterCountry && v.country !== filterCountry) return false;
    if (filterPage && !v.page.includes(filterPage)) return false;
    return true;
  });

  const countries = Array.from(new Set(visitors.map((v) => v.country))).sort();
  const pages = Array.from(new Set(visitors.map((v) => v.page))).sort();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  const countryStats = Object.entries(
    filtered.reduce<Record<string, number>>((acc, v) => {
      acc[v.country] = (acc[v.country] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: TEXT_MAIN }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 20 }}>
        🌍 Site Ziyaretçileri
      </h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Toplam Ziyaretçi</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>
            {visitors.length}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Ülke Sayısı</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>
            {countries.length}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Sayfa Sayısı</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>
            {pages.length}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Son Güncelleme</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MAIN, marginTop: 6 }}>
            {formatTime(lastUpdate)}
          </div>
        </div>
      </div>

      {/* Timeframe */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 8 }}>
          ZAMAN ARALIGI
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '8px 12px',
                background: timeframe === tf ? ACCENT : CARD_BG,
                border: `1px solid ${timeframe === tf ? ACCENT : BORDER_COLOR}`,
                borderRadius: 4,
                color: timeframe === tf ? '#0d1117' : TEXT_MAIN,
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tf === '24h' ? 'Son 24 Saat' : tf === '7d' ? 'Son 7 Gün' : tf === '30d' ? 'Son 30 Gün' : 'Tümü'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
            ÜLKE FİLTRESİ
          </label>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: CARD_BG,
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: 4,
              color: TEXT_MAIN,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            <option value="">Tümü</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
            SAYFA FİLTRESİ
          </label>
          <input
            type="text"
            placeholder="Sayfa URL'si ara..."
            value={filterPage}
            onChange={(e) => setFilterPage(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: CARD_BG,
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: 4,
              color: TEXT_MAIN,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          />
        </div>
      </div>

      {/* Ülke Bazlı İstatistikler */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 8 }}>
          ÜLKE BAZLI İSTATİSTİKLER
        </label>
        <div style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, overflow: 'hidden' }}>
          {countryStats.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 12 }}>
              Veri yok.
            </div>
          ) : (
            countryStats.map(([country, count]) => {
              const pct = filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0;
              return (
                <div
                  key={country}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ width: 90, color: TEXT_MAIN, fontWeight: 700 }}>{country}</div>
                  <div style={{ flex: 1, background: '#161b22', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: ACCENT, height: '100%' }} />
                  </div>
                  <div style={{ width: 70, textAlign: 'right', color: TEXT_SECONDARY }}>
                    {count} ({pct}%)
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${BORDER_COLOR}`, borderRadius: 6 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          <thead>
            <tr style={{ background: '#161b22', borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                GİRİŞ ZAMANI
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                ÇIKIŞ ZAMANI
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                ÜLKE/ŞEHİR
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                SAYFA
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                IP
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: TEXT_SECONDARY }}>
                  Ziyaretçi bulunamadı. Site'de gezinti yap veya filtreleri kontrol et.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                  <td style={{ padding: '10px', color: TEXT_MAIN }}>
                    {formatTime(v.sessionStart)}
                  </td>
                  <td style={{ padding: '10px', color: TEXT_MAIN }}>
                    {formatTime(v.timestamp)}
                  </td>
                  <td style={{ padding: '10px', color: TEXT_MAIN }}>
                    <div>{v.country}</div>
                    <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{v.city}</div>
                  </td>
                  <td style={{ padding: '10px', color: TEXT_MAIN, maxWidth: 200 }}>
                    <div style={{ wordBreak: 'break-word' }}>{v.page}</div>
                  </td>
                  <td style={{ padding: '10px', color: TEXT_SECONDARY, fontSize: 11 }}>
                    {v.ip}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: TEXT_SECONDARY }}>
        Gösterilen: {filtered.length} / {visitors.length} | Her 3 saniyede otomatik yenilenir
      </div>
    </div>
  );
}
