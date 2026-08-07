'use client';

import { useEffect, useState, useCallback } from 'react';

interface FunnelStage {
  stage: string;
  count: number;
  pctOfPrev: number | null;
}

interface SourceRow {
  source: string;
  sessions: number;
  browserLoaded: number;
  active5s: number;
  active15s: number;
  interacted: number;
  signupStarted: number;
  signupCompleted: number;
  withTwclid: number | null;
}

interface VisitorRow {
  sessionId: string;
  firstSeen: number;
  lastActivity: number;
  country: string | null;
  city: string | null;
  source: string;
  campaign: string | null;
  content: string | null;
  page: string;
  stage: string;
  ip: string | null;
  device: string | null;
  twclid: boolean;
  diagnosticSignals: string[];
  suspectedAutomation: boolean;
}

interface AuditResponse {
  totalSessions: number;
  auditLiveSince: number | null;
  funnel: FunnelStage[];
  sources: SourceRow[];
  campaigns: string[];
  contents: string[];
  countries: string[];
  visitors: VisitorRow[];
}

const SIGNAL_LABELS: Record<string, string> = {
  request_only: 'request_only',
  loaded_no_engagement: 'loaded_no_engagement',
  known_bot_user_agent: 'known_bot_ua',
  high_frequency_requests: 'high_frequency',
};

const ACCENT = '#58a6ff';
const CARD_BG = '#0d1117';
const BORDER_COLOR = '#30363d';
const TEXT_MAIN = '#e6edf3';
const TEXT_SECONDARY = '#8b949e';

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: CARD_BG,
  border: `1px solid ${BORDER_COLOR}`,
  borderRadius: 4,
  color: TEXT_MAIN,
  fontFamily: 'monospace',
  fontSize: 12,
};

const thStyle: React.CSSProperties = { padding: '10px 8px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 700, whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '8px', color: TEXT_MAIN };

export default function VisitorsPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterContent, setFilterContent] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeframe });
      if (filterCountry) params.set('country', filterCountry);
      if (filterSource) params.set('source', filterSource);
      if (filterCampaign) params.set('campaign', filterCampaign);
      if (filterContent) params.set('content', filterContent);
      const res = await fetch(`/api/admin/traffic-audit?${params}`);
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(Date.now());
      }
    } catch (err) {
      console.error('Failed to load traffic audit:', err);
    }
  }, [timeframe, filterCountry, filterSource, filterCampaign, filterContent]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month} ${hours}:${mins}:${secs}`;
  };

  const stageColor = (stage: string) => {
    if (stage === 'Converted') return '#3fb950';
    if (stage === 'Signup Started') return '#e3b341';
    if (stage === 'Interacted' || stage === 'Active 15s') return ACCENT;
    if (stage === 'Request Only') return '#f85149';
    return TEXT_SECONDARY;
  };

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: TEXT_MAIN }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 4 }}>
        🌍 First-Party Traffic Audit
      </h1>
      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 8 }}>
        Landing Request → Browser Loaded → 5s Active → 15s Active → Interaction → Signup Start → Signup Complete — GA4/X Ads'e bağımlı olmayan first-party ölçüm.
      </p>
      {data?.auditLiveSince && (
        <p style={{ fontSize: 11, color: '#e3b341', marginBottom: 20 }}>
          ⏱ Ölçüm başlangıcı (instrumentation live since): <strong>{formatTime(data.auditLiveSince)}</strong> — X Ads karşılaştırması sadece bu andan sonraki trafik için geçerli.
        </p>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Toplam Session</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>{data?.totalSessions ?? '—'}</div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Ülke Sayısı</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>{data?.countries.length ?? '—'}</div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Kaynak Sayısı</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>{data?.sources.length ?? '—'}</div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>Son Güncelleme</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MAIN, marginTop: 6 }}>{formatTime(lastUpdate)}</div>
        </div>
      </div>

      {/* Timeframe */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 8 }}>ZAMAN ARALIĞI</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>ÜLKE</label>
          <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={selectStyle}>
            <option value="">Tümü</option>
            {(data?.countries ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>KAYNAK (SOURCE)</label>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={selectStyle}>
            <option value="">Tümü</option>
            {(data?.sources ?? []).map((s) => <option key={s.source} value={s.source}>{s.source}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>KAMPANYA (utm_campaign)</label>
          <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} style={selectStyle}>
            <option value="">Tümü</option>
            {(data?.campaigns ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>REKLAM (utm_content)</label>
          <select value={filterContent} onChange={(e) => setFilterContent(e.target.value)} style={selectStyle}>
            <option value="">Tümü</option>
            {(data?.contents ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Traffic Funnel */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 8 }}>TRAFFIC FUNNEL</label>
        <div style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, overflow: 'hidden' }}>
          {(data?.funnel ?? []).map((f) => (
            <div
              key={f.stage}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderBottom: `1px solid ${BORDER_COLOR}`, fontSize: 12,
              }}
            >
              <div style={{ width: 160, color: TEXT_MAIN, fontWeight: 700 }}>{f.stage}</div>
              <div style={{ flex: 1, background: '#161b22', borderRadius: 3, height: 10, overflow: 'hidden' }}>
                <div
                  style={{
                    width: data && data.funnel[0].count > 0 ? `${Math.round((f.count / data.funnel[0].count) * 100)}%` : '0%',
                    background: ACCENT, height: '100%',
                  }}
                />
              </div>
              <div style={{ width: 130, textAlign: 'right', color: TEXT_MAIN, fontWeight: 700 }}>{f.count}</div>
              <div style={{ width: 70, textAlign: 'right', color: TEXT_SECONDARY }}>
                {f.pctOfPrev === null ? '—' : `${f.pctOfPrev}%`}
              </div>
            </div>
          ))}
          {(!data || data.funnel.length === 0) && (
            <div style={{ padding: 16, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 12 }}>Veri yok.</div>
          )}
        </div>
      </div>

      {/* Traffic Sources */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 8 }}>TRAFFIC SOURCES</label>
        <div style={{ overflowX: 'auto', border: `1px solid ${BORDER_COLOR}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: '#161b22', borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <th style={thStyle}>SOURCE</th>
                <th style={thStyle}>SESSIONS</th>
                <th style={thStyle}>LOADED</th>
                <th style={thStyle}>ACTIVE 5S</th>
                <th style={thStyle}>ACTIVE 15S</th>
                <th style={thStyle}>INTERACTED</th>
                <th style={thStyle}>SIGNUP START</th>
                <th style={thStyle}>SIGNUP DONE</th>
                <th style={thStyle}>TWCLID</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sources ?? []).length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: TEXT_SECONDARY }}>Veri yok.</td></tr>
              ) : (
                data!.sources.map((s) => (
                  <tr key={s.source} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: ACCENT }}>{s.source}</td>
                    <td style={tdStyle}>{s.sessions}</td>
                    <td style={tdStyle}>{s.browserLoaded}</td>
                    <td style={tdStyle}>{s.active5s}</td>
                    <td style={tdStyle}>{s.active15s}</td>
                    <td style={tdStyle}>{s.interacted}</td>
                    <td style={tdStyle}>{s.signupStarted}</td>
                    <td style={tdStyle}>{s.signupCompleted}</td>
                    <td style={tdStyle}>{s.withTwclid === null ? '—' : `${s.withTwclid}/${s.sessions}`}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visitor Detail */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 8 }}>VISITOR DETAIL</label>
        <div style={{ overflowX: 'auto', border: `1px solid ${BORDER_COLOR}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: '#161b22', borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <th style={thStyle}>FIRST SEEN</th>
                <th style={thStyle}>LAST ACTIVITY</th>
                <th style={thStyle}>COUNTRY/CITY</th>
                <th style={thStyle}>SOURCE</th>
                <th style={thStyle}>CAMPAIGN</th>
                <th style={thStyle}>PAGE</th>
                <th style={thStyle}>STAGE</th>
                <th style={thStyle}>IP</th>
                <th style={thStyle}>DEVICE</th>
                <th style={thStyle}>FLAG</th>
              </tr>
            </thead>
            <tbody>
              {(data?.visitors ?? []).length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: TEXT_SECONDARY }}>Ziyaretçi bulunamadı.</td></tr>
              ) : (
                data!.visitors.map((v) => (
                  <tr key={v.sessionId} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={tdStyle}>{formatTime(v.firstSeen)}</td>
                    <td style={tdStyle}>{formatTime(v.lastActivity)}</td>
                    <td style={tdStyle}>
                      <div>{v.country}</div>
                      <div style={{ fontSize: 10, color: TEXT_SECONDARY }}>{v.city}</div>
                    </td>
                    <td style={tdStyle}>
                      {v.source}
                      {v.twclid && <span style={{ marginLeft: 6, fontSize: 9, color: '#3fb950' }}>twclid</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: TEXT_SECONDARY }}>{v.campaign || '—'}{v.content ? ` / ${v.content}` : ''}</td>
                    <td style={{ ...tdStyle, maxWidth: 180, wordBreak: 'break-word' }}>{v.page}</td>
                    <td style={{ ...tdStyle, color: stageColor(v.stage), fontWeight: 700 }}>{v.stage}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: TEXT_SECONDARY }}>{v.ip}</td>
                    <td style={tdStyle}>{v.device}</td>
                    <td style={{ ...tdStyle, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {v.suspectedAutomation && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#f85149', border: '1px solid #f85149', borderRadius: 4, padding: '2px 6px' }}>
                          suspected_automation
                        </span>
                      )}
                      {v.diagnosticSignals.map((sig) => (
                        <span key={sig} style={{ fontSize: 9, color: TEXT_SECONDARY, border: `1px solid ${BORDER_COLOR}`, borderRadius: 4, padding: '2px 6px' }}>
                          {SIGNAL_LABELS[sig] ?? sig}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>
        Gösterilen: {data?.visitors.length ?? 0} session (en fazla 500) | Her 10 saniyede otomatik yenilenir
      </div>
    </div>
  );
}
