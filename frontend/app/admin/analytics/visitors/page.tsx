'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

interface FunnelStage {
  stage: string;
  count: number;
  pctOfPrev: number | null;
  pctOfTop: number;
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
  human: number;
  withTwclid: number | null;
}

interface BreakdownRow {
  key: string;
  sessions: number;
  human: number;
  bot: number;
  loaded: number;
  engaged: number;
  conversions: number;
}

interface SeriesPoint {
  ts: number;
  sessions: number;
  visitors: number;
  human: number;
  bot: number;
  loaded: number;
  engaged: number;
  conversions: number;
}

interface ComparisonMetric {
  key: string;
  label: string;
  current: number;
  previous: number;
  changePct: number | null;
}

interface VisitorRow {
  sessionId: string;
  visitorId: string;
  firstSeen: number;
  lastActivity: number;
  country: string | null;
  city: string | null;
  source: string;
  campaign: string | null;
  content: string | null;
  page: string;
  stage: string;
  audience: 'bot' | 'verified_human' | 'unverified';
  ip: string | null;
  device: string | null;
  userAgent: string | null;
  twclid: boolean;
  pageRequests: number;
  diagnosticSignals: string[];
  suspectedAutomation: boolean;
}

interface AuditResponse {
  timeframe: string;
  generatedAt: number;
  dataFetchedAt: number;
  windowStart: number | null;
  windowEnd: number;
  bucketMs: number;
  auditLiveSince: number | null;
  scan: { totalRowsInWindow: number; scanned: number; truncated: boolean; maxScanRows: number };
  excluded: { assetNoise: number; scannerProbes: number };
  overview: {
    sessions: number;
    uniqueVisitors: number;
    returningVisitors: number;
    pageViews: number;
    pageViewsPerSession: number;
    verifiedHumanSessions: number;
    humanUniqueVisitors: number;
    botSessions: number;
    unverifiedSessions: number;
    loadedSessions: number;
    engagedSessions: number;
    deepEngagedSessions: number;
    interactedSessions: number;
    signupStarted: number;
    conversions: number;
    bounceRate: number | null;
    avgEngagementSeconds: number;
    conversionRate: number;
  };
  comparison: {
    previousStart: number;
    previousEnd: number | null;
    suppressedByFilter: boolean;
    metrics: ComparisonMetric[];
  } | null;
  series: SeriesPoint[];
  funnel: FunnelStage[];
  sources: SourceRow[];
  countries: BreakdownRow[];
  devices: BreakdownRow[];
  landingPages: BreakdownRow[];
  referrers: BreakdownRow[];
  botAgents: { agent: string; sessions: number }[];
  options: { countries: string[]; sources: string[]; campaigns: string[]; contents: string[]; devices: string[] };
  visitors: VisitorRow[];
  visitorLimit: number;
}

const SIGNAL_LABELS: Record<string, string> = {
  request_only: 'request_only',
  loaded_no_engagement: 'loaded_no_engagement',
  known_bot: 'known_bot',
  scanner_probe: 'scanner_probe',
  abnormal_navigation_rate: 'abnormal_navigation_rate',
};

const ACCENT = '#58a6ff';
const CARD_BG = '#0d1117';
const PANEL_BG = '#161b22';
const BORDER_COLOR = '#30363d';
const TEXT_MAIN = '#e6edf3';
const TEXT_SECONDARY = '#8b949e';
const GREEN = '#3fb950';
const RED = '#f85149';
const AMBER = '#e3b341';

const TIMEFRAME_LABELS: Record<string, string> = {
  '24h': 'Son 24 Saat',
  '7d': 'Son 7 Gün (Haftalık)',
  '30d': 'Son 30 Gün (Aylık)',
  all: 'Tümü',
};

const SEGMENTS: { key: string; label: string; hint: string }[] = [
  { key: 'all', label: 'Tüm Trafik', hint: 'Bot dahil her oturum' },
  { key: 'verified_human', label: 'Doğrulanmış İnsan', hint: 'Tarayıcıda JS çalıştı (page_loaded)' },
  { key: 'unverified', label: 'Doğrulanmamış', hint: 'İnsan User-Agent ama JS hiç çalışmadı' },
  { key: 'bot', label: 'Bot / Crawler', hint: 'User-Agent kendini bot olarak tanıtıyor' },
];

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

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'left',
  color: TEXT_SECONDARY,
  fontWeight: 700,
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '8px', color: TEXT_MAIN };
const numTd: React.CSSProperties = { ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' };
const numTh: React.CSSProperties = { ...thStyle, textAlign: 'right' };

const panelStyle: React.CSSProperties = {
  border: `1px solid ${BORDER_COLOR}`,
  borderRadius: 6,
  overflow: 'hidden',
  background: CARD_BG,
};

const nf = new Intl.NumberFormat('tr-TR');
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(n));

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 11, color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 0.4 }}>{children}</label>
      {hint && <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 14 }}>
      <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color ?? TEXT_MAIN, marginTop: 6, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BreakdownTable({
  title,
  hint,
  keyHeader,
  rows,
  emptyText,
}: {
  title: string;
  hint?: string;
  keyHeader: string;
  rows: BreakdownRow[];
  emptyText: string;
}) {
  const max = rows.length > 0 ? rows[0].sessions : 0;
  return (
    <div>
      <SectionLabel hint={hint}>{title}</SectionLabel>
      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <th style={thStyle}>{keyHeader}</th>
              <th style={numTh}>OTURUM</th>
              <th style={numTh}>İNSAN</th>
              <th style={numTh}>BOT</th>
              <th style={numTh}>5SN AKTİF</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: TEXT_SECONDARY }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                  <td style={{ ...tdStyle, maxWidth: 260, wordBreak: 'break-all', position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: max > 0 ? `${(r.sessions / max) * 100}%` : '0%',
                        background: 'rgba(88,166,255,0.10)',
                      }}
                    />
                    <span style={{ position: 'relative' }}>{r.key}</span>
                  </td>
                  <td style={{ ...numTd, fontWeight: 700 }}>{fmt(r.sessions)}</td>
                  <td style={{ ...numTd, color: r.human > 0 ? GREEN : TEXT_SECONDARY }}>{fmt(r.human)}</td>
                  <td style={{ ...numTd, color: r.bot > 0 ? RED : TEXT_SECONDARY }}>{fmt(r.bot)}</td>
                  <td style={numTd}>{fmt(r.engaged)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrafficChart({ series, bucketMs }: { series: SeriesPoint[]; bucketMs: number }) {
  const hourly = bucketMs < 24 * 60 * 60 * 1000;
  const max = series.reduce((m, p) => Math.max(m, p.sessions), 0);
  if (series.length === 0) {
    return (
      <div style={{ ...panelStyle, padding: 24, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 12 }}>
        Bu aralıkta veri yok.
      </div>
    );
  }

  const labelFor = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return hourly ? `${pad(d.getHours())}:00` : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  };
  const labelEvery = Math.max(1, Math.ceil(series.length / 12));

  return (
    <div style={{ ...panelStyle, padding: '16px 12px 8px' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 10, color: TEXT_SECONDARY }}>
        <span>
          <span style={{ display: 'inline-block', width: 9, height: 9, background: GREEN, marginRight: 5 }} />
          Doğrulanmış İnsan
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 9, height: 9, background: TEXT_SECONDARY, marginRight: 5 }} />
          Doğrulanmamış
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 9, height: 9, background: RED, marginRight: 5 }} />
          Bot / Crawler
        </span>
        <span style={{ marginLeft: 'auto' }}>Tepe: {fmt(max)} oturum / {hourly ? 'saat' : 'gün'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 180, overflowX: 'auto' }}>
        {series.map((p) => {
          const unverified = Math.max(0, p.sessions - p.human - p.bot);
          const h = (n: number) => (max > 0 ? (n / max) * 160 : 0);
          return (
            <div
              key={p.ts}
              title={`${labelFor(p.ts)}\nOturum: ${fmt(p.sessions)}\nTekil ziyaretçi: ${fmt(p.visitors)}\nDoğrulanmış insan: ${fmt(p.human)}\nDoğrulanmamış: ${fmt(unverified)}\nBot: ${fmt(p.bot)}\n5sn aktif: ${fmt(p.engaged)}\nKayıt: ${fmt(p.conversions)}`}
              style={{
                flex: '1 0 10px',
                minWidth: 8,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                height: '100%',
                cursor: 'default',
              }}
            >
              <div style={{ height: h(p.bot), background: RED }} />
              <div style={{ height: h(unverified), background: TEXT_SECONDARY }} />
              <div style={{ height: h(p.human), background: GREEN }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {series.map((p, i) => (
          <div
            key={p.ts}
            style={{
              flex: '1 0 10px',
              minWidth: 8,
              fontSize: 9,
              color: TEXT_SECONDARY,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {i % labelEvery === 0 ? labelFor(p.ts) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VisitorsPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [segment, setSegment] = useState('all');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterContent, setFilterContent] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [detailCursor, setDetailCursor] = useState<{ key: string; page: number }>({ key: '', page: 0 });
  // Detay tablosu 500 satiri birden DOM'a basiyordu (~34.000px yukseklik).
  // Sunucu hala 500 satir gonderiyor (hicbir veri kaybi yok), sayfa sadece
  // 50'lik dilimler halinde render ediyor. Sayfa numarasi sorgu anahtariyla
  // BIRLIKTE tutuluyor: filtre/aralik degisince effect'e gerek kalmadan
  // kendiliginden 1. sayfaya doner.

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ timeframe, segment });
      if (filterCountry) params.set('country', filterCountry);
      if (filterSource) params.set('source', filterSource);
      if (filterCampaign) params.set('campaign', filterCampaign);
      if (filterContent) params.set('content', filterContent);
      if (filterDevice) params.set('device', filterDevice);
      const res = await fetch(`/api/admin/traffic-audit?${params}`);
      if (res.ok) {
        setData(await res.json());
        setError(null);
        setLastUpdate(Date.now());
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [timeframe, segment, filterCountry, filterSource, filterCampaign, filterContent, filterDevice]);

  useEffect(() => {
    load();
    // Sunucu tarafinda ham veri 60sn cache'leniyor — daha sik yenilemek ayni
    // yaniti tekrar tekrar cekmekten baska bir sey yapmaz.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())}.${p(date.getMonth() + 1)} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  };

  const stageColor = (stage: string) => {
    if (stage === 'Converted') return GREEN;
    if (stage === 'Signup Started') return AMBER;
    if (stage === 'Interacted' || stage === 'Active 15s') return ACCENT;
    if (stage === 'Request Only') return RED;
    return TEXT_SECONDARY;
  };

  const audienceBadge = (audience: VisitorRow['audience']) => {
    if (audience === 'verified_human') return { text: 'insan', color: GREEN };
    if (audience === 'bot') return { text: 'bot', color: RED };
    return { text: 'doğrulanmamış', color: TEXT_SECONDARY };
  };

  const ov = data?.overview;
  const activeFilterCount = useMemo(
    () =>
      [filterCountry, filterSource, filterCampaign, filterContent, filterDevice].filter(Boolean).length +
      (segment !== 'all' ? 1 : 0),
    [filterCountry, filterSource, filterCampaign, filterContent, filterDevice, segment]
  );

  const DETAIL_PAGE_SIZE = 50;
  const detailQueryKey = [timeframe, segment, filterCountry, filterSource, filterCampaign, filterContent, filterDevice].join('|');
  const detailPage = detailCursor.key === detailQueryKey ? detailCursor.page : 0;
  const setDetailPage = (next: number | ((prev: number) => number)) =>
    setDetailCursor({ key: detailQueryKey, page: typeof next === 'function' ? next(detailPage) : next });
  const detailTotal = data?.visitors.length ?? 0;
  const detailPageCount = Math.max(1, Math.ceil(detailTotal / DETAIL_PAGE_SIZE));
  const safeDetailPage = Math.min(detailPage, detailPageCount - 1);
  const pagedVisitors = useMemo(
    () => (data?.visitors ?? []).slice(safeDetailPage * DETAIL_PAGE_SIZE, (safeDetailPage + 1) * DETAIL_PAGE_SIZE),
    [data, safeDetailPage]
  );

  const clearFilters = () => {
    setFilterCountry('');
    setFilterSource('');
    setFilterCampaign('');
    setFilterContent('');
    setFilterDevice('');
    setSegment('all');
  };

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: TEXT_MAIN }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 4 }}>🌍 Site Trafik Raporu</h1>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
          {TIMEFRAME_LABELS[timeframe]} · {data ? formatTime(data.windowEnd) : '—'}
        </span>
        <button
          onClick={load}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            background: CARD_BG,
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: 4,
            color: loading ? TEXT_SECONDARY : TEXT_MAIN,
            fontFamily: 'monospace',
            fontSize: 12,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '⏳ Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 8 }}>
        Landing Request → Browser Loaded → 5s / 15s / 30s Active → Interaction → Signup Start → Signup Complete —
        GA4/X Ads&apos;e bağımlı olmayan first-party ölçüm.
      </p>

      {error && (
        <p style={{ fontSize: 12, color: RED, marginBottom: 8 }}>⚠ Rapor yüklenemedi: {error}</p>
      )}

      {data?.auditLiveSince && (
        <p style={{ fontSize: 11, color: AMBER, marginBottom: 4 }}>
          ⏱ Ölçüm başlangıcı (instrumentation live since): <strong>{formatTime(data.auditLiveSince)}</strong> — X Ads
          karşılaştırması sadece bu andan sonraki trafik için geçerli.
        </p>
      )}
      {data && (
        <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4 }}>
          🛡 Rapordan çıkarılan gürültü: <strong>{fmt(data.excluded.scannerProbes)}</strong> güvenlik/scanner probe
          (wp-admin, xmlrpc.php vb.) + <strong>{fmt(data.excluded.assetNoise)}</strong> statik dosya isteği. Ham
          kayıtlar silinmedi. Taranan satır: <strong>{fmt(data.scan.scanned)}</strong> /{' '}
          {fmt(data.scan.totalRowsInWindow)}.
        </p>
      )}
      {data?.scan.truncated && (
        <p style={{ fontSize: 11, color: RED, marginBottom: 4 }}>
          ⚠ Bu aralıkta {fmt(data.scan.totalRowsInWindow)} oturum var, tarama sınırı {fmt(data.scan.maxScanRows)}.
          Rapor EN YENİ {fmt(data.scan.maxScanRows)} oturumu kapsıyor — daha kısa bir zaman aralığı seçin.
        </p>
      )}
      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 20 }}>
        Veri anlık görüntüsü: {data ? formatTime(data.dataFetchedAt) : '—'} · Ekran güncellemesi:{' '}
        {lastUpdate ? formatTime(lastUpdate) : '—'} · 60 saniyede bir otomatik yenilenir
      </p>

      {/* Timeframe */}
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>ZAMAN ARALIĞI</SectionLabel>
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
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>
      </div>

      {/* Segment */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel hint="Trafiğin ezici çoğunluğu crawler'dır — gerçek kullanıcı sayısı için 'Doğrulanmış İnsan' segmentini kullanın.">
          KİTLE SEGMENTİ
        </SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              title={s.hint}
              style={{
                padding: '8px 12px',
                background: segment === s.key ? PANEL_BG : CARD_BG,
                border: `1px solid ${segment === s.key ? ACCENT : BORDER_COLOR}`,
                borderRadius: 4,
                color: segment === s.key ? ACCENT : TEXT_MAIN,
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Oturum"
          value={fmt(ov?.sessions)}
          sub={`${fmt(ov?.uniqueVisitors)} tekil ziyaretçi · ${fmt(ov?.returningVisitors)} tekrar gelen`}
        />
        <StatCard
          label="Sayfa Görüntüleme"
          value={fmt(ov?.pageViews)}
          sub={`Oturum başına ${ov?.pageViewsPerSession ?? '—'}`}
        />
        <StatCard
          label="Doğrulanmış İnsan"
          value={fmt(ov?.verifiedHumanSessions)}
          sub={`${fmt(ov?.humanUniqueVisitors)} tekil kişi`}
          color={GREEN}
        />
        <StatCard
          label="Bot / Crawler"
          value={fmt(ov?.botSessions)}
          sub={`${fmt(ov?.unverifiedSessions)} doğrulanmamış`}
          color={RED}
        />
        <StatCard
          label="5sn Aktif"
          value={fmt(ov?.engagedSessions)}
          sub={`30sn: ${fmt(ov?.deepEngagedSessions)} · etkileşim: ${fmt(ov?.interactedSessions)}`}
        />
        <StatCard
          label="Hemen Çıkma"
          value={ov?.bounceRate === null || ov?.bounceRate === undefined ? '—' : `%${ov.bounceRate}`}
          sub="Yüklendi ama 5sn kalmadı"
          color={AMBER}
        />
        <StatCard
          label="Ort. Süre"
          value={ov ? `${ov.avgEngagementSeconds} sn` : '—'}
          sub="İlk istek → son aktivite"
        />
        <StatCard
          label="Kayıt Tamamlandı"
          value={fmt(ov?.conversions)}
          sub={`Başlayan: ${fmt(ov?.signupStarted)} · dönüşüm %${ov?.conversionRate ?? 0}`}
          color={GREEN}
        />
      </div>

      {/* Previous period comparison */}
      {data?.comparison && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel
            hint={
              data.comparison.suppressedByFilter
                ? 'Filtre uygulanmışken önceki dönem karşılaştırması gösterilmez (önceki dönem sayıları filtresiz sayımdan gelir, yanlış kıyas olurdu).'
                : `Önceki eşit uzunluktaki dönem: ${formatTime(data.comparison.previousStart)} → ${
                    data.comparison.previousEnd ? formatTime(data.comparison.previousEnd) : '—'
                  }`
            }
          >
            ÖNCEKİ DÖNEME GÖRE
          </SectionLabel>
          {data.comparison.suppressedByFilter ? (
            <div style={{ ...panelStyle, padding: 14, fontSize: 12, color: TEXT_SECONDARY }}>
              Filtreleri temizleyince karşılaştırma görünür.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12,
              }}
            >
              {data.comparison.metrics.map((m) => {
                const up = m.changePct !== null && m.changePct > 0;
                const down = m.changePct !== null && m.changePct < 0;
                return (
                  <div
                    key={m.key}
                    style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, padding: 14 }}
                  >
                    <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>{fmt(m.current)}</div>
                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        color: up ? GREEN : down ? RED : TEXT_SECONDARY,
                        fontWeight: 700,
                      }}
                    >
                      {m.changePct === null ? 'yeni' : `${up ? '▲' : down ? '▼' : '='} %${Math.abs(m.changePct)}`}
                      <span style={{ color: TEXT_SECONDARY, fontWeight: 400 }}> (önceki: {fmt(m.previous)})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Time series */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel hint={data && data.bucketMs < 86400000 ? 'Saatlik kırılım' : 'Günlük kırılım'}>
          ZAMAN SERİSİ
        </SectionLabel>
        <TrafficChart series={data?.series ?? []} bucketMs={data?.bucketMs ?? 3600000} />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <SectionLabel>FİLTRELER</SectionLabel>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              style={{
                marginBottom: 8,
                padding: '4px 10px',
                background: CARD_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 4,
                color: AMBER,
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ✕ {activeFilterCount} filtreyi temizle
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>ÜLKE</label>
            <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={selectStyle}>
              <option value="">Tümü</option>
              {(data?.options.countries ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
              KAYNAK (SOURCE)
            </label>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={selectStyle}>
              <option value="">Tümü</option>
              {(data?.options.sources ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>CİHAZ</label>
            <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)} style={selectStyle}>
              <option value="">Tümü</option>
              {(data?.options.devices ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
              KAMPANYA (utm_campaign)
            </label>
            <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} style={selectStyle}>
              <option value="">Tümü</option>
              {(data?.options.campaigns ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
              REKLAM (utm_content)
            </label>
            <select value={filterContent} onChange={(e) => setFilterContent(e.target.value)} style={selectStyle}>
              <option value="">Tümü</option>
              {(data?.options.contents ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Traffic Funnel */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel hint="Yüzdeler: bir önceki adıma göre / toplam istek içindeki pay">TRAFFIC FUNNEL</SectionLabel>
        <div style={panelStyle}>
          {(data?.funnel ?? []).map((f) => (
            <div
              key={f.stage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderBottom: `1px solid ${BORDER_COLOR}`,
                fontSize: 12,
              }}
            >
              <div style={{ width: 160, color: TEXT_MAIN, fontWeight: 700 }}>{f.stage}</div>
              <div style={{ flex: 1, background: PANEL_BG, borderRadius: 3, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${f.pctOfTop}%`, background: ACCENT, height: '100%' }} />
              </div>
              <div style={{ width: 110, textAlign: 'right', color: TEXT_MAIN, fontWeight: 700 }}>{fmt(f.count)}</div>
              <div style={{ width: 70, textAlign: 'right', color: TEXT_SECONDARY }}>
                {f.pctOfPrev === null ? '—' : `%${f.pctOfPrev}`}
              </div>
              <div style={{ width: 70, textAlign: 'right', color: TEXT_SECONDARY, fontSize: 11 }}>%{f.pctOfTop}</div>
            </div>
          ))}
          {(!data || data.funnel.length === 0) && (
            <div style={{ padding: 16, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 12 }}>Veri yok.</div>
          )}
        </div>
      </div>

      {/* Traffic Sources */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel>TRAFFIC SOURCES</SectionLabel>
        <div style={{ ...panelStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <th style={thStyle}>SOURCE</th>
                <th style={numTh}>SESSIONS</th>
                <th style={numTh}>İNSAN</th>
                <th style={numTh}>LOADED</th>
                <th style={numTh}>ACTIVE 5S</th>
                <th style={numTh}>ACTIVE 15S</th>
                <th style={numTh}>INTERACTED</th>
                <th style={numTh}>SIGNUP START</th>
                <th style={numTh}>SIGNUP DONE</th>
                <th style={numTh}>TWCLID</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sources ?? []).length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: TEXT_SECONDARY }}>
                    Veri yok.
                  </td>
                </tr>
              ) : (
                data!.sources.map((s) => (
                  <tr key={s.source} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: ACCENT }}>{s.source}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{fmt(s.sessions)}</td>
                    <td style={{ ...numTd, color: s.human > 0 ? GREEN : TEXT_SECONDARY }}>{fmt(s.human)}</td>
                    <td style={numTd}>{fmt(s.browserLoaded)}</td>
                    <td style={numTd}>{fmt(s.active5s)}</td>
                    <td style={numTd}>{fmt(s.active15s)}</td>
                    <td style={numTd}>{fmt(s.interacted)}</td>
                    <td style={numTd}>{fmt(s.signupStarted)}</td>
                    <td style={numTd}>{fmt(s.signupCompleted)}</td>
                    <td style={numTd}>{s.withTwclid === null ? '—' : `${s.withTwclid}/${s.sessions}`}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdowns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
          marginBottom: 24,
        }}
      >
        <BreakdownTable
          title="ÜLKELER"
          keyHeader="ÜLKE"
          rows={data?.countries ?? []}
          emptyText="Veri yok."
          hint="En çok oturum üreten 25 ülke"
        />
        <BreakdownTable title="CİHAZLAR" keyHeader="CİHAZ" rows={data?.devices ?? []} emptyText="Veri yok." />
        <BreakdownTable
          title="YÖNLENDİREN SİTELER"
          keyHeader="REFERRER"
          rows={data?.referrers ?? []}
          emptyText="Veri yok."
          hint="Oturumun ilk isteğindeki referrer host'u"
        />
        <BreakdownTable
          title="GİRİŞ SAYFALARI"
          keyHeader="LANDING PAGE"
          rows={data?.landingPages ?? []}
          emptyText="Veri yok."
          hint="Oturumun başladığı sayfa (toplam sayfa görüntüleme değil)"
        />
      </div>

      {/* Bot agents */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel hint="Bu liste sadece raporlama içindir; robots.txt izin listesini (botUserAgents.ts) etkilemez.">
          EN ÇOK GELEN BOT / CRAWLER
        </SectionLabel>
        <div style={{ ...panelStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <th style={thStyle}>USER-AGENT</th>
                <th style={numTh}>OTURUM</th>
              </tr>
            </thead>
            <tbody>
              {(data?.botAgents ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 20, textAlign: 'center', color: TEXT_SECONDARY }}>
                    Bu aralıkta bot trafiği yok.
                  </td>
                </tr>
              ) : (
                data!.botAgents.map((b) => (
                  <tr key={b.agent} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={{ ...tdStyle, fontSize: 11, color: TEXT_SECONDARY, wordBreak: 'break-all' }}>
                      {b.agent}
                    </td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{fmt(b.sessions)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visitor Detail */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>ZİYARETÇİ DETAYI</SectionLabel>
        <div style={{ ...panelStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <th style={thStyle}>FIRST SEEN</th>
                <th style={thStyle}>LAST ACTIVITY</th>
                <th style={thStyle}>COUNTRY/CITY</th>
                <th style={thStyle}>SOURCE</th>
                <th style={thStyle}>CAMPAIGN</th>
                <th style={thStyle}>PAGE</th>
                <th style={numTh}>REQ</th>
                <th style={thStyle}>STAGE</th>
                <th style={thStyle}>KİTLE</th>
                <th style={thStyle}>IP</th>
                <th style={thStyle}>DEVICE</th>
                <th style={thStyle}>FLAG</th>
              </tr>
            </thead>
            <tbody>
              {pagedVisitors.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: 24, textAlign: 'center', color: TEXT_SECONDARY }}>
                    Ziyaretçi bulunamadı.
                  </td>
                </tr>
              ) : (
                pagedVisitors.map((v) => {
                  const badge = audienceBadge(v.audience);
                  return (
                    <tr key={v.sessionId} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                      <td style={tdStyle}>{formatTime(v.firstSeen)}</td>
                      <td style={tdStyle}>{formatTime(v.lastActivity)}</td>
                      <td style={tdStyle}>
                        <div>{v.country}</div>
                        <div style={{ fontSize: 10, color: TEXT_SECONDARY }}>{v.city}</div>
                      </td>
                      <td style={tdStyle}>
                        {v.source}
                        {v.twclid && <span style={{ marginLeft: 6, fontSize: 9, color: GREEN }}>twclid</span>}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: TEXT_SECONDARY }}>
                        {v.campaign || '—'}
                        {v.content ? ` / ${v.content}` : ''}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 180, wordBreak: 'break-word' }}>{v.page}</td>
                      <td style={numTd}>{v.pageRequests || '—'}</td>
                      <td style={{ ...tdStyle, color: stageColor(v.stage), fontWeight: 700 }}>{v.stage}</td>
                      <td style={{ ...tdStyle, color: badge.color, fontSize: 11 }} title={v.userAgent ?? ''}>
                        {badge.text}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: TEXT_SECONDARY }}>{v.ip}</td>
                      <td style={tdStyle}>{v.device}</td>
                      <td style={{ ...tdStyle, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {v.suspectedAutomation && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: RED,
                              border: `1px solid ${RED}`,
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}
                          >
                            suspected_automation
                          </span>
                        )}
                        {v.diagnosticSignals.map((sig) => (
                          <span
                            key={sig}
                            style={{
                              fontSize: 9,
                              color: TEXT_SECONDARY,
                              border: `1px solid ${BORDER_COLOR}`,
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}
                          >
                            {SIGNAL_LABELS[sig] ?? sig}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: TEXT_SECONDARY }}>
        <span>
          Detay: {fmt(detailTotal === 0 ? 0 : safeDetailPage * DETAIL_PAGE_SIZE + 1)}–
          {fmt(Math.min((safeDetailPage + 1) * DETAIL_PAGE_SIZE, detailTotal))} / {fmt(detailTotal)} satır (sunucu en
          fazla {fmt(data?.visitorLimit ?? 500)} satır gönderir) — özet rakamlar aralığın TAMAMINI (
          {fmt(data?.overview.sessions ?? 0)} oturum) kapsar.
        </span>
        {detailPageCount > 1 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <button
              onClick={() => setDetailPage((p) => Math.max(0, p - 1))}
              disabled={safeDetailPage === 0}
              style={{
                padding: '4px 10px',
                background: CARD_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 4,
                color: safeDetailPage === 0 ? BORDER_COLOR : TEXT_MAIN,
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: safeDetailPage === 0 ? 'default' : 'pointer',
              }}
            >
              ‹ Önceki
            </button>
            <span>
              {safeDetailPage + 1} / {detailPageCount}
            </span>
            <button
              onClick={() => setDetailPage((p) => Math.min(detailPageCount - 1, p + 1))}
              disabled={safeDetailPage >= detailPageCount - 1}
              style={{
                padding: '4px 10px',
                background: CARD_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 4,
                color: safeDetailPage >= detailPageCount - 1 ? BORDER_COLOR : TEXT_MAIN,
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: safeDetailPage >= detailPageCount - 1 ? 'default' : 'pointer',
              }}
            >
              Sonraki ›
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
