"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import TickerHoverChart from "@/components/TickerHoverChart";

const REFRESH_MS = 5 * 60 * 1000;
const ACCENT = "#58a6ff";

const SIGNAL_ICON: Record<string, string> = { AL: "●", İzle: "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", İzle: "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };
const ROW_BG: Record<string, string> = { AL: "#0d1f0d", İzle: "#1a1a0d", Bekle: "#0d1117", SAT: "#1f0d0d" };

interface SwingRow {
  ticker: string;
  company: string;
  price: number;
  change_pct: number;
  rsi: number;
  signal: string;
  volume: number;
  sector: string;
}

interface LiveData {
  ticker: string;
  company: string;
  sector: string;
  price: { current: number; prev_close: number; change_pct: number; volume?: number };
  tracker_1h: {
    ema_20: number; ema_50: number; ema_200: number;
    ema_status: string; rsi: number; candle_pattern: string;
    signal: string; volume_ratio: number; change_pct_1h: number;
    change_pct_1d: number; volume_ratio_1d: number;
  };
}

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");
const fmtVol = (v: number | null | undefined) =>
  !v ? "—" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(v);

function rsiColor(rsi: number | undefined) {
  if (rsi == null) return "#8b949e";
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function emaColor(price: number, ema: number | undefined) {
  if (!ema) return "#8b949e";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "#e3b341";
  return price > ema ? "#3fb950" : "#f85149";
}

function emaArrow(price: number, ema: number | undefined) {
  if (!ema) return "";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "~";
  return price > ema ? "↑" : "↓";
}

function heatBg(pct: number | null) {
  if (pct === null) return { bg: "#111111", text: "#333333" };
  if (pct >= 2.0) return { bg: "#0d4a0d", text: "#56d364" };
  if (pct >= 1.0) return { bg: "#0d3a0d", text: "#3fb950" };
  if (pct >= 0.3) return { bg: "#0d2a0d", text: "#3fb950" };
  if (pct > -0.3) return { bg: "#1a1a1a", text: "#8b949e" };
  if (pct > -1.0) return { bg: "#2a0d0d", text: "#f85149" };
  if (pct > -2.0) return { bg: "#3a0d0d", text: "#f85149" };
  return { bg: "#4a0d0d", text: "#ff7b72" };
}

function isMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

const SIGNAL_RANK: Record<string, number> = { AL: 4, İzle: 3, Bekle: 2, SAT: 1 };

export default function SwingTracker({ locale }: { locale: Locale }) {
  const t = copy[locale].top100;
  const [composition, setComposition] = useState<SwingRow[]>([]);
  const [live, setLive] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterSignal, setFilterSignal] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const swingRes = await fetch("/lib/swingCandidates.json");
      if (!swingRes.ok) throw new Error("Could not load swing candidates");
      const swingData = await swingRes.json();

      const rows: SwingRow[] = (swingData.picks || []).map((p: any) => ({
        ticker: p.ticker,
        company: p.company || p.ticker,
        price: p.price || 0,
        change_pct: p.change_pct || 0,
        rsi: p.rsi || 0,
        signal: p.signal || "İzle",
        volume: p.volume || 0,
        sector: p.sector || "Unknown",
      }));

      setComposition(rows);

      if (rows.length > 0) {
        const tickers = rows.map((r) => r.ticker).join(",");
        const liveRes = await fetch(`/api/watchlist-data?tickers=${tickers}`);
        if (liveRes.ok) {
          const liveRows: LiveData[] = await liveRes.json();
          const map: Record<string, LiveData> = {};
          liveRows.forEach((item) => { if (item?.ticker) map[item.ticker] = item; });
          setLive(map);
        }
      }
      setLastUpdated(new Date());
      setError("");
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  const sectorOptions = useMemo(() => {
    const s = new Set<string>();
    composition.forEach((r) => {
      const sec = live[r.ticker]?.sector || r.sector;
      if (sec && sec !== "Unknown") s.add(sec);
    });
    return Array.from(s).sort();
  }, [composition, live]);

  const patternOptions = useMemo(() => {
    const s = new Set<string>();
    composition.forEach((r) => {
      const p = live[r.ticker]?.tracker_1h?.candle_pattern;
      if (p) s.add(p);
    });
    return Array.from(s).sort();
  }, [composition, live]);

  const filtered = useMemo(() => {
    return composition.filter((r) => {
      const d = live[r.ticker];
      if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
      if (filterSector && (d?.sector || r.sector) !== filterSector) return false;
      if (filterPattern && d?.tracker_1h?.candle_pattern !== filterPattern) return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        const sector = d?.sector || r.sector || "";
        const company = d?.company || r.company || "";
        if (!r.ticker.includes(q) && !company.toUpperCase().includes(q) && !sector.toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [composition, live, filterSignal, filterSector, filterPattern, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      const da = live[a.ticker], db = live[b.ticker];
      let va: number, vb: number;
      switch (sortBy) {
        case "price": va = da?.price?.current ?? 0; vb = db?.price?.current ?? 0; break;
        case "volume": va = da?.price?.volume ?? 0; vb = db?.price?.volume ?? 0; break;
        case "chg1d": va = da?.tracker_1h?.change_pct_1d ?? 0; vb = db?.tracker_1h?.change_pct_1d ?? 0; break;
        case "rsi": va = da?.tracker_1h?.rsi ?? 0; vb = db?.tracker_1h?.rsi ?? 0; break;
        case "ema20": va = da?.tracker_1h?.ema_20 ?? 0; vb = db?.tracker_1h?.ema_20 ?? 0; break;
        case "signal": va = SIGNAL_RANK[da?.tracker_1h?.signal ?? ""] ?? 0; vb = SIGNAL_RANK[db?.tracker_1h?.signal ?? ""] ?? 0; break;
        default: return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, live, sortBy, sortDir]);

  const alCount = filtered.filter((r) => live[r.ticker]?.tracker_1h?.signal === "AL").length;
  const izleCount = filtered.filter((r) => live[r.ticker]?.tracker_1h?.signal === "İzle").length;

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));
  const permalink = (ticker: string) => (locale === "en" ? `/global/en/${ticker}` : `/global/tr/${ticker}`);

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117" }}>
        <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">{t.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117", color: "#f85149", fontFamily: "monospace" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ background: "#0d1117", minHeight: "60vh", fontFamily: "monospace", color: "#e6edf3", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>
              {locale === "tr" ? "Günlük Swing Trade Adayları" : "Daily Swing Trade Candidates"}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && <span>{locale === "tr" ? "son güncelleme" : "last update"}: {lastUpdated.toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? (locale === "tr" ? "market açık" : "market open") : locale === "tr" ? "market kapalı" : "market closed"}</span>
              <span>{filtered.length} {locale === "tr" ? "ticker" : "tickers"}</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} AL</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} İzle</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {(["table", "heatmap"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", borderColor: activeTab === tab ? ACCENT : "#30363d",
                  background: activeTab === tab ? ACCENT + "20" : "transparent",
                  color: activeTab === tab ? ACCENT : "#8b949e",
                  borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em",
                }}>
                {tab === "table" ? "ANA TABLO" : "ISI HARİTASI"}
              </button>
            ))}
            <button onClick={fetchAll} disabled={loading}
              style={{ padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "1px solid #30363d", background: "transparent", color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer" }}>
              {loading ? "..." : "YENİLE"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            placeholder={locale === "tr" ? "hisse ara..." : "search..."}
            maxLength={12}
            style={{ background: "#161b22", border: `1px solid ${searchQuery ? ACCENT : "#30363d"}`, color: "#e6edf3", padding: "3px 8px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", width: 110, outline: "none" }}
          />
          <div style={{ width: 1, background: "#30363d", margin: "0 2px", alignSelf: "stretch" }} />
          {["", "AL", "İzle", "Bekle", "SAT"].map((s) => (
            <button key={s || "all-signal"} onClick={() => setFilterSignal(s)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid",
                borderColor: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) : "#30363d",
                background: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) + "20" : "transparent",
                color: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) : "#8b949e",
                borderRadius: 3, cursor: "pointer",
              }}>
              {s ? `${SIGNAL_ICON[s]} ${s}` : "TÜM SİNYAL"}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterSector ? ACCENT : "#30363d"}`, color: filterSector ? ACCENT : "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{locale === "tr" ? "TÜM SEKTÖRLER" : "ALL SECTORS"}</option>
            {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPattern} onChange={(e) => setFilterPattern(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterPattern ? ACCENT : "#30363d"}`, color: filterPattern ? ACCENT : "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{locale === "tr" ? "TÜM PATERNLER" : "ALL PATTERNS"}</option>
            {patternOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {!loading && !error && composition.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{locale === "tr" ? "Swing adayı bulunamadı" : "No swing candidates found"}</div>}

      {/* ANA TABLO */}
      {activeTab === "table" && composition.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {([
                  { label: "TICKER", key: null, align: "left" },
                  { label: "SEKTÖR", key: null, align: "left" },
                  { label: "FİYAT", key: "price", align: "right" },
                  { label: "HACİM", key: "volume", align: "right" },
                  { label: "Δ% 1G", key: "chg1d", align: "right" },
                  { label: "HACİM ORANI", key: "goran", align: "right" },
                  { label: "EMA20", key: "ema20", align: "right" },
                  { label: "EMA50", key: "ema50", align: "right" },
                  { label: "EMA200", key: "ema200", align: "right" },
                  { label: "DURUM", key: null, align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "PATERN", key: null, align: "right" },
                  { label: "SİNYAL", key: "signal", align: "right" },
                  { label: "DETAY", key: null, align: "right" },
                ] as { label: string; key: string | null; align: string }[]).map(({ label, key, align }) => (
                  <th key={label} onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      padding: "7px 8px", textAlign: align as "left" | "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: sortBy === key && key ? ACCENT : "#58a6ff",
                      whiteSpace: "nowrap", background: "#0d1117",
                      cursor: key ? "pointer" : "default", userSelect: "none",
                    }}>
                    {label}{key && sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : key ? " ↕" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const d = live[r.ticker];
                const signal = d?.tracker_1h?.signal || "—";
                const rowBg = ROW_BG[signal] || (idx % 2 === 1 ? "#161b22" : "#0d1117");
                const bg = signal !== "—" ? rowBg : idx % 2 === 1 ? "#161b22" : "#0d1117";

                return (
                  <tr key={r.ticker} style={{ borderBottom: "1px solid #161b22", background: bg, cursor: "pointer" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: "#58a6ff" }} onClick={() => toggleExpand(r.ticker)}>
                      {r.ticker}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 11 }}>{d?.sector || r.sector}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>${fmt2(d?.price?.current ?? r.price)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(d?.price?.volume ?? r.volume)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: heatBg(d?.tracker_1h?.change_pct_1d ?? r.change_pct).text, fontWeight: 700 }}>
                      {fmt2(d?.tracker_1h?.change_pct_1d ?? r.change_pct)}%
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmt1(d?.tracker_1h?.volume_ratio_1d)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? r.price, d?.tracker_1h?.ema_20) }}>
                      {fmt2(d?.tracker_1h?.ema_20)} {emaArrow(d?.price?.current ?? r.price, d?.tracker_1h?.ema_20)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? r.price, d?.tracker_1h?.ema_50) }}>
                      {fmt2(d?.tracker_1h?.ema_50)} {emaArrow(d?.price?.current ?? r.price, d?.tracker_1h?.ema_50)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? r.price, d?.tracker_1h?.ema_200) }}>
                      {fmt2(d?.tracker_1h?.ema_200)} {emaArrow(d?.price?.current ?? r.price, d?.tracker_1h?.ema_200)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{d?.tracker_1h?.ema_status}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: rsiColor(d?.tracker_1h?.rsi), fontWeight: 700 }}>{fmt1(d?.tracker_1h?.rsi)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{d?.tracker_1h?.candle_pattern}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: SIGNAL_COLOR[signal] || "#8b949e" }}>{signal}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <Link href={permalink(r.ticker)} style={{ color: ACCENT, textDecoration: "none", fontWeight: 700 }}>▶</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* HEATMAP VIEW */}
      {activeTab === "heatmap" && composition.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, padding: 10 }}>
          {sorted.slice(0, 50).map((r) => {
            const d = live[r.ticker];
            const chg = d?.tracker_1h?.change_pct_1h ?? r.change_pct;
            const { bg, text } = heatBg(chg);
            return (
              <Link key={r.ticker} href={permalink(r.ticker)}
                style={{
                  padding: 12, background: bg, border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4, textAlign: "center", textDecoration: "none", cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                <div style={{ fontWeight: 700, color: "#58a6ff", marginBottom: 4 }}>{r.ticker}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: text }}>{fmt2(chg)}%</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
