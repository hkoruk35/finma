"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCloudStore } from "@/hooks/useCloudStore";

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
}

interface LongTermData {
  tickers: string[];
  addDates: Record<string, string>;
  targetPrices: Record<string, number>;
  thesis: Record<string, string>;
  notes: Record<string, string>;
}

const SIGNAL_ICON: Record<string, string> = { AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");

export default function LongTermDetailClient() {
  const { data: longTermData, save: saveLongTerm, ready } = useCloudStore<LongTermData>({
    endpoint: { type: "longterm" },
    cacheKey: "longterm_main",
    defaultValue: { tickers: [], addDates: {}, targetPrices: {}, thesis: {}, notes: {} },
  });

  const tickers = longTermData.tickers;
  const addDates = longTermData.addDates;
  const targetPrices = longTermData.targetPrices;
  const thesis = longTermData.thesis;
  const notes = longTermData.notes;

  const [data, setData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [addInput, setAddInput] = useState("");
  const [addTarget, setAddTarget] = useState("");
  const [addThesis, setAddThesis] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const mounted = ready;

  const saveList = (list: string[], ad: Record<string, string>, tp: Record<string, number>) => {
    saveLongTerm({ tickers: list, addDates: ad, targetPrices: tp, thesis, notes });
  };

  const addTicker = () => {
    const sym = addInput.trim().toUpperCase();
    const target = parseFloat(addTarget) || 0;
    if (!sym || tickers.includes(sym)) return;

    const newTickers = [...tickers, sym];
    const newAddDates = { ...addDates, [sym]: new Date().toISOString().split('T')[0] };
    const newTargets = { ...targetPrices, [sym]: target };

    saveList(newTickers, newAddDates, newTargets);
    setAddInput("");
    setAddTarget("");
    setAddThesis("");
  };

  const removeTicker = (sym: string) => {
    const newList = tickers.filter(t => t !== sym);
    const { [sym]: _, ...newAddDates } = addDates;
    const { [sym]: __, ...newTargets } = targetPrices;
    saveList(newList, newAddDates, newTargets);
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
        console.warn(`[LongTerm] Missing data for: ${missingTickers.join(", ")} - retrying...`);
        setTimeout(() => fetchDataWithRetry(retryCount + 1), 2000);
      }

      setData(map);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[LongTerm] Fetch error:", err);
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
      case "HEDEF": valA = targetPrices[a] || 0; valB = targetPrices[b] || 0; break;
      case "POTANSIYEL": {
        const priceA = da?.price?.current ?? 0;
        const priceB = db?.price?.current ?? 0;
        const targetA = targetPrices[a] || 0;
        const targetB = targetPrices[b] || 0;
        valA = priceA > 0 ? ((targetA - priceA) / priceA) * 100 : 0;
        valB = priceB > 0 ? ((targetB - priceB) / priceB) * 100 : 0;
        break;
      }
      case "TARİH": valA = addDates[a] || ""; valB = addDates[b] || ""; break;
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
      <span style={{ color: "#14b8a6", fontFamily: "monospace" }} className="animate-pulse">loading...</span>
    </div>
  );

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3" }}>
      {/* Top Header */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 0 8px" }}>
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 8 }}>
          <Link href="/theme" style={{ color: "#58a6ff" }}>THEMES</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#14b8a6" }}>LONG-TERM</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#14b8a6", letterSpacing: "-0.5px" }}>
            BOGA TRACKER — Long-Term
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12 }}>
          {lastUpdated && <span>son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ET</span>}
          <span style={{ color: "#8b949e" }}>{tickers.length} oyun</span>
        </div>
      </div>

      {/* Table */}
      {tickers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 32, color: "#14b8a6", opacity: 0.2, marginBottom: 12 }}>∅</div>
          <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 16 }}>Uzun vadeli oyun listesi boş.</p>
          <p style={{ color: "#8b949e", fontSize: 11 }}>Makro trendler ve değer oyunları ekleyerek başlayın.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {["TICKER", "ŞIRKET", "SEKTÖR", "FİYAT", "HEDEF", "POTANSIYEL %", "TARİH", ""].map((h, i) => {
                  const isSortable = h && h !== "";
                  const isSorted = sortBy === h;
                  return (
                    <th key={i} onClick={() => isSortable && toggleSort(h)} style={{
                      padding: "7px 8px", textAlign: i === 0 ? "left" : "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: isSorted ? "#ffd700" : "#10b981", whiteSpace: "nowrap", background: "#0d1117",
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
                const target = targetPrices[sym] || 0;
                const potential = price > 0 ? ((target - price) / price) * 100 : 0;

                return (
                  <tr key={sym} style={{ background: idx % 2 === 1 ? "#161b22" : "#0d1117", borderBottom: "1px solid #21262d", cursor: "pointer" }}
                    onClick={() => setExpandedRow(expandedRow === sym ? null : sym)}>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 13 }}>{sym}</span>
                    </td>
                    <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d?.company ? d.company.slice(0, 12) : "—"}
                    </td>
                    <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d?.sector && d.sector !== "Unknown" ? d.sector.toUpperCase().slice(0, 10) : "—"}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                      ${fmt2(price)}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#14b8a6", fontWeight: 700 }}>
                      ${fmt2(target)}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                      color: potential >= 0 ? "#3fb950" : "#f85149"
                    }}>
                      {fmt2(potential)}%
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>
                      {addDates[sym] || "—"}
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
        <input value={addTarget} onChange={e => setAddTarget(e.target.value)} onKeyDown={e => e.key === "Enter" && addTicker()}
          placeholder="hedef $" type="number" step="0.01"
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
            padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 100, outline: "none" }} />
        <button onClick={addTicker}
          style={{ background: "#14b8a6" + "20", border: "1px solid #14b8a6", color: "#14b8a6",
            padding: "6px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>
          + EKLE
        </button>
        <span style={{ color: "#8b949e", fontSize: 11 }}>{tickers.length} oyun takipte</span>
      </div>
    </div>
  );
}
