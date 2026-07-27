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
  duration: number;
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

  const getDurationColor = (seconds: number) => {
    if (seconds < 60) return '#3fb950'; // green <1min
    if (seconds < 300) return '#e3b341'; // yellow 1-5min
    return '#f85149'; // red >5min
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
                ZAMAN
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                ÜLKE/ŞEHİR
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                SAYFA
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700 }}>
                KALMA SÜRESİ
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
                    {formatTime(v.timestamp)}
                  </td>
                  <td style={{ padding: '10px', color: TEXT_MAIN }}>
                    <div>{v.country}</div>
                    <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{v.city}</div>
                  </td>
                  <td style={{ padding: '10px', color: TEXT_MAIN, maxWidth: 200 }}>
                    <div style={{ wordBreak: 'break-word' }}>{v.page}</div>
                  </td>
                  <td style={{ padding: '10px', color: getDurationColor(v.duration), fontWeight: 700 }}>
                    {formatDuration(v.duration)}
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
