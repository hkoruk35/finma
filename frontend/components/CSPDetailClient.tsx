"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

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
    signal: string; volume_ratio: number; change_pct_1h: number;
  };
  hourly?: HourlyBar[];
}

interface Props {
  slug: "525" | "2550" | "50250";
}

// ── Config ─────────────────────────────────────────────────────────────────

const CSP_CFG = {
  "525":   { label: "525 CSP",   range: "$5–$25",    storageKey: "terminal_watchlist_525csp",    accent: "#3fb950" },
  "2550":  { label: "2550 CSP",  range: "$25–$50",   storageKey: "terminal_watchlist_2550csp",   accent: "#58a6ff" },
  "50250": { label: "50250 CSP", range: "$50–$250",  storageKey: "terminal_watchlist_50250csp",  accent: "#d2a8ff" },
} as const;

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Swing:  { bg: "#1c2a1c", text: "#3fb950" },
  Long:   { bg: "#1c2433", text: "#58a6ff" },
  Option: { bg: "#2a1c2a", text: "#d2a8ff" },
  CSP:    { bg: "#2a2010", text: "#e3b341" },
  CC:     { bg: "#2a1c1c", text: "#f0883e" },
};

const SIGNAL_ICON: Record<string, string> = { AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };
const ROW_BG: Record<string, string> = { AL: "#0d1f0d", "İzle": "#1a1a0d", Bekle: "#0d1117", SAT: "#1f0d0d" };

const HOUR_SLOTS = ["09:15","10:00","11:00","12:00","13:00","14:00","15:00","16:00","16:15"];

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");
const fmtVol = (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : String(v);

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

// ── Component ──────────────────────────────────────────────────────────────

export default function CSPDetailClient({ slug }: Props) {
  const cfg = CSP_CFG[slug];
  const [tickers, setTickers] = useState<string[]>([]);
  const [types, setTypes] = useState<Record<string, string>>({});
  const [data, setData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [filterSignal, setFilterSignal] = useState("");
  const [filterType, setFilterType] = useState("");
  const [addInput, setAddInput] = useState("");
  const [addType, setAddType] = useState("CSP");
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Kullanıcı listeyi değiştirdiyse API yanıtı state'i EZMESİN
  const userModified = useRef(false);
  // En güncel değerleri ref'te tut (stale closure önleme)
  const tickersRef = useRef<string[]>([]);
  const typesRef = useRef<Record<string, string>>({});
  const notesRef = useRef<Record<string, string>>({});

  // ── Supabase'e kaydet (her zaman ref üzerinden — asla stale değer göndermez) ──
  const persistToAPI = useCallback((t: string[], ty: Record<string, string>, n: Record<string, string>) => {
    fetch(`/api/csp-watchlist/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: t, types: ty, notes: n }),
    }).catch(() => {});
  }, [slug]);

  const handleNoteChange = (sym: string, note: string) => {
    const updated = { ...notesRef.current, [sym]: note };
    notesRef.current = updated;
    setNotes(updated);
    persistToAPI(tickersRef.current, typesRef.current, updated);
  };

  // ── Mount: önce localStorage, sonra API (API kullanıcıyı ezmez) ──────────
  useEffect(() => {
    setMounted(true);
    userModified.current = false;

    async function load() {
      // 1. localStorage'dan anlık göster
      let localTickers: string[] = [];
      let localTypes: Record<string, string> = {};
      let localNotes: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(cfg.storageKey);
        if (raw) localTickers = JSON.parse(raw);
        const rawT = localStorage.getItem(cfg.storageKey + "_types");
        if (rawT) localTypes = JSON.parse(rawT);
        const rawN = localStorage.getItem(cfg.storageKey + "_notes");
        if (rawN) localNotes = JSON.parse(rawN);
      } catch {}

      if (localTickers.length > 0) {
        tickersRef.current = localTickers;
        typesRef.current = localTypes;
        notesRef.current = localNotes;
        setTickers(localTickers);
        setTypes(localTypes);
        setNotes(localNotes);
      }

      // 2. API'den taze veri çek
      try {
        const res = await fetch(`/api/csp-watchlist/${slug}`);
        if (!res.ok) throw new Error();
        const d = await res.json();

        // Kullanıcı bu sürede listeyi değiştirdiyse DOKUNMA
        if (userModified.current) return;

        if (d.tickers && d.tickers.length > 0) {
          // Supabase'de veri var → güncelle
          tickersRef.current = d.tickers;
          typesRef.current = d.types ?? {};
          notesRef.current = d.notes ?? {};
          setTickers(d.tickers);
          setTypes(d.types ?? {});
          setNotes(d.notes ?? {});
          // localStorage'ı da güncelle
          try {
            localStorage.setItem(cfg.storageKey, JSON.stringify(d.tickers));
            localStorage.setItem(cfg.storageKey + "_types", JSON.stringify(d.types ?? {}));
            localStorage.setItem(cfg.storageKey + "_notes", JSON.stringify(d.notes ?? {}));
          } catch {}
        } else if (localTickers.length > 0) {
          // Supabase boş ama localStorage'da veri var → Supabase'e yükle
          persistToAPI(localTickers, localTypes, localNotes);
        }
      } catch {
        // API başarısız → localStorage verisi zaten gösteriliyor, devam
      }
    }

    load();
  }, [slug, cfg.storageKey, persistToAPI]);

  // ── saveList: kullanıcı değişikliği — API'nin üzerine yazmasını engelle ──
  const saveList = (list: string[], t: Record<string, string>) => {
    userModified.current = true;  // Artık API gelip ezemesin
    tickersRef.current = list;
    typesRef.current = t;
    setTickers(list);
    setTypes(t);
    // localStorage'a anında yaz
    try {
      localStorage.setItem(cfg.storageKey, JSON.stringify(list));
      localStorage.setItem(cfg.storageKey + "_types", JSON.stringify(t));
    } catch {}
    // Supabase'e kaydet
    persistToAPI(list, t, notesRef.current);
  };

  const addTicker = () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym || tickers.includes(sym)) return;
    saveList([...tickers, sym], { ...types, [sym]: addType });
    setAddInput("");
  };

  const removeTicker = (sym: string) => {
    const newList = tickers.filter(t => t !== sym);
    const { [sym]: _, ...newTypes } = types;
    saveList(newList, newTypes);
    if (expandedRow === sym) setExpandedRow(null);
  };

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (tickers.length === 0) { setData({}); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      if (!res.ok) throw new Error();
      const results = await res.json();
      const map: Record<string, TickerData> = {};
      results.forEach((item: TickerData) => { if (item?.ticker) map[item.ticker] = item; });
      setData(map);
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  }, [tickers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered tickers ────────────────────────────────────────────────────
  const filtered = tickers.filter(sym => {
    const d = data[sym];
    if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
    if (filterType && (types[sym] || "CSP") !== filterType) return false;
    return true;
  });

  // ── Market status ───────────────────────────────────────────────────────
  const isMarketOpen = () => {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  };

  const alCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "AL").length;
  const izleCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "İzle").length;

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d1117" }}>
      <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">loading...</span>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3" }}>

      {/* ── Top Header ── */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 0 8px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 8 }}>
          <Link href="/theme" style={{ color: "#58a6ff" }}>THEMES</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: cfg.accent }}>CSP</span>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#e6edf3" }}>{cfg.label}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: cfg.accent, letterSpacing: "-0.5px" }}>
                BOGA TRACKER — {cfg.label}
              </span>
              <span style={{ fontSize: 12, color: "#8b949e" }}>{cfg.range}</span>
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

          <div style={{ display: "flex", gap: 6 }}>
            {/* Tab switcher */}
            {(["table", "heatmap"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid",
                  borderColor: activeTab === tab ? cfg.accent : "#30363d",
                  background: activeTab === tab ? cfg.accent + "20" : "transparent",
                  color: activeTab === tab ? cfg.accent : "#8b949e",
                  borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em"
                }}
              >
                {tab === "table" ? "ANA TABLO" : "ISI HARİTASI"}
              </button>
            ))}
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #30363d", background: "transparent",
                color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer"
              }}
            >
              {loading ? "..." : "YENİLE"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {["", "Swing", "Long", "Option", "CSP", "CC"].map(t => (
            <button
              key={t || "all-type"}
              onClick={() => setFilterType(t)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid", borderColor: filterType === t ? cfg.accent : "#30363d",
                background: filterType === t ? cfg.accent + "20" : "transparent",
                color: filterType === t ? cfg.accent : "#8b949e",
                borderRadius: 3, cursor: "pointer",
              }}
            >
              {t || "TÜM TİPLER"}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          {["", "AL", "İzle", "Bekle", "SAT"].map(s => (
            <button
              key={s || "all-signal"}
              onClick={() => setFilterSignal(s)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid",
                borderColor: filterSignal === s ? (SIGNAL_COLOR[s] || cfg.accent) : "#30363d",
                background: filterSignal === s ? (SIGNAL_COLOR[s] || cfg.accent) + "20" : "transparent",
                color: filterSignal === s ? (SIGNAL_COLOR[s] || cfg.accent) : "#8b949e",
                borderRadius: 3, cursor: "pointer",
              }}
            >
              {s ? `${SIGNAL_ICON[s]} ${s}` : "TÜM SİNYAL"}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* ANA TABLO TAB                                 */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === "table" && (
        <>
          {tickers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 32, color: cfg.accent, opacity: 0.2, marginBottom: 12 }}>∅</div>
              <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 16 }}>Bu listede henüz hisse yok.</p>
              <p style={{ color: "#8b949e", fontSize: 11 }}>Aşağıdan ticker ekleyin veya Terminal'deki {cfg.label} sekmesini kullanın.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #30363d" }}>
                    {["TICKER", "TİP", "SEKTÖR", "FİYAT", "Δ%", "H.ORAN", "EMA20", "EMA50", "EMA200", "DURUM", "RSI", "PATERN", "SİNYAL", "NOT", ""].map((h, i) => (
                      <th key={i} style={{
                        padding: "7px 8px", textAlign: i <= 2 ? "left" : i === 13 ? "left" : "right",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        color: "#3fb950", whiteSpace: "nowrap", background: "#0d1117"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sym, idx) => {
                    const d = data[sym];
                    const signal = d?.tracker_1h?.signal || "—";
                    const rowBg = ROW_BG[signal] || "#0d1117";
                    const altBg = idx % 2 === 1 ? "#161b22" : "#0d1117";
                    const bg = signal !== "—" ? rowBg : altBg;
                    const isExpanded = expandedRow === sym;
                    const tipKey = types[sym] || "CSP";
                    const tipStyle = TYPE_COLORS[tipKey] || TYPE_COLORS.CSP;
                    const price = d?.price?.current ?? 0;

                    return (
                      <>
                        <tr
                          key={sym}
                          style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }}
                          onClick={() => setExpandedRow(isExpanded ? null : sym)}
                        >
                          {/* TICKER */}
                          <td
                            style={{ padding: "7px 8px", whiteSpace: "nowrap" }}
                            onMouseEnter={e => {
                              e.stopPropagation();
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setHoverTicker(sym);
                              setHoverPos({ x: r.right + 10, y: r.top });
                            }}
                            onMouseLeave={() => { setHoverTicker(null); setHoverPos(null); }}
                            onClick={e => e.stopPropagation()}
                          >
                            <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 13 }}>{sym}</span>
                            {isExpanded && <span style={{ color: "#3fb950", marginLeft: 6, fontSize: 10 }}>▼</span>}
                            {!isExpanded && <span style={{ color: "#8b949e", marginLeft: 6, fontSize: 10 }}>▶</span>}
                          </td>

                          {/* TİP */}
                          <td style={{ padding: "7px 8px" }}>
                            <select
                              value={tipKey}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); saveList(tickers, { ...types, [sym]: e.target.value }); }}
                              style={{
                                background: tipStyle.bg, color: tipStyle.text,
                                border: "none", borderRadius: 3, fontSize: 10, fontWeight: 700,
                                padding: "2px 4px", cursor: "pointer", fontFamily: "monospace"
                              }}
                            >
                              {["Swing","Long","Option","CSP","CC"].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>

                          {/* SEKTÖR */}
                          <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, whiteSpace: "nowrap" }}>
                            {d?.sector && d.sector !== "Unknown" ? d.sector.toUpperCase().slice(0, 6) : (d?.company?.slice(0, 8) || "—")}
                          </td>

                          {/* FİYAT */}
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                            {d ? `$${fmt2(price)}` : <span style={{ color: "#8b949e" }}>—</span>}
                          </td>

                          {/* Δ% (1H) */}
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                            color: !d ? "#8b949e" : (d.tracker_1h?.change_pct_1h ?? 0) >= 0 ? "#3fb950" : "#f85149"
                          }}>
                            {d ? `${(d.tracker_1h?.change_pct_1h ?? 0) >= 0 ? "+" : ""}${fmt2(d.tracker_1h?.change_pct_1h)}%` : "—"}
                          </td>

                          {/* H.ORAN */}
                          <td style={{ padding: "7px 8px", textAlign: "right",
                            color: !d ? "#8b949e" : (d.tracker_1h?.volume_ratio ?? 0) >= 1.5 ? "#3fb950" : (d.tracker_1h?.volume_ratio ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e"
                          }}>
                            {d ? `${fmt2(d.tracker_1h?.volume_ratio)}x` : "—"}
                          </td>

                          {/* EMA20 */}
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                            color: d ? emaColor(price, d.tracker_1h?.ema_20) : "#8b949e"
                          }}>
                            {d ? `${fmt2(d.tracker_1h?.ema_20)}${emaArrow(price, d.tracker_1h?.ema_20)}` : "—"}
                          </td>

                          {/* EMA50 */}
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                            color: d ? emaColor(price, d.tracker_1h?.ema_50) : "#8b949e"
                          }}>
                            {d ? `${fmt2(d.tracker_1h?.ema_50)}${emaArrow(price, d.tracker_1h?.ema_50)}` : "—"}
                          </td>

                          {/* EMA200 */}
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                            color: d ? emaColor(price, d.tracker_1h?.ema_200) : "#8b949e"
                          }}>
                            {d ? `${fmt2(d.tracker_1h?.ema_200)}${emaArrow(price, d.tracker_1h?.ema_200)}` : "—"}
                          </td>

                          {/* DURUM */}
                          <td style={{ padding: "7px 8px", textAlign: "right" }}>
                            {d && (
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
                            )}
                          </td>

                          {/* RSI */}
                          <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                            color: d ? rsiColor(d.tracker_1h?.rsi ?? 50) : "#8b949e"
                          }}>
                            {d ? fmt1(d.tracker_1h?.rsi) : "—"}
                          </td>

                          {/* PATERN */}
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                            {d?.tracker_1h?.candle_pattern || "—"}
                          </td>

                          {/* SİNYAL */}
                          <td style={{ padding: "7px 8px", textAlign: "right" }}>
                            {d && (
                              <span style={{
                                fontWeight: 900, fontSize: 12,
                                color: SIGNAL_COLOR[signal] || "#8b949e"
                              }}>
                                {SIGNAL_ICON[signal] || "○"} {signal}
                              </span>
                            )}
                          </td>

                          {/* NOT */}
                          <NoteCell sym={sym} slug={slug} sharedNotes={notes} onNoteChange={handleNoteChange} />

                          {/* REMOVE */}
                          <td style={{ padding: "7px 8px", textAlign: "right" }}>
                            <button
                              onClick={e => { e.stopPropagation(); removeTicker(sym); }}
                              style={{
                                background: "transparent", border: "1px solid #f85149", color: "#f85149",
                                borderRadius: 3, padding: "1px 6px", fontSize: 10, cursor: "pointer", fontFamily: "monospace"
                              }}
                            >✕</button>
                          </td>
                        </tr>

                        {/* ── Genişleyen Satır ── */}
                        {isExpanded && (
                          <tr key={sym + "-expanded"} style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                            <td colSpan={15} style={{ padding: "0" }}>
                              <ExpandedRow sym={sym} d={d} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Add Ticker Form ── */}
          <div style={{
            marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 12,
            display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center"
          }}>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addTicker()}
              placeholder="ticker..."
              maxLength={8}
              style={{
                background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
                padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 100,
                outline: "none"
              }}
            />
            <select
              value={addType}
              onChange={e => setAddType(e.target.value)}
              style={{
                background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
                padding: "6px 8px", borderRadius: 4, fontSize: 12, fontFamily: "monospace"
              }}
            >
              {["Swing","Long","Option","CSP","CC"].map(t => <option key={t}>{t}</option>)}
            </select>
            <button
              onClick={addTicker}
              style={{
                background: cfg.accent + "20", border: `1px solid ${cfg.accent}`,
                color: cfg.accent, padding: "6px 16px", borderRadius: 4,
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace"
              }}
            >
              + EKLE
            </button>
            <span style={{ color: "#8b949e", fontSize: 11 }}>{tickers.length} hisse takipte</span>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ISI HARİTASI TAB                              */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === "heatmap" && (
        <HeatmapTab tickers={filtered} data={data} types={types} />
      )}

      {/* ── Fixed Hover Chart Popup ── */}
      {hoverTicker && hoverPos && (
        <div
          style={{
            position: "fixed",
            left: Math.min(hoverPos.x, window.innerWidth - 440),
            top: Math.max(8, Math.min(hoverPos.y, window.innerHeight - 270)),
            width: 430, zIndex: 9999,
            background: "#161b22", border: "1px solid #30363d",
            borderRadius: 6, overflow: "hidden", pointerEvents: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)"
          }}
          onMouseEnter={() => {}} onMouseLeave={() => { setHoverTicker(null); setHoverPos(null); }}
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
            title={`${hoverTicker} 1H`}
          />
        </div>
      )}
    </div>
  );
}

// ── Note Cell (inline edit) ────────────────────────────────────────────────

function NoteCell({ sym, slug, sharedNotes, onNoteChange }: {
  sym: string;
  slug: string;
  sharedNotes: Record<string, string>;
  onNoteChange: (sym: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(sharedNotes[sym] || "");

  useEffect(() => {
    setNote(sharedNotes[sym] || "");
  }, [sharedNotes, sym]);

  const save = (v: string) => {
    setNote(v);
    onNoteChange(sym, v);
  };

  if (editing) return (
    <td style={{ padding: "4px 8px" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 4 }}>
        <input
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { save(note); setEditing(false); } }}
          style={{
            background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
            padding: "2px 6px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", width: 90
          }}
        />
        <button onClick={() => { save(note); setEditing(false); }}
          style={{ background: "#1a3a1a", border: "1px solid #3fb950", color: "#3fb950",
            borderRadius: 3, padding: "1px 6px", fontSize: 10, cursor: "pointer" }}>✓</button>
      </div>
    </td>
  );

  return (
    <td
      style={{ padding: "7px 8px", color: note ? "#e6edf3" : "#8b949e", fontSize: 11,
        cursor: "text", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title={note || "not ekle..."}
    >
      {note || "—"}
    </td>
  );
}

// ── Expanded Row ───────────────────────────────────────────────────────────

function ExpandedRow({ sym, d }: { sym: string; d: TickerData | undefined }) {
  return (
    <div style={{ display: "flex", gap: 0, background: "#161b22" }}>
      {/* Hourly Grid */}
      <div style={{ flex: 1, padding: "12px 16px", borderRight: "1px solid #30363d" }}>
        <div style={{ fontSize: 10, color: "#3fb950", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
          SAATLİK ÖZET — {sym}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: "monospace" }}>
            <thead>
              <tr>
                {HOUR_SLOTS.map(h => (
                  <th key={h} style={{ padding: "3px 8px", color: "#8b949e", fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", borderBottom: "1px solid #30363d" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price row */}
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  const { bg, text } = heatBg(bar?.change_pct ?? null);
                  return (
                    <td key={h} style={{ padding: "4px 8px", textAlign: "center", background: bg, color: text, fontWeight: 700, minWidth: 52 }}>
                      {bar?.price != null ? `$${bar.price.toFixed(2)}` : "—"}
                    </td>
                  );
                })}
              </tr>
              {/* Δ% row */}
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  const { bg, text } = heatBg(bar?.change_pct ?? null);
                  return (
                    <td key={h} style={{ padding: "3px 8px", textAlign: "center", background: bg, color: text, fontSize: 10 }}>
                      {bar?.change_pct != null ? `${bar.change_pct >= 0 ? "+" : ""}${bar.change_pct.toFixed(1)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
              {/* Volume row */}
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  return (
                    <td key={h} style={{ padding: "3px 8px", textAlign: "center", color: "#8b949e", fontSize: 10 }}>
                      {bar?.volume != null ? fmtVol(bar.volume) : "—"}
                    </td>
                  );
                })}
              </tr>
              {/* Vol ratio row */}
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  const vr = bar?.volume_ratio;
                  return (
                    <td key={h} style={{ padding: "3px 8px", textAlign: "center",
                      color: vr == null ? "#333" : vr >= 1.5 ? "#3fb950" : vr >= 0.8 ? "#8b949e" : "#8b949e", fontSize: 10 }}>
                      {vr != null ? `${vr.toFixed(1)}x` : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {!d?.hourly && (
          <p style={{ color: "#8b949e", fontSize: 10, marginTop: 8 }}>
            Saatlik veriler tracker_update.py çalıştırıldığında burada görünür.
          </p>
        )}

        {/* Quick stats from available 1H data */}
        {d && (
          <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 10, color: "#8b949e" }}>
            <span>EMA Durum: <b style={{ color: d.tracker_1h?.ema_status === "Bullish" ? "#3fb950" : d.tracker_1h?.ema_status === "Bearish" ? "#f85149" : "#8b949e" }}>{d.tracker_1h?.ema_status}</b></span>
            <span>RSI-14: <b style={{ color: rsiColor(d.tracker_1h?.rsi ?? 50) }}>{fmt1(d.tracker_1h?.rsi)}</b></span>
            <span>Patern: <b style={{ color: "#e6edf3" }}>{d.tracker_1h?.candle_pattern || "—"}</b></span>
            <span>Hacim Oran: <b style={{ color: (d.tracker_1h?.volume_ratio ?? 0) >= 1.5 ? "#3fb950" : "#8b949e" }}>{fmt2(d.tracker_1h?.volume_ratio)}x</b></span>
          </div>
        )}
      </div>

      {/* TradingView Chart */}
      <div style={{ width: 420, flexShrink: 0, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "#3fb950", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
          1H GRAFİK — EMA 20/50/200
        </div>
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_exp_${sym}&symbol=${sym}&interval=D&theme=dark&style=1&locale=en&hide_top_toolbar=0&hide_legend=0&save_image=0&withdateranges=0&hideideas=1&hide_side_toolbar=1&studies=EMA@tv-basicstudies,EMA@tv-basicstudies,EMA@tv-basicstudies`}
          width="410" height="220"
          style={{ border: "1px solid #30363d", borderRadius: 4, display: "block" }}
          title={`${sym} 1H expanded`}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <a href={`https://finviz.com/quote.ashx?t=${sym}`} target="_blank" rel="noopener"
            style={{ color: "#58a6ff", fontSize: 10, textDecoration: "none" }}>Finviz ↗</a>
          <Link href={`/stock/${sym}`}
            style={{ color: "#58a6ff", fontSize: 10, textDecoration: "none" }}>BOGA Analiz ↗</Link>
          <Link href={`/optanaliz?symbol=${sym}`}
            style={{ color: "#d2a8ff", fontSize: 10, textDecoration: "none" }}>OptAnaliz ↗</Link>
        </div>
      </div>
    </div>
  );
}

// ── Heat Map Tab ───────────────────────────────────────────────────────────

function HeatmapTab({ tickers, data, types }: { tickers: string[]; data: Record<string, TickerData>; types: Record<string, string> }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 12 }}>
        Gün sonu saatlik Δ% ısı haritası — her hücre o saatin değişimini gösterir
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 750 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", color: "#3fb950", fontSize: 10, letterSpacing: "0.1em" }}>TICKER</th>
              <th style={{ padding: "6px 8px", textAlign: "left", color: "#3fb950", fontSize: 10 }}>TİP</th>
              {HOUR_SLOTS.map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "center", color: "#3fb950", fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
              ))}
              <th style={{ padding: "6px 10px", textAlign: "right", color: "#3fb950", fontSize: 10 }}>GÜN</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((sym, idx) => {
              const d = data[sym];
              const dayPct = d?.price?.change_pct ?? null;
              const dayColors = heatBg(dayPct);
              const tipKey = types[sym] || "CSP";
              const tipStyle = TYPE_COLORS[tipKey] || TYPE_COLORS.CSP;

              return (
                <tr key={sym} style={{ background: idx % 2 === 1 ? "#161b22" : "#0d1117", borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "6px 10px" }}>
                    <Link href={`/stock/${sym}`} style={{ color: "#58a6ff", fontWeight: 900 }}>{sym}</Link>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ background: tipStyle.bg, color: tipStyle.text, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2 }}>
                      {tipKey}
                    </span>
                  </td>
                  {HOUR_SLOTS.map((h, i) => {
                    const bar = d?.hourly?.[i];
                    const pct = bar?.change_pct ?? null;
                    const { bg, text } = heatBg(pct);
                    return (
                      <td key={h} style={{ padding: "6px 10px", textAlign: "center", background: bg, color: text, fontSize: 10, fontWeight: 700, minWidth: 58 }}>
                        {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : <span style={{ color: "#333" }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "6px 10px", textAlign: "right", background: dayColors.bg, color: dayColors.text, fontWeight: 700 }}>
                    {dayPct != null ? `${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "+2%+", bg: "#0d4a0d", text: "#56d364" },
          { label: "+1–2%", bg: "#0d3a0d", text: "#3fb950" },
          { label: "+0.3–1%", bg: "#0d2a0d", text: "#3fb950" },
          { label: "±0.3%", bg: "#1a1a1a", text: "#8b949e" },
          { label: "-0.3–1%", bg: "#2a0d0d", text: "#f85149" },
          { label: "-1–2%", bg: "#3a0d0d", text: "#f85149" },
          { label: "-2%+", bg: "#4a0d0d", text: "#ff7b72" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 14, height: 14, background: item.bg, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: item.text }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
