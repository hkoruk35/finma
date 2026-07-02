"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MARKET_THEMES } from "@/lib/themeData";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";
import { useTracker } from "@/components/TrackerContext";

interface HourlyBar {
  time: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_ratio: number | null;
}

interface TickerData {
  ticker: string;
  company: string;
  sector: string;
  price: { current: number; change_pct: number; volume: number };
  tracker_1h: {
    ema_20: number; ema_50: number; ema_200: number;
    ema_status: string; rsi: number; candle_pattern: string;
    signal: string; volume_ratio: number; volume_ratio_1d?: number; change_pct_1h: number;
  };
  hourly?: HourlyBar[];
}

const SIGNAL_ICON: Record<string, string> = { AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };
const ROW_BG: Record<string, string> = { AL: "#0d1f0d", "İzle": "#1a1a0d", Bekle: "#000036", SAT: "#1f0d0d" };

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");
const fmtVol = (v: number | null | undefined) => !v ? "—" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(v);

function rsiColor(rsi: number) {
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function emaColor(price: number, ema: number) {
  if (!ema) return "#8b949e";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "#e3b341";
  return price > ema ? "#3fb950" : "#f85149";
}

function emaArrow(price: number, ema: number) {
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

const ITEMS_PER_PAGE = 50;

export default function AllListDetailClient() {
  const { addToTracker, isInTracker, tickers: trackerTickers } = useTracker();
  const [data, setData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);
  const [extraTickers, setExtraTickers] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterSignal, setFilterSignal] = useState("");
  const [filterVolume, setFilterVolume] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const slugs = ["active", "portfolio", "swing", "daily", "long_term"];
    Promise.all(slugs.map(slug => fetch(`/api/csp-watchlist/${slug}`).then(r => r.json())))
      .then(results => {
        const newlyAdded = results.flatMap(r => r.tickers || []);
        setExtraTickers(newlyAdded);
      })
      .catch(() => {});
  }, []);

  // Extract all unique tickers from MARKET_THEMES, 2026 hot themes, and other watchlists
  const allTickers = Array.from(
    new Set([
      ...MARKET_THEMES.flatMap((t) => t.tickers),
      ...HOT_THEMES_2026.flatMap((t) => t.stocks.map((s) => s.ticker)),
      ...trackerTickers,
      ...extraTickers
    ])
  ).sort();

  // Also include any tickers in data that might not be in allTickers yet
  const allTickersWithData = Array.from(
    new Set([...allTickers, ...Object.keys(data)])
  ).sort();

  // Background fetch all tickers to make filtering accurate
  useEffect(() => {
    let active = true;
    const fetchMissing = async () => {
      const BATCH_SIZE = 100;
      for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
        if (!active) break;
        const chunk = allTickers.slice(i, i + BATCH_SIZE).filter(t => !fetchedRef.current.has(t));
        if (chunk.length === 0) continue;
        
        try {
          const res = await fetch(`/api/watchlist-data?tickers=${chunk.join(",")}`);
          if (!res.ok) continue;
          const result = await res.json();
          setData(prev => {
            const next = { ...prev };
            result.forEach((item: TickerData) => {
              if (item?.ticker) {
                next[item.ticker] = item;
                fetchedRef.current.add(item.ticker);
              }
            });
            return next;
          });
        } catch (e) {}
      }
    };
    if (allTickers.length > 0) fetchMissing();
    return () => { active = false; };
  }, [allTickers.length]);

  // Reset page to 1 whenever any filter or search changes
  useEffect(() => { setPage(1); }, [searchQuery, filterSignal, filterVolume, filterSector, filterPattern]);

  // Filtered tickers
  const filtered = allTickersWithData.filter(sym => {
    const d = data[sym];

    // Search query: check ticker first (exact prefix first, then partial), then company/sector
    if (searchQuery) {
      const q = searchQuery.toUpperCase().trim();
      const tickerMatch = sym.startsWith(q) || sym.includes(q);
      const companyMatch = (d?.company || "").toUpperCase().includes(q);
      const sectorMatch = (d?.sector || "").toUpperCase().includes(q);
      if (!tickerMatch && !companyMatch && !sectorMatch) return false;
    }

    if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;

    if (filterVolume) {
      const vol = d?.price?.volume || 0;
      if (filterVolume === "<1M" && vol >= 1e6) return false;
      if (filterVolume === "1M-10M" && (vol < 1e6 || vol >= 10e6)) return false;
      if (filterVolume === "10M-50M" && (vol < 10e6 || vol >= 50e6)) return false;
      if (filterVolume === "50M+" && vol < 50e6) return false;
    }

    if (filterSector && d?.sector !== filterSector) return false;
    if (filterPattern && d?.tracker_1h?.candle_pattern !== filterPattern) return false;

    return true;
  }).sort((a, b) => {
    // When searching, sort: exact match first, then startsWith, then rest
    if (searchQuery) {
      const q = searchQuery.toUpperCase().trim();
      const aExact = a === q ? 0 : a.startsWith(q) ? 1 : 2;
      const bExact = b === q ? 0 : b.startsWith(q) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
    }
    return a.localeCompare(b);
  });

  // Sorting
  const sortedTickers = [...filtered].sort((a, b) => {
    if (!sortBy) return 0;
    const da = data[a];
    const db = data[b];
    let valA: any, valB: any;

    switch (sortBy) {
      case "TICKER": valA = a; valB = b; break;
      case "ŞİRKET": valA = da?.company || ""; valB = db?.company || ""; break;
      case "SEKTÖR": valA = da?.sector || ""; valB = db?.sector || ""; break;
      case "FİYAT": valA = da?.price?.current ?? 0; valB = db?.price?.current ?? 0; break;
      case "HACİM": valA = da?.price?.volume ?? 0; valB = db?.price?.volume ?? 0; break;
      case "1G FİY%": valA = da?.price?.change_pct ?? 0; valB = db?.price?.change_pct ?? 0; break;
      case "RVOL": valA = da?.tracker_1h?.volume_ratio_1d ?? 0; valB = db?.tracker_1h?.volume_ratio_1d ?? 0; break;
      case "EMA20": valA = da?.tracker_1h?.ema_20 ?? 0; valB = db?.tracker_1h?.ema_20 ?? 0; break;
      case "EMA50": valA = da?.tracker_1h?.ema_50 ?? 0; valB = db?.tracker_1h?.ema_50 ?? 0; break;
      case "EMA200": valA = da?.tracker_1h?.ema_200 ?? 0; valB = db?.tracker_1h?.ema_200 ?? 0; break;
      case "RSI": valA = da?.tracker_1h?.rsi ?? 0; valB = db?.tracker_1h?.rsi ?? 0; break;
      case "PATERN": valA = da?.tracker_1h?.candle_pattern || ""; valB = db?.tracker_1h?.candle_pattern || ""; break;
      case "DURUM": valA = da?.tracker_1h?.ema_status || ""; valB = db?.tracker_1h?.ema_status || ""; break;
      case "SİNYAL": {
        const signalOrder = { "AL": 3, "İzle": 2, "Bekle": 1, "SAT": 0, "—": -1 };
        valA = signalOrder[da?.tracker_1h?.signal as keyof typeof signalOrder] ?? -1;
        valB = signalOrder[db?.tracker_1h?.signal as keyof typeof signalOrder] ?? -1;
        break;
      }
      default: return 0;
    }

    if (typeof valA === "string") {
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    }
    const diff = valA - valB;
    return sortDir === "asc" ? diff : -diff;
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  // Fetch data for current page only (lazy loading)
  useEffect(() => {
    const fetchPageData = async () => {
      // Get tickers for current page
      const pageStart = (page - 1) * ITEMS_PER_PAGE;
      const pageEnd = pageStart + ITEMS_PER_PAGE;
      const tickersToFetch = sortedTickers.slice(pageStart, pageEnd);

      if (tickersToFetch.length === 0) return;

      // Check if we already have data for these tickers
      const needsFetch = tickersToFetch.some((t) => !data[t]);
      if (!needsFetch) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const batch = tickersToFetch.join(",");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const result = await fetch(`/api/watchlist-data?tickers=${batch}`, {
          signal: controller.signal,
        })
          .then((r) => {
            clearTimeout(timeoutId);
            return r.json();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            console.error("Fetch error:", err);
            return [];
          });

        const newData = { ...data };
        result.forEach((item: TickerData) => {
          if (item?.ticker) {
            newData[item.ticker] = item;
            fetchedRef.current.add(item.ticker);
          }
        });
        setData(newData);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Data fetch failed:", err);
        setLoading(false);
      }
    };

    fetchPageData();
  }, [page]);

  const isMarketOpen = () => {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">
          loading...
        </span>
      </div>
    );
  }

  const alCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "AL").length;
  const izleCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "İzle").length;

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = sortedTickers.slice(start, end);

  return (
    <div style={{ background: "#000036", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3" }}>
      {/* Top Header */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 0 8px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 8 }}>
          <Link href="/admin/settings/theme" style={{ color: "#58a6ff" }}>THEMES</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#e3b341" }}>CSP</span>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#e6edf3" }}>ALL LIST</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#e3b341", letterSpacing: "-0.5px" }}>
                BOGA TRACKER — ALL LIST
              </span>
              <span style={{ fontSize: 12, color: "#8b949e" }}>900+ hisse</span>
            </div>

            {/* CSP Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {[
                { slug: "active", label: "Active Watchlist", color: "#10b981" },
                { slug: "portfolio", label: "Portföy", color: "#f97316" },
                { slug: "swing", label: "Swing Picks", color: "#6b7280" },
                { slug: "daily", label: "Daily Intraday", color: "#f59e0b" },
                { slug: "long_term", label: "Long-Term", color: "#14b8a6" },
              ].map((csp) => (
                <Link
                  key={csp.slug}
                  href={`/csp/${csp.slug}`}
                  style={{
                    padding: "5px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    border: `1px solid #30363d`,
                    background: "transparent",
                    color: "#8b949e",
                    borderRadius: 4,
                    cursor: "pointer",
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                >
                  {csp.label}
                </Link>
              ))}
              <Link href="/admin/trading/csp/all-list" style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #e3b341",
                background: "#e3b34120",
                color: "#e3b341",
                borderRadius: 4, cursor: "pointer", textDecoration: "none",
                transition: "all 0.2s"
              }}>
                ALL LIST
              </Link>
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12 }}>
              {lastUpdated && <span>son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ET</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>
                ● {isMarketOpen() ? "market açık" : "market kapalı"}
              </span>
              <span style={{ color: "#8b949e" }}>{filtered.length} ticker</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} AL</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} İzle</span>}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value.toUpperCase())}
            placeholder="hisse ara..."
            maxLength={12}
            style={{
              background: "#161b22", border: `1px solid ${searchQuery ? "#e3b341" : "#30363d"}`,
              color: "#e6edf3", padding: "3px 8px", borderRadius: 3,
              fontSize: 11, fontFamily: "monospace", width: 100, outline: "none"
            }}
          />

          <select 
            value={filterVolume} 
            onChange={e => setFilterVolume(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", outline: "none" }}
          >
            <option value="">Tüm Hacimler</option>
            <option value="<1M">{"< 1M"}</option>
            <option value="1M-10M">1M - 10M</option>
            <option value="10M-50M">10M - 50M</option>
            <option value="50M+">50M+</option>
          </select>

          <select 
            value={filterSector} 
            onChange={e => setFilterSector(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", outline: "none", maxWidth: 120 }}
          >
            <option value="">Tüm Sektörler</option>
            {Array.from(new Set(Object.values(data).map(d => d.sector))).filter(s => s && s !== "Unknown").sort().map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select 
            value={filterPattern} 
            onChange={e => setFilterPattern(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", outline: "none", maxWidth: 120 }}
          >
            <option value="">Tüm Paternler</option>
            {Array.from(new Set(Object.values(data).map(d => d.tracker_1h?.candle_pattern))).filter(p => p && p !== "—").sort().map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <div style={{ width: 1, background: "#30363d", margin: "0 4px", alignSelf: "stretch" }} />
          {["", "AL", "İzle", "Bekle", "SAT"].map((sig) => (
            <button
              key={sig || "TÜM"}
              onClick={() => setFilterSignal(sig)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: `1px solid ${filterSignal === sig ? (SIGNAL_COLOR[sig] || "#e3b341") : "#30363d"}`,
                background: filterSignal === sig ? (SIGNAL_COLOR[sig] || "#e3b341") + "20" : "transparent",
                color: filterSignal === sig ? (SIGNAL_COLOR[sig] || "#e3b341") : "#8b949e",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {sig ? `${SIGNAL_ICON[sig]} ${sig}` : "TÜM SİNYAL"}
            </button>
          ))}
        </div>
      </div>

      {/* Pagination Info */}
      <div style={{ padding: "8px 0", fontSize: 11, color: "#8b949e", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Sayfa {page}/{totalPages}</span>
        <span>{start + 1}–{Math.min(end, filtered.length)} / {filtered.length}</span>
      </div>

      {/* Table Rows */}
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d" }}>
              {["TICKER", "ŞİRKET", "SEKTÖR", "FİYAT", "HACİM", "TRACKER", "1G FİY%", "RVOL", "EMA20", "EMA50", "EMA200", "DURUM", "RSI", "PATERN", "SİNYAL"].map((h, i) => {
                const isSortable = h && !["TRACKER", ""].includes(h);
                const isSorted = sortBy === h;
                return (
                  <th key={i} onClick={() => isSortable && toggleSort(h)} style={{
                    padding: "7px 8px", textAlign: i <= 2 ? "left" : "right",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    color: isSorted ? "#ffd700" : "#3fb950", whiteSpace: "nowrap", background: "#000036",
                    cursor: isSortable ? "pointer" : "default",
                    userSelect: "none",
                    opacity: isSortable ? 1 : 0.7
                  }}>
                    {h}{isSorted && <span style={{ fontSize: 9, marginLeft: 2 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((sym, idx) => {
              const d = data[sym];
              if (!d) return null;

              const signal = d.tracker_1h?.signal || "—";
              const rowBg = ROW_BG[signal] || "#000036";
              const altBg = idx % 2 === 1 ? "#161b22" : "#000036";
              const bg = signal !== "—" ? rowBg : altBg;
              const price = d.price?.current ?? 0;

              return (
                <tr
                  key={sym}
                  style={{ background: bg, borderBottom: "1px solid #21262d", cursor: "pointer" }}
                  onClick={() => {}}
                >
                  {/* TICKER */}
                  <td
                    style={{ padding: "7px 8px", whiteSpace: "nowrap" }}
                    onMouseEnter={e => {
                      e.stopPropagation();
                      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setHoverTicker(sym);
                      setHoverPos({ x: r.right + 10, y: r.top });
                    }}
                    onMouseLeave={() => {
                      hoverTimerRef.current = setTimeout(() => {
                        setHoverTicker(null);
                        setHoverPos(null);
                      }, 750);
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <Link href={`/stock/${sym}`} style={{ textDecoration: "none" }}>
                      <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 13 }}>{sym}</span>
                    </Link>
                  </td>

                  {/* ŞIRKET */}
                  <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={d.company || ""}>
                    {d.company ? d.company.slice(0, 15) : "—"}
                  </td>

                  {/* SEKTÖR */}
                  <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, whiteSpace: "nowrap", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }} title={d.sector || ""}>
                    {d.sector && d.sector !== "Unknown" ? d.sector.toUpperCase().slice(0, 10) : "—"}
                  </td>

                  {/* FİYAT */}
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                    ${fmt2(price)}
                  </td>

                  {/* HACİM */}
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                    {fmtVol(d.price?.volume)}
                  </td>

                  {/* TRACKER */}
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    {isInTracker(sym) ? (
                      <Link
                        href="/admin/portfolio/tracker"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: "inline-block", padding: "2px 8px", fontSize: 10,
                          fontFamily: "monospace", fontWeight: 700, borderRadius: 3,
                          border: "1px solid #3fb950", color: "#3fb950",
                          background: "#0d2a0d", textDecoration: "none", whiteSpace: "nowrap"
                        }}
                      >
                        ✓ Tracker
                      </Link>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); addToTracker(sym, "CSP"); }}
                        style={{
                          padding: "2px 8px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                          border: "1px solid #30363d", background: "transparent",
                          color: "#8b949e", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap"
                        }}
                      >
                        + Tracker
                      </button>
                    )}
                  </td>

                  {/* 1G FİY% */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                    color: (d.price?.change_pct ?? 0) >= 0 ? "#3fb950" : "#f85149"
                  }}>
                    {(d.price?.change_pct ?? 0) >= 0 ? "+" : ""}{fmt2(d.price?.change_pct)}%
                  </td>

                  {/* RVOL */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                    color: (d.tracker_1h?.volume_ratio_1d ?? 0) >= 1.5 ? "#3fb950" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e"
                  }}>
                    {d.tracker_1h?.volume_ratio_1d != null ? `${fmt1(d.tracker_1h.volume_ratio_1d)}x` : "—"}
                  </td>

                  {/* EMA20 */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                    color: emaColor(price, d.tracker_1h?.ema_20)
                  }}>
                    {fmt2(d.tracker_1h?.ema_20)}{emaArrow(price, d.tracker_1h?.ema_20)}
                  </td>

                  {/* EMA50 */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                    color: emaColor(price, d.tracker_1h?.ema_50)
                  }}>
                    {fmt2(d.tracker_1h?.ema_50)}{emaArrow(price, d.tracker_1h?.ema_50)}
                  </td>

                  {/* EMA200 */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                    color: emaColor(price, d.tracker_1h?.ema_200)
                  }}>
                    {fmt2(d.tracker_1h?.ema_200)}{emaArrow(price, d.tracker_1h?.ema_200)}
                  </td>

                  {/* DURUM */}
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                      background:
                        d.tracker_1h?.ema_status === "Bullish" ? "#1a3a1a" :
                        d.tracker_1h?.ema_status === "Yükseliş" ? "#1c2e1c" :
                        d.tracker_1h?.ema_status === "Nötr" ? "#1a1a2e" :
                        d.tracker_1h?.ema_status === "Düşüş" ? "#2e1a1a" : "#3a1a1a",
                      color:
                        d.tracker_1h?.ema_status === "Bullish" ? "#3fb950" :
                        d.tracker_1h?.ema_status === "Yükseliş" ? "#56d364" :
                        d.tracker_1h?.ema_status === "Nötr" ? "#8b949e" :
                        d.tracker_1h?.ema_status === "Düşüş" ? "#f85149" : "#ff7b72",
                    }}>
                      {d.tracker_1h?.ema_status}
                    </span>
                  </td>

                  {/* RSI */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                    color: rsiColor(d.tracker_1h?.rsi ?? 50)
                  }}>
                    {fmt1(d.tracker_1h?.rsi)}
                  </td>

                  {/* PATERN */}
                  <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 10, whiteSpace: "nowrap" }}>
                    {(() => {
                      const p = d.tracker_1h?.candle_pattern;
                      if (!p || p === "—") return <span style={{ color: "#555" }}>—</span>;
                      const bullishPatterns = ["Hammer","Bullish Engulfing","Inv. Hammer","Morning Star","3 Asker ↑","Dragonfly Doji","Bullish Marubozu","Outside Bar ↑","Güçlü ↑","Yeşil Mum ↑","Spinning Top ↑"];
                      const bearishPatterns = ["Shooting Star","Bearish Engulfing","Hanging Man","Evening Star","3 Karga ↓","Gravestone Doji","Bearish Marubozu","Outside Bar ↓","Güçlü ↓","Kırmızı Mum ↓","Spinning Top ↓"];
                      const color = bullishPatterns.some(x => p.includes(x.replace(" ↑","")) && !p.includes("↓")) ? "#3fb950"
                        : bearishPatterns.some(x => p.includes(x.replace(" ↓","")) && !p.includes("↑")) ? "#f85149"
                        : "#e3b341";
                      return <span style={{ color, fontWeight: 700 }}>{p}</span>;
                    })()}
                  </td>

                  {/* SİNYAL */}
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    <span style={{
                      fontWeight: 900, fontSize: 12,
                      color: SIGNAL_COLOR[signal] || "#8b949e"
                    }}>
                      {SIGNAL_ICON[signal] || "○"} {signal}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ padding: "16px 0", display: "flex", gap: 8, justifyContent: "center", alignItems: "center", borderTop: "1px solid #30363d", flexWrap: "wrap" }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid #30363d",
              background: "transparent",
              color: page === 1 ? "#555" : "#8b949e",
              borderRadius: 4,
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            ← Önceki
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) =>
                p === 1 ||
                p === totalPages ||
                (p >= page - 1 && p <= page + 1)
            )
            .map((p, idx, arr) => (
              <div key={p} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span style={{ color: "#333", fontSize: 11 }}>…</span>
                )}
                <button
                  onClick={() => setPage(p)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    border: `1px solid ${page === p ? "#e3b341" : "#30363d"}`,
                    background: page === p ? "#e3b34120" : "transparent",
                    color: page === p ? "#e3b341" : "#8b949e",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              </div>
            ))}

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid #30363d",
              background: "transparent",
              color: page === totalPages ? "#555" : "#8b949e",
              borderRadius: 4,
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.5 : 1,
            }}
          >
            Sonraki →
          </button>
        </div>
      )}

      {/* ── Fixed Hover Chart Popup ── */}
      {hoverTicker && hoverPos && (
        <div
          style={{
            position: "fixed",
            left: Math.min(hoverPos.x, window.innerWidth - 440),
            top: Math.max(8, Math.min(hoverPos.y, window.innerHeight - 270)),
            width: 430, zIndex: 9999,
            background: "#000036", border: "1px solid #30363d",
            borderRadius: 6, overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)"
          }}
          onMouseEnter={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
          onMouseLeave={() => {
            hoverTimerRef.current = setTimeout(() => {
              setHoverTicker(null);
              setHoverPos(null);
            }, 500);
          }}
        >
          <div style={{
            padding: "7px 12px", borderBottom: "1px solid #30363d",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 12 }}>{hoverTicker} — 1D Chart</span>
            <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
              <a href={`https://finviz.com/quote.ashx?t=${hoverTicker}`} target="_blank" rel="noopener" style={{ color: "#8b949e" }}>Finviz ↗</a>
            </div>
          </div>
          <iframe
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_csp_${hoverTicker}&symbol=${hoverTicker}&interval=D&theme=dark&style=1&locale=en&hide_top_toolbar=1&hide_legend=1&save_image=0&withdateranges=0&hideideas=1&hide_side_toolbar=1`}
            width="430" height="220"
            style={{ border: "none", display: "block" }}
            title={`${hoverTicker} 1D`}
          />
        </div>
      )}
    </div>
  );
}
