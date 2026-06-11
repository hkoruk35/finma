"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useCloudStore } from "@/hooks/useCloudStore";

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
  price: { current: number; change_pct: number; volume: number; avg_volume_30d?: number };
  tracker_1h: {
    ema_20: number; ema_50: number; ema_200: number;
    ema_status: string; rsi: number; candle_pattern: string;
    signal: string; volume_ratio: number; change_pct_1h: number;
  };
  hourly?: HourlyBar[];
}

interface PortfolioData {
  tickers: string[];
  quantities: Record<string, number>;
  entryPrices: Record<string, number>;
  notes: Record<string, string>;
}

const PORTFOLIO_CFG = {
  label: "Portföy Takip",
  storageKey: "portfolio_watchlist",
  accent: "#ec4899",
} as const;

const SIGNAL_ICON: Record<string, string> = { AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");
const fmtVol = (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : String(v);

function rsiColor(rsi: number) {
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

export default function PortfolioDetailClient() {
  const { data: portfolioData, save: savePortfolio, ready } = useCloudStore<PortfolioData>({
    endpoint: { type: "portfolio" },
    cacheKey: "portfolio_main",
    defaultValue: { tickers: [], quantities: {}, entryPrices: {}, notes: {} },
  });

  const tickers = portfolioData.tickers;
  const quantities = portfolioData.quantities;
  const entryPrices = portfolioData.entryPrices;
  const notes = portfolioData.notes;

  const [data, setData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [addInput, setAddInput] = useState("");
  const [addQty, setAddQty] = useState("100");
  const [addEntry, setAddEntry] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const mounted = ready;

  const saveList = (list: string[], q: Record<string, number>, ep: Record<string, number>) => {
    savePortfolio({ tickers: list, quantities: q, entryPrices: ep, notes });
  };

  const addTicker = () => {
    const sym = addInput.trim().toUpperCase();
    const qty = parseInt(addQty) || 100;
    const entry = parseFloat(addEntry) || 0;
    if (!sym || tickers.includes(sym)) return;

    const newTickers = [...tickers, sym];
    const newQty = { ...quantities, [sym]: qty };
    const newEntry = { ...entryPrices, [sym]: entry };

    saveList(newTickers, newQty, newEntry);
    setAddInput("");
    setAddQty("100");
    setAddEntry("");
  };

  const removeTicker = (sym: string) => {
    const newList = tickers.filter(t => t !== sym);
    const { [sym]: _, ...newQty } = quantities;
    const { [sym]: __, ...newEntry } = entryPrices;
    saveList(newList, newQty, newEntry);
    if (expandedRow === sym) setExpandedRow(null);
  };

  const fetchDataWithRetry = useCallback(async (retryCount = 0) => {
    if (tickers.length === 0) { setData({}); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const results = await res.json();
      const map: Record<string, TickerData> = {};
      results.forEach((item: TickerData) => { if (item?.ticker) map[item.ticker] = item; });

      const missingTickers = tickers.filter(t => !map[t]);
      if (missingTickers.length > 0 && retryCount < 2) {
        console.warn(`[Portfolio] Missing data for: ${missingTickers.join(", ")} - retrying...`);
        setTimeout(() => fetchDataWithRetry(retryCount + 1), 2000);
      }

      setData(map);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[Portfolio] Fetch error:", err);
      if (retryCount < 1) {
        setTimeout(() => fetchDataWithRetry(retryCount + 1), 2000);
      }
    }
    finally { setLoading(false); }
  }, [tickers]);

  const fetchData = useCallback(() => fetchDataWithRetry(0), [fetchDataWithRetry]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedTickers = [...tickers].sort((a, b) => {
    if (!sortBy) return 0;
    const da = data[a];
    const db = data[b];
    let valA: any, valB: any;

    switch (sortBy) {
      case "TICKER": valA = a; valB = b; break;
      case "FİYAT": valA = da?.price?.current ?? 0; valB = db?.price?.current ?? 0; break;
      case "PARITE": {
        const priceA = da?.price?.current ?? 0;
        const priceB = db?.price?.current ?? 0;
        valA = (priceA - (entryPrices[a] || 0)) / (entryPrices[a] || 1);
        valB = (priceB - (entryPrices[b] || 0)) / (entryPrices[b] || 1);
        break;
      }
      case "MİKTAR": valA = quantities[a] || 0; valB = quantities[b] || 0; break;
      case "TOPLAM": {
        const totalA = (da?.price?.current ?? 0) * (quantities[a] || 0);
        const totalB = (db?.price?.current ?? 0) * (quantities[b] || 0);
        valA = totalA; valB = totalB;
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

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d1117" }}>
      <span style={{ color: "#ec4899", fontFamily: "monospace" }} className="animate-pulse">loading...</span>
    </div>
  );

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3" }}>
      {/* Top Header */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 0 8px" }}>
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 8 }}>
          <Link href="/theme" style={{ color: "#58a6ff" }}>THEMES</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#ec4899" }}>PORTFOLIO</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#ec4899", letterSpacing: "-0.5px" }}>
            BOGA TRACKER — Portföy
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12 }}>
          {lastUpdated && <span>son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ET</span>}
          <span style={{ color: "#8b949e" }}>{tickers.length} pozisyon</span>
          {tickers.length > 0 && (
            <span style={{ color: "#ec4899" }}>
              Total: ${(tickers.reduce((sum, t) => sum + ((data[t]?.price?.current ?? 0) * (quantities[t] || 0)), 0)).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {tickers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 32, color: "#ec4899", opacity: 0.2, marginBottom: 12 }}>∅</div>
          <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 16 }}>Portföyünüz boş.</p>
          <p style={{ color: "#8b949e", fontSize: 11 }}>Aşağıdan hisse ekleyerek portföyünüzü takip etmeye başlayın.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {["TICKER", "ŞIRKET", "FİYAT", "GÜNLÜK Δ%", "MİKTAR", "GİRİŞ", "PARITE %", "TOPLAM", ""].map((h, i) => {
                  const isSortable = h && h !== "";
                  const isSorted = sortBy === h;
                  return (
                    <th key={i} onClick={() => isSortable && toggleSort(h)} style={{
                      padding: "7px 8px", textAlign: i === 0 ? "left" : "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: isSorted ? "#ffd700" : "#3fb950", whiteSpace: "nowrap", background: "#0d1117",
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
              {sortedTickers.map((sym, idx) => {
                const d = data[sym];
                const price = d?.price?.current ?? 0;
                const entry = entryPrices[sym] || 0;
                const qty = quantities[sym] || 0;
                const parity = entry > 0 ? ((price - entry) / entry) * 100 : 0;
                const total = price * qty;

                return (
                  <tr key={sym} style={{ background: idx % 2 === 1 ? "#161b22" : "#0d1117", borderBottom: "1px solid #21262d", cursor: "pointer" }}
                    onClick={() => setExpandedRow(expandedRow === sym ? null : sym)}>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 13 }}>{sym}</span>
                    </td>
                    <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d?.company ? d.company.slice(0, 12) : "—"}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                      ${fmt2(price)}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                      color: (d?.tracker_1h?.change_pct_1h ?? 0) >= 0 ? "#3fb950" : "#f85149"
                    }}>
                      {d ? `${(d.tracker_1h?.change_pct_1h ?? 0) >= 0 ? "+" : ""}${fmt2(d.tracker_1h?.change_pct_1h)}%` : "—"}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                      {qty}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e" }}>
                      ${fmt2(entry)}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                      color: parity >= 0 ? "#3fb950" : "#f85149"
                    }}>
                      {fmt2(parity)}%
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                      ${fmt2(total)}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>
                      <button onClick={e => { e.stopPropagation(); removeTicker(sym); }}
                        style={{ background: "transparent", border: "1px solid #f85149", color: "#f85149",
                          borderRadius: 3, padding: "1px 6px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Ticker Form */}
      <div style={{
        marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 12,
        display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center"
      }}>
        <input value={addInput} onChange={e => setAddInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addTicker()}
          placeholder="ticker..." maxLength={8}
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
            padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 100, outline: "none" }} />
        <input value={addQty} onChange={e => setAddQty(e.target.value)} onKeyDown={e => e.key === "Enter" && addTicker()}
          placeholder="qty" type="number"
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
            padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 80, outline: "none" }} />
        <input value={addEntry} onChange={e => setAddEntry(e.target.value)} onKeyDown={e => e.key === "Enter" && addTicker()}
          placeholder="entry $" type="number" step="0.01"
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
            padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 100, outline: "none" }} />
        <button onClick={addTicker}
          style={{ background: "#ec4899" + "20", border: "1px solid #ec4899", color: "#ec4899",
            padding: "6px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>
          + EKLE
        </button>
        <span style={{ color: "#8b949e", fontSize: 11 }}>{tickers.length} pozisyon takipte</span>
      </div>
    </div>
  );
}
