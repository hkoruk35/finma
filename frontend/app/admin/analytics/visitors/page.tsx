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
  withTwclid: number | null;
}

interface BreakdownRow {
  key: string;
  sessions: number;
  bot: number;
  loaded: number;
  engaged: number;
  conversions: number;
}

interface SeriesPoint {
  ts: number;
  sessions: number;
  visitors: number;
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
    botSessions: number;
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

interface MonthPeriod {
  key: string;
  label: string;
  start: number;
  end: number;
  days: number;
  partial: boolean;
}
interface MonthRow extends MonthPeriod {
  sessions: number;
  pageViews: number;
  pagesPerSession: number;
  sessionsPerDay: number;
  pageViewsPerDay: number;
}
interface CountryStat {
  country: string;
  sessions: Record<string, number>;
  pageViews: Record<string, number | null>;
}
interface MonthlyResponse {
  generatedAt: number;
  firstSeen: number | null;
  months: MonthRow[];
  periods: MonthPeriod[];
  periodPageViews: Record<string, number>;
  periodSessions: Record<string, number>;
  countries: CountryStat[];
  pageViewsStatus: {
    state: 'ready' | 'computing' | 'error';
    done: number;
    total: number;
    computedAt: number | null;
    error?: string;
  };
  scan: { rows: number; truncated: boolean };
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
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  all: 'All Time',
};

const SEGMENTS: { key: string; label: string; hint: string }[] = [
  { key: 'all', label: 'All Traffic', hint: 'Every session, bots included' },
  { key: 'bot', label: 'Bot / Crawler', hint: 'User-Agent identifies itself as a bot' },
  { key: 'non_bot', label: 'Non-bot UA', hint: 'User-Agent does not identify as a bot (not verified as human)' },
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

const nf = new Intl.NumberFormat('en-US');
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(n));
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
              <th style={numTh}>SESSIONS</th>
              <th style={numTh}>BOT</th>
              <th style={numTh}>ACTIVE 5S</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: TEXT_SECONDARY }}>
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
        No data in this range.
      </div>
    );
  }

  const labelFor = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return hourly ? `${pad(d.getHours())}:00` : `${pad(d.getDate())} ${MONTH_ABBR[d.getMonth()]}`;
  };
  const labelEvery = Math.max(1, Math.ceil(series.length / 12));

  return (
    <div style={{ ...panelStyle, padding: '16px 12px 8px' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 10, color: TEXT_SECONDARY }}>
        <span>
          <span style={{ display: 'inline-block', width: 9, height: 9, background: TEXT_SECONDARY, marginRight: 5 }} />
          Non-bot UA
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 9, height: 9, background: RED, marginRight: 5 }} />
          Bot / Crawler
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Peak: {fmt(max)} sessions / {hourly ? 'hour' : 'day'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 180, overflowX: 'auto' }}>
        {series.map((p) => {
          const nonBot = Math.max(0, p.sessions - p.bot);
          const h = (n: number) => (max > 0 ? (n / max) * 160 : 0);
          return (
            <div
              key={p.ts}
              title={`${labelFor(p.ts)}\nSessions: ${fmt(p.sessions)}\nUnique visitors: ${fmt(p.visitors)}\nNon-bot UA: ${fmt(nonBot)}\nBot: ${fmt(p.bot)}\nActive 5s: ${fmt(p.engaged)}\nSignups: ${fmt(p.conversions)}`}
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
              <div style={{ height: h(nonBot), background: TEXT_SECONDARY }} />
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

// ── Monthly comparison ────────────────────────────────────────────────

function pctChange(cur: number, prev: number | null): { text: string; color: string } {
  if (prev === null || prev === 0) return { text: '—', color: TEXT_SECONDARY };
  const p = Math.round(((cur - prev) / prev) * 1000) / 10;
  if (p === 0) return { text: '= 0%', color: TEXT_SECONDARY };
  return { text: `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`, color: p > 0 ? GREEN : RED };
}

function MonthBars({ title, color, rows, pick }: { title: string; color: string; rows: MonthRow[]; pick: (m: MonthRow) => number }) {
  const max = rows.reduce((m, r) => Math.max(m, pick(r)), 0);
  return (
    <div style={{ ...panelStyle, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 130 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ fontSize: 10, color: TEXT_MAIN, marginBottom: 3, fontWeight: 700 }}>{fmt(pick(r))}</div>
            <div
              style={{
                width: '70%',
                height: max > 0 ? Math.max(2, (pick(r) / max) * 90) : 2,
                background: color,
                opacity: r.partial ? 0.55 : 1,
                borderRadius: '3px 3px 0 0',
              }}
              title={r.partial ? 'Partial month' : 'Full month'}
            />
            <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 4, whiteSpace: 'nowrap' }}>
              {r.label}
              {r.partial ? '*' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyComparison({ monthly, error }: { monthly: MonthlyResponse | null; error: string | null }) {
  if (!monthly) {
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionLabel>MONTHLY COMPARISON</SectionLabel>
        <div style={{ ...panelStyle, padding: 20, fontSize: 12, color: error ? RED : TEXT_SECONDARY }}>
          {error ? `⚠ Monthly stats failed to load: ${error}` : '⏳ Loading monthly statistics…'}
        </div>
      </div>
    );
  }
  const rows = monthly.months;
  const newestFirst = [...rows].reverse();
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionLabel hint="Calendar months (UTC). All traffic, scanner probes and static-asset noise excluded. * = partial month — compare the per-day averages.">
        MONTHLY COMPARISON
      </SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
        <MonthBars title="SESSIONS PER MONTH" color={ACCENT} rows={rows} pick={(m) => m.sessions} />
        <MonthBars title="PAGE VIEWS PER MONTH" color={GREEN} rows={rows} pick={(m) => m.pageViews} />
      </div>
      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <th style={thStyle}>MONTH</th>
              <th style={numTh}>DAYS COVERED</th>
              <th style={numTh}>SESSIONS</th>
              <th style={numTh}>SESSIONS / DAY</th>
              <th style={numTh}>Δ VS PREV. MONTH</th>
              <th style={numTh}>PAGE VIEWS</th>
              <th style={numTh}>PAGE VIEWS / DAY</th>
              <th style={numTh}>Δ VS PREV. MONTH</th>
              <th style={numTh}>PAGES / SESSION</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 20, textAlign: 'center', color: TEXT_SECONDARY }}>
                  No data yet.
                </td>
              </tr>
            ) : (
              newestFirst.map((m, i) => {
                const prev = newestFirst[i + 1] ?? null;
                // A month with < 2 days of data is too short for a meaningful per-day comparison
                const comparable = !!prev && m.days >= 2 && prev.days >= 2;
                const ds = pctChange(m.sessionsPerDay, comparable ? prev!.sessionsPerDay : null);
                const dp = pctChange(m.pageViewsPerDay, comparable ? prev!.pageViewsPerDay : null);
                return (
                  <tr key={m.key} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {m.label}
                      {m.partial && <span style={{ color: AMBER, marginLeft: 6, fontSize: 10 }}>{m.days < 2 ? 'just started*' : 'partial*'}</span>}
                    </td>
                    <td style={numTd}>{m.days.toFixed(1)}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{fmt(m.sessions)}</td>
                    <td style={numTd}>{fmt(m.sessionsPerDay)}</td>
                    <td style={{ ...numTd, color: ds.color, fontWeight: 700 }}>{ds.text}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{fmt(m.pageViews)}</td>
                    <td style={numTd}>{fmt(m.pageViewsPerDay)}</td>
                    <td style={{ ...numTd, color: dp.color, fontWeight: 700 }}>{dp.text}</td>
                    <td style={numTd}>{m.pagesPerSession}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {monthly.firstSeen && (
        <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 6 }}>
          Measurement started {new Date(monthly.firstSeen).toISOString().slice(0, 10)} (UTC) — earlier months do not exist in the data.
          Comparison is on per-day averages so partial months are not penalised.
        </div>
      )}
    </div>
  );
}

// ── Countries (last 30 days + previous months) ────────────────────────

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
function countryLabel(code: string): string {
  if (code === 'Unknown') return 'Unknown (no geo data)';
  try {
    const n = regionNames?.of(code);
    return n && n !== code ? `${n} (${code})` : code;
  } catch {
    return code;
  }
}

const COUNTRY_ROWS = 30;

function CountryStats({ monthly }: { monthly: MonthlyResponse | null }) {
  const [showAll, setShowAll] = useState(false);
  if (!monthly) return null;
  const periods = monthly.periods;
  const status = monthly.pageViewsStatus;
  const all = monthly.countries;
  const unknownRow = all.find((c) => c.country === 'Unknown');
  const known = all.filter((c) => c.country !== 'Unknown');
  const sessions30 = monthly.periodSessions['30d'] ?? 0;
  const unknownShare = unknownRow && sessions30 > 0 ? Math.round(((unknownRow.sessions['30d'] ?? 0) / sessions30) * 100) : null;

  // Unknown stays at its natural rank; long tail is rolled into "Other countries".
  const ranked = [...all];
  const visible = showAll ? ranked : ranked.slice(0, COUNTRY_ROWS);
  const rest = showAll ? [] : ranked.slice(COUNTRY_ROWS);
  const otherRow: CountryStat | null = rest.length
    ? {
        country: `Other countries (${rest.length})`,
        sessions: Object.fromEntries(periods.map((p) => [p.key, rest.reduce((a, r) => a + (r.sessions[p.key] ?? 0), 0)])),
        pageViews: Object.fromEntries(
          periods.map((p) => [p.key, status.state === 'ready' ? rest.reduce((a, r) => a + (r.pageViews[p.key] ?? 0), 0) : null]),
        ),
      }
    : null;
  const rows = otherRow ? [...visible, otherRow] : visible;
  const maxSessions = Math.max(1, ...rows.map((r) => r.sessions['30d'] ?? 0));
  const pvText = (v: number | null | undefined) => (v === null || v === undefined ? '…' : fmt(v));

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionLabel hint={`Per country: sessions and page views for the last 30 days${monthly.periods[0] ? ` (window ends ${new Date(monthly.periods[0].end).toISOString().slice(0, 16).replace('T', ' ')} UTC)` : ''} and for every previous calendar month. All traffic, noise excluded.`}>
        COUNTRIES — LAST 30 DAYS &amp; PREVIOUS MONTHS
      </SectionLabel>

      {status.state === 'computing' && (
        <div style={{ fontSize: 11, color: AMBER, marginBottom: 6 }}>
          ⏳ Page views per country are being counted exactly in the background ({fmt(status.done)} / {fmt(status.total || null)} queries). Sessions are already final; this table refreshes by itself.
        </div>
      )}
      {status.state === 'error' && (
        <div style={{ fontSize: 11, color: RED, marginBottom: 6 }}>⚠ Page-view count failed: {status.error}. Retrying automatically.</div>
      )}
      {unknownShare !== null && unknownShare >= 20 && (
        <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6 }}>
          ℹ {unknownShare}% of sessions in the last 30 days have no geo data — the country comes from the CDN request header, which is
          missing for those requests. They are shown as <strong>Unknown</strong>, not guessed.
        </div>
      )}

      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <th style={{ ...thStyle, verticalAlign: 'bottom' }} rowSpan={2}>
                COUNTRY
              </th>
              {periods.map((p) => (
                <th key={p.key} colSpan={2} style={{ ...thStyle, textAlign: 'center', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                  {p.label.toUpperCase()}
                  {p.partial ? '*' : ''}
                </th>
              ))}
            </tr>
            <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
              {periods.map((p) => (
                <FragmentHeads key={p.key} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={1 + periods.length * 2} style={{ padding: 20, textAlign: 'center', color: TEXT_SECONDARY }}>
                  No data.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isUnknown = r.country === 'Unknown';
                return (
                  <tr key={r.country} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={{ ...tdStyle, position: 'relative', whiteSpace: 'nowrap', color: isUnknown ? TEXT_SECONDARY : TEXT_MAIN }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${((r.sessions['30d'] ?? 0) / maxSessions) * 100}%`,
                          background: 'rgba(88,166,255,0.10)',
                        }}
                      />
                      <span style={{ position: 'relative' }}>{countryLabel(r.country)}</span>
                    </td>
                    {periods.map((p) => (
                      <PeriodCells key={p.key} sessions={r.sessions[p.key] ?? 0} pageViews={pvText(r.pageViews[p.key])} />
                    ))}
                  </tr>
                );
              })
            )}
            <tr style={{ background: PANEL_BG, fontWeight: 700 }}>
              <td style={tdStyle}>TOTAL</td>
              {periods.map((p) => (
                <PeriodCells key={p.key} sessions={monthly.periodSessions[p.key] ?? 0} pageViews={fmt(monthly.periodPageViews[p.key])} strong />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 10, color: TEXT_SECONDARY }}>
        <span>
          {known.length} countries with data · page views = every page request (landing_request) of sessions that started in the period; “Unknown” =
          period total minus all known countries · * = partial period · page views are recounted every 6 hours · country lookup: IP Geolocation by DB-IP.com (CC BY 4.0)
        </span>
        {all.length > COUNTRY_ROWS && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              background: CARD_BG,
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: 4,
              color: ACCENT,
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {showAll ? 'Show top 30' : `Show all ${all.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function FragmentHeads() {
  return (
    <>
      <th style={{ ...numTh, borderLeft: `1px solid ${BORDER_COLOR}`, fontSize: 10 }}>SESSIONS</th>
      <th style={{ ...numTh, fontSize: 10 }}>PAGE VIEWS</th>
    </>
  );
}

function PeriodCells({ sessions, pageViews, strong }: { sessions: number; pageViews: string; strong?: boolean }) {
  return (
    <>
      <td style={{ ...numTd, borderLeft: `1px solid ${BORDER_COLOR}`, fontWeight: strong ? 700 : 700 }}>{fmt(sessions)}</td>
      <td style={{ ...numTd, color: pageViews === '…' ? TEXT_SECONDARY : TEXT_MAIN }}>{pageViews}</td>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function VisitorsPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<MonthlyResponse | null>(null);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [segment, setSegment] = useState('all');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterContent, setFilterContent] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [detailCursor, setDetailCursor] = useState<{ key: string; page: number }>({ key: '', page: 0 });
  // The detail table used to push 500 rows into the DOM at once (~34,000px tall).
  // The server still sends 500 rows (no data is lost); the page renders 50-row
  // slices. The page number is stored together with the query key so changing a
  // filter/range returns to page 1 without needing an effect.

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
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [timeframe, segment, filterCountry, filterSource, filterCampaign, filterContent, filterDevice]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
    // Raw rows are cached server-side for 60 s — refreshing more often would
    // only re-fetch the same response.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // Monthly + per-country stats: independent of the filters above. Polls fast
  // while page views per country are still being counted, slowly afterwards.
  const pvState = monthly?.pageViewsStatus.state;
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/api/admin/traffic-audit/monthly');
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setMonthly(body as MonthlyResponse);
          setMonthlyError(null);
        } else {
          setMonthlyError(body.error || `HTTP ${res.status}`);
        }
      } catch (err) {
        if (!cancelled) setMonthlyError(err instanceof Error ? err.message : 'Unknown error');
      }
    };
    void run();
    const id = setInterval(run, pvState === 'ready' ? 5 * 60_000 : 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pvState]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())} ${MONTH_ABBR[date.getMonth()]} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  };

  const stageColor = (stage: string) => {
    if (stage === 'Converted') return GREEN;
    if (stage === 'Signup Started') return AMBER;
    if (stage === 'Interacted' || stage === 'Active 15s') return ACCENT;
    if (stage === 'Request Only') return RED;
    return TEXT_SECONDARY;
  };

  const audienceBadge = (audience: VisitorRow['audience']) =>
    audience === 'bot' ? { text: 'bot', color: RED } : { text: 'non-bot UA', color: TEXT_SECONDARY };

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

  const botPct = ov && ov.sessions > 0 ? Math.round((ov.botSessions / ov.sessions) * 1000) / 10 : null;

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: TEXT_MAIN }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 4 }}>🌍 Site Traffic Report</h1>
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
          {loading ? '⏳ Loading…' : '↻ Refresh'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 8 }}>
        Landing Request → Browser Loaded → 5s / 15s / 30s Active → Interaction → Signup Start → Signup Complete — first-party
        measurement, independent of GA4 / X Ads.
      </p>

      {error && <p style={{ fontSize: 12, color: RED, marginBottom: 8 }}>⚠ Report failed to load: {error}</p>}

      {data?.auditLiveSince && (
        <p style={{ fontSize: 11, color: AMBER, marginBottom: 4 }}>
          ⏱ Instrumentation live since: <strong>{formatTime(data.auditLiveSince)}</strong> — X Ads comparison is only valid
          for traffic after this moment.
        </p>
      )}
      {data && (
        <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4 }}>
          🛡 Noise removed from the report: <strong>{fmt(data.excluded.scannerProbes)}</strong> security/scanner probes
          (wp-admin, xmlrpc.php, etc.) + <strong>{fmt(data.excluded.assetNoise)}</strong> static-file requests. Raw
          records are not deleted. Rows scanned: <strong>{fmt(data.scan.scanned)}</strong> / {fmt(data.scan.totalRowsInWindow)}.
        </p>
      )}
      {data?.scan.truncated && (
        <p style={{ fontSize: 11, color: RED, marginBottom: 4 }}>
          ⚠ This range holds {fmt(data.scan.totalRowsInWindow)} sessions but the scan limit is {fmt(data.scan.maxScanRows)}.
          The report covers the NEWEST {fmt(data.scan.maxScanRows)} sessions — pick a shorter range.
        </p>
      )}
      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 20 }}>
        Data snapshot: {data ? formatTime(data.dataFetchedAt) : '—'} · Screen updated: {lastUpdate ? formatTime(lastUpdate) : '—'} ·
        auto-refreshes every 60 seconds
      </p>

      {/* Monthly comparison + countries (independent of the filters below) */}
      <MonthlyComparison monthly={monthly} error={monthlyError} />
      <CountryStats monthly={monthly} />

      {/* Timeframe */}
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>TIME RANGE</SectionLabel>
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
        <SectionLabel hint="Most traffic is crawlers. “Non-bot UA” only means the User-Agent does not identify as a bot — it is not verified as human.">
          AUDIENCE SEGMENT
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
          label="Sessions"
          value={fmt(ov?.sessions)}
          sub={`${fmt(ov?.uniqueVisitors)} unique visitors · ${fmt(ov?.returningVisitors)} returning`}
        />
        <StatCard label="Page Views" value={fmt(ov?.pageViews)} sub={`${ov?.pageViewsPerSession ?? '—'} per session`} />
        <StatCard
          label="Bot / Crawler"
          value={fmt(ov?.botSessions)}
          sub={botPct === null ? undefined : `${botPct}% of sessions`}
          color={RED}
        />
        <StatCard
          label="Active 5s"
          value={fmt(ov?.engagedSessions)}
          sub={`30s: ${fmt(ov?.deepEngagedSessions)} · interacted: ${fmt(ov?.interactedSessions)}`}
        />
        <StatCard
          label="Bounce Rate"
          value={ov?.bounceRate === null || ov?.bounceRate === undefined ? '—' : `${ov.bounceRate}%`}
          sub="Loaded but left before 5s"
          color={AMBER}
        />
        <StatCard
          label="Avg. Duration"
          value={ov ? `${ov.avgEngagementSeconds} s` : '—'}
          sub="First request → last activity"
        />
        <StatCard
          label="Signups Completed"
          value={fmt(ov?.conversions)}
          sub={`Started: ${fmt(ov?.signupStarted)} · conversion ${ov?.conversionRate ?? 0}%`}
          color={GREEN}
        />
      </div>

      {/* Previous period comparison */}
      {data?.comparison && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel
            hint={
              data.comparison.suppressedByFilter
                ? 'The previous-period comparison is hidden while a filter is active (previous-period numbers are unfiltered counts, so the comparison would be wrong).'
                : `Previous period of equal length: ${formatTime(data.comparison.previousStart)} → ${
                    data.comparison.previousEnd ? formatTime(data.comparison.previousEnd) : '—'
                  }`
            }
          >
            VS PREVIOUS PERIOD
          </SectionLabel>
          {data.comparison.suppressedByFilter ? (
            <div style={{ ...panelStyle, padding: 14, fontSize: 12, color: TEXT_SECONDARY }}>
              Clear the filters to see the comparison.
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
                      {m.changePct === null ? 'new' : `${up ? '▲' : down ? '▼' : '='} ${Math.abs(m.changePct)}%`}
                      <span style={{ color: TEXT_SECONDARY, fontWeight: 400 }}> (previous: {fmt(m.previous)})</span>
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
        <SectionLabel hint={data && data.bucketMs < 86400000 ? 'Hourly breakdown' : 'Daily breakdown'}>
          TIME SERIES
        </SectionLabel>
        <TrafficChart series={data?.series ?? []} bucketMs={data?.bucketMs ?? 3600000} />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <SectionLabel>FILTERS</SectionLabel>
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
              ✕ Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>COUNTRY</label>
            <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              {(data?.options.countries ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>SOURCE</label>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              {(data?.options.sources ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>DEVICE</label>
            <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              {(data?.options.devices ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
              CAMPAIGN (utm_campaign)
            </label>
            <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              {(data?.options.campaigns ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'block', marginBottom: 4 }}>
              AD (utm_content)
            </label>
            <select value={filterContent} onChange={(e) => setFilterContent(e.target.value)} style={selectStyle}>
              <option value="">All</option>
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
        <SectionLabel hint="Percentages: vs the previous step / share of all requests">TRAFFIC FUNNEL</SectionLabel>
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
                {f.pctOfPrev === null ? '—' : `${f.pctOfPrev}%`}
              </div>
              <div style={{ width: 70, textAlign: 'right', color: TEXT_SECONDARY, fontSize: 11 }}>{f.pctOfTop}%</div>
            </div>
          ))}
          {(!data || data.funnel.length === 0) && (
            <div style={{ padding: 16, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 12 }}>No data.</div>
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
                  <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: TEXT_SECONDARY }}>
                    No data.
                  </td>
                </tr>
              ) : (
                data!.sources.map((s) => (
                  <tr key={s.source} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: ACCENT }}>{s.source}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{fmt(s.sessions)}</td>
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
          title="COUNTRIES (SELECTED RANGE)"
          keyHeader="COUNTRY"
          rows={data?.countries ?? []}
          emptyText="No data."
          hint="Top 25 countries by sessions in the selected time range and filters"
        />
        <BreakdownTable title="DEVICES" keyHeader="DEVICE" rows={data?.devices ?? []} emptyText="No data." />
        <BreakdownTable
          title="REFERRERS"
          keyHeader="REFERRER"
          rows={data?.referrers ?? []}
          emptyText="No data."
          hint="Referrer host of the session's first request"
        />
        <BreakdownTable
          title="LANDING PAGES"
          keyHeader="LANDING PAGE"
          rows={data?.landingPages ?? []}
          emptyText="No data."
          hint="The page the session started on (not total page views)"
        />
      </div>

      {/* Bot agents */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel hint="This list is for reporting only; it does not affect the robots.txt allow-list (botUserAgents.ts).">
          TOP BOTS / CRAWLERS
        </SectionLabel>
        <div style={{ ...panelStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: PANEL_BG, borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <th style={thStyle}>USER-AGENT</th>
                <th style={numTh}>SESSIONS</th>
              </tr>
            </thead>
            <tbody>
              {(data?.botAgents ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 20, textAlign: 'center', color: TEXT_SECONDARY }}>
                    No bot traffic in this range.
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
        <SectionLabel>VISITOR DETAIL</SectionLabel>
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
                <th style={thStyle}>AUDIENCE</th>
                <th style={thStyle}>IP</th>
                <th style={thStyle}>DEVICE</th>
                <th style={thStyle}>FLAG</th>
              </tr>
            </thead>
            <tbody>
              {pagedVisitors.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: 24, textAlign: 'center', color: TEXT_SECONDARY }}>
                    No visitors found.
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
          Detail: {fmt(detailTotal === 0 ? 0 : safeDetailPage * DETAIL_PAGE_SIZE + 1)}–
          {fmt(Math.min((safeDetailPage + 1) * DETAIL_PAGE_SIZE, detailTotal))} of {fmt(detailTotal)} rows (the server sends at
          most {fmt(data?.visitorLimit ?? 500)} rows) — the summary numbers cover the ENTIRE range (
          {fmt(data?.overview.sessions ?? 0)} sessions).
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
              ‹ Previous
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
              Next ›
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
