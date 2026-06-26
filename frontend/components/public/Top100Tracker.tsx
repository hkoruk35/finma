"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import * as XLSX from "xlsx";
import { copy, type Locale } from "@/lib/i18n/copy";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import type { Top100Row } from "@/app/api/top100/route";

const REFRESH_MS = 5 * 60 * 1000;
const ACCENT = "#58a6ff";

const SIGNAL_ICON: Record<string, string> = { AL: "●", İzle: "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", İzle: "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };
const ROW_BG: Record<string, string> = { AL: "#0d1f0d", İzle: "#1a1a0d", Bekle: "#0d1117", SAT: "#1f0d0d" };

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");
const fmt3 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(3) : "—");
const fmtVol = (v: number | null | undefined) =>
  !v ? "—" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(v);

function rsiColor(rsi: number | null) {
  if (rsi == null) return "#8b949e";
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function emaColor(price: number | null, ema: number | null) {
  if (price == null || !ema) return "#8b949e";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "#e3b341";
  return price > ema ? "#3fb950" : "#f85149";
}

function emaArrow(price: number | null, ema: number | null) {
  if (price == null || !ema) return "";
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
  const h = et.getHours(),
    m = et.getMinutes(),
    day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

const SIGNAL_RANK: Record<string, number> = { AL: 4, İzle: 3, Bekle: 2, SAT: 1 };

export default function Top100Tracker({ locale }: { locale: Locale }) {
  const t = copy[locale].top100;
  const [rows, setRows] = useState<Top100Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<"" | "fixed" | "swing_daily">("");
  const [filterSignal, setFilterSignal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(() => {
    fetch("/api/top100")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(t.error);
          return;
        }
        setRows(d.rows ?? []);
        setLastUpdated(d.lastUpdated ?? null);
        setError("");
      })
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [t.error]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterSource && r.source !== filterSource) return false;
      if (filterSignal && r.signal !== filterSignal) return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        if (!r.ticker.includes(q) && !(r.company || "").toUpperCase().includes(q) && !(r.sector || "").toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterSource, filterSignal, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      let va: number, vb: number;
      switch (sortBy) {
        case "price":
          va = a.price ?? 0; vb = b.price ?? 0; break;
        case "volume":
          va = a.volume ?? 0; vb = b.volume ?? 0; break;
        case "change":
          va = a.change_pct ?? 0; vb = b.change_pct ?? 0; break;
        case "ema20":
          va = a.ema20 ?? 0; vb = b.ema20 ?? 0; break;
        case "ema50":
          va = a.ema50 ?? 0; vb = b.ema50 ?? 0; break;
        case "ema200":
          va = a.ema200 ?? 0; vb = b.ema200 ?? 0; break;
        case "rsi":
          va = a.rsi ?? 0; vb = b.rsi ?? 0; break;
        case "macd":
          va = a.macd ?? 0; vb = b.macd ?? 0; break;
        case "adx":
          va = a.adx ?? 0; vb = b.adx ?? 0; break;
        case "signal":
          va = SIGNAL_RANK[a.signal ?? ""] ?? 0; vb = SIGNAL_RANK[b.signal ?? ""] ?? 0; break;
        default:
          return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, sortBy, sortDir]);

  const alCount = filtered.filter((r) => r.signal === "AL").length;
  const izleCount = filtered.filter((r) => r.signal === "İzle").length;

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));

  const downloadXLS = useCallback(() => {
    const data = filtered.map((r) => ({
      TICKER: r.ticker,
      TİP: r.source === "swing_daily" ? "Swing" : "Fixed",
      SEKTÖR: r.sector || r.company || "—",
      FİYAT: r.price ?? "",
      HACİM: r.volume ?? "",
      "Δ%": r.change_pct ?? "",
      EMA20: r.ema20 ?? "",
      EMA50: r.ema50 ?? "",
      EMA200: r.ema200 ?? "",
      RSI: r.rsi ?? "",
      MACD: r.macd ?? "",
      ADX: r.adx ?? "",
      PATERN: r.pattern || "—",
      SİNYAL: r.signal || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOGA Top100");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `boga-top100-${date}.xlsx`);
  }, [filtered]);

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117" }}>
        <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">
          {t.loading}
        </span>
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
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>{t.title}</div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && (
                <span>
                  {t.lastUpdated}: {new Date(lastUpdated).toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? (locale === "tr" ? "market açık" : "market open") : locale === "tr" ? "market kapalı" : "market closed"}</span>
              <span>{filtered.length} {locale === "tr" ? "ticker" : "tickers"}</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} AL</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} İzle</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {(["table", "heatmap"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", borderColor: activeTab === tab ? ACCENT : "#30363d",
                  background: activeTab === tab ? ACCENT + "20" : "transparent",
                  color: activeTab === tab ? ACCENT : "#8b949e",
                  borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em",
                }}
              >
                {tab === "table" ? (locale === "tr" ? "ANA TABLO" : "MAIN TABLE") : locale === "tr" ? "ISI HARİTASI" : "HEATMAP"}
              </button>
            ))}
            <button
              onClick={load}
              style={{ padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "1px solid #30363d", background: "transparent", color: "#e6edf3", borderRadius: 4, cursor: "pointer" }}
            >
              {locale === "tr" ? "YENİLE" : "REFRESH"}
            </button>
            <button
              onClick={downloadXLS}
              disabled={filtered.length === 0}
              style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #3fb950", background: "#3fb95020",
                color: filtered.length === 0 ? "#8b949e" : "#3fb950",
                borderRadius: 4, cursor: filtered.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              XLS ↓
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
            style={{
              background: "#161b22", border: `1px solid ${searchQuery ? ACCENT : "#30363d"}`,
              color: "#e6edf3", padding: "3px 8px", borderRadius: 3,
              fontSize: 11, fontFamily: "monospace", width: 110, outline: "none",
            }}
          />
          <div style={{ width: 1, background: "#30363d", margin: "0 2px", alignSelf: "stretch" }} />
          {([
            { v: "", l: locale === "tr" ? "TÜMÜ" : "ALL" },
            { v: "fixed", l: locale === "tr" ? "YATIRIMLIK" : "FIXED" },
            { v: "swing_daily", l: "SWING" },
          ] as const).map(({ v, l }) => (
            <button
              key={v || "all-src"}
              onClick={() => setFilterSource(v)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid", borderColor: filterSource === v ? ACCENT : "#30363d",
                background: filterSource === v ? ACCENT + "20" : "transparent",
                color: filterSource === v ? ACCENT : "#8b949e",
                borderRadius: 3, cursor: "pointer",
              }}
            >
              {l}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          {["", "AL", "İzle", "Bekle", "SAT"].map((s) => (
            <button
              key={s || "all-signal"}
              onClick={() => setFilterSignal(s)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid",
                borderColor: filterSignal === s ? SIGNAL_COLOR[s] || ACCENT : "#30363d",
                background: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) + "20" : "transparent",
                color: filterSignal === s ? SIGNAL_COLOR[s] || ACCENT : "#8b949e",
                borderRadius: 3, cursor: "pointer",
              }}
            >
              {s ? `${SIGNAL_ICON[s]} ${s}` : locale === "tr" ? "TÜM SİNYAL" : "ALL SIGNALS"}
            </button>
          ))}
        </div>
      </div>

      {!loading && !error && rows.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{t.empty}</div>}

      {/* ANA TABLO */}
      {activeTab === "table" && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 980 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {([
                  { label: "TICKER", key: null, align: "left" },
                  { label: "SEKTÖR", key: null, align: "left" },
                  { label: "FİYAT", key: "price", align: "right" },
                  { label: "HACİM", key: "volume", align: "right" },
                  { label: "Δ%", key: "change", align: "right" },
                  { label: "EMA20", key: "ema20", align: "right" },
                  { label: "EMA50", key: "ema50", align: "right" },
                  { label: "EMA200", key: "ema200", align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "MACD", key: "macd", align: "right" },
                  { label: "ADX", key: "adx", align: "right" },
                  { label: "PATERN", key: null, align: "right" },
                  { label: "SİNYAL", key: "signal", align: "right" },
                ] as { label: string; key: string | null; align: string }[]).map(({ label, key, align }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      padding: "7px 8px", textAlign: align as "left" | "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: sortBy === key && key ? ACCENT : "#58a6ff",
                      whiteSpace: "nowrap", background: "#0d1117",
                      cursor: key ? "pointer" : "default", userSelect: "none",
                    }}
                  >
                    {label}
                    {key && sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : key ? " ↕" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const isSwingDaily = r.source === "swing_daily";
                const isExpanded = expandedTicker === r.ticker;
                const signal = r.signal || "—";
                const rowBg = ROW_BG[signal] || (idx % 2 === 1 ? "#161b22" : "#0d1117");
                const bg = signal !== "—" ? rowBg : idx % 2 === 1 ? "#161b22" : "#0d1117";

                return (
                  <Fragment key={r.ticker}>
                    <tr
                      onClick={() => toggleExpand(r.ticker)}
                      style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }}
                    >
                      <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                        <span style={{ color: isSwingDaily ? "#58a6ff" : "#e6edf3", fontWeight: 900, fontSize: 13 }}>{r.ticker}</span>
                        <span style={{ color: isExpanded ? "#3fb950" : "#8b949e", marginLeft: 6, fontSize: 10 }}>{isExpanded ? "▼" : "▶"}</span>
                        {isSwingDaily && (
                          <span style={{ marginLeft: 6, fontSize: 8, background: "#1c243380", color: "#58a6ff", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>
                            {t.swingDailyBadge}
                          </span>
                        )}
                        <div style={{ color: "#8b949e", fontSize: 10, marginTop: 1 }}>{(r.sector || r.company || "").slice(0, 16)}</div>
                      </td>
                      <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, whiteSpace: "nowrap" }}>
                        {(r.sector || r.company || "—").toUpperCase().slice(0, 10)}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                        {r.price != null ? `$${fmt2(r.price)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(r.volume)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: r.change_pct == null ? "#8b949e" : r.change_pct >= 0 ? "#3fb950" : "#f85149" }}>
                        {r.change_pct != null ? `${r.change_pct >= 0 ? "+" : ""}${fmt2(r.change_pct)}%` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: emaColor(r.price, r.ema20) }}>
                        {r.ema20 != null ? `${fmt2(r.ema20)}${emaArrow(r.price, r.ema20)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: emaColor(r.price, r.ema50) }}>
                        {r.ema50 != null ? `${fmt2(r.ema50)}${emaArrow(r.price, r.ema50)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: emaColor(r.price, r.ema200) }}>
                        {r.ema200 != null ? `${fmt2(r.ema200)}${emaArrow(r.price, r.ema200)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: rsiColor(r.rsi) }}>{fmt1(r.rsi)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e" }}>{fmt3(r.macd)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e" }}>{fmt1(r.adx)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{r.pattern || "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        <span style={{ fontWeight: 900, fontSize: 12, color: SIGNAL_COLOR[signal] || "#8b949e" }}>
                          {SIGNAL_ICON[signal] || "○"} {signal}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                        <td colSpan={13} style={{ padding: 0 }}>
                          <TickerDetailPanel ticker={r.ticker} locale={locale} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ISI HARİTASI */}
      {activeTab === "heatmap" && rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 12, padding: "0 4px" }}>
            {locale === "tr" ? "Günlük Δ% ısı haritası — renk yoğunluğu değişim büyüklüğünü gösterir" : "Daily Δ% heatmap — color intensity shows magnitude of change"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6, padding: "0 4px" }}>
            {sorted.map((r) => {
              const { bg, text } = heatBg(r.change_pct);
              return (
                <button
                  key={r.ticker}
                  onClick={() => toggleExpand(r.ticker)}
                  style={{
                    background: bg, color: text, border: "1px solid #21262d", borderRadius: 4,
                    padding: "8px 6px", textAlign: "center", cursor: "pointer", fontFamily: "monospace",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{r.ticker}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>
                    {r.change_pct != null ? `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(1)}%` : "—"}
                  </div>
                </button>
              );
            })}
          </div>
          {expandedTicker && (
            <div style={{ marginTop: 12, border: "1px solid #30363d", borderRadius: 4, background: "#161b22" }}>
              <TickerDetailPanel ticker={expandedTicker} locale={locale} />
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap", padding: "0 4px" }}>
            {[
              { label: "+2%+", bg: "#0d4a0d", text: "#56d364" },
              { label: "+1–2%", bg: "#0d3a0d", text: "#3fb950" },
              { label: "+0.3–1%", bg: "#0d2a0d", text: "#3fb950" },
              { label: "±0.3%", bg: "#1a1a1a", text: "#8b949e" },
              { label: "-0.3–1%", bg: "#2a0d0d", text: "#f85149" },
              { label: "-1–2%", bg: "#3a0d0d", text: "#f85149" },
              { label: "-2%+", bg: "#4a0d0d", text: "#ff7b72" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, background: item.bg, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: item.text }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
