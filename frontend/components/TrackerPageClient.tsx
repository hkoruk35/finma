"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTracker } from "@/components/TrackerContext";
import Link from "next/link";

interface TrackerData {
  ticker: string;
  company: string;
  sector: string;
  generated_at?: string;
  price: {
    current: number;
    prev_close: number;
    change_pct: number;
  };
  tracker_1h: {
    ema_20: number;
    ema_50: number;
    ema_200: number;
    ema_status: string;
    rsi: number;
    candle_pattern: string;
    signal: string;
    volume_ratio: number;
    change_pct_1h: number;
  };
}

type SortKey = "signal" | "rsi" | "ema_status" | "price" | "ticker";
type SortOrder = "asc" | "desc";

const fmt2 = (n: number | null | undefined) =>
  n != null && isFinite(n) ? n.toFixed(2) : "—";
const fmt1 = (n: number | null | undefined) =>
  n != null && isFinite(n) ? n.toFixed(1) : "—";

export function TrackerPageClient() {
  const { tickers, notes, types, removeFromTracker, updateNote, updateType } = useTracker();
  const [data, setData] = useState<Record<string, TrackerData>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("signal");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterSignal, setFilterSignal] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);

  const fetchTrackerData = useCallback(async () => {
    if (tickers.length === 0) {
      setData({});
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const results = await response.json();
      const dataMap: Record<string, TrackerData> = {};
      results.forEach((item: TrackerData) => {
        if (item?.ticker) dataMap[item.ticker] = item;
      });
      setData(dataMap);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch tracker data:", error);
    } finally {
      setLoading(false);
    }
  }, [tickers]);

  useEffect(() => {
    fetchTrackerData();
    const interval = setInterval(fetchTrackerData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrackerData]);

  const signalPriority: Record<string, number> = { "AL": 0, "İzle": 1, "Bekle": 2, "SAT": 3 };
  const emaPriority: Record<string, number> = { "Bullish": 0, "Yükseliş": 1, "Nötr": 2, "Düşüş": 3, "Bearish": 4 };

  const sortedTickers = useMemo(() => {
    const filtered = tickers.filter((ticker) => {
      const t = data[ticker];
      if (!t) return true;
      if (filterSignal && t.tracker_1h?.signal !== filterSignal) return false;
      if (filterType && types[ticker] !== filterType) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const dataA = data[a];
      const dataB = data[b];
      if (!dataA || !dataB) return 0;
      let cmp = 0;
      if (sortKey === "signal") {
        cmp = (signalPriority[dataA.tracker_1h?.signal ?? ""] ?? 2) - (signalPriority[dataB.tracker_1h?.signal ?? ""] ?? 2);
        if (cmp === 0) cmp = (dataB.tracker_1h?.rsi ?? 50) - (dataA.tracker_1h?.rsi ?? 50);
        if (cmp === 0) cmp = (emaPriority[dataA.tracker_1h?.ema_status ?? ""] ?? 2) - (emaPriority[dataB.tracker_1h?.ema_status ?? ""] ?? 2);
      } else if (sortKey === "rsi") {
        cmp = (dataB.tracker_1h?.rsi ?? 50) - (dataA.tracker_1h?.rsi ?? 50);
      } else if (sortKey === "ema_status") {
        cmp = (emaPriority[dataA.tracker_1h?.ema_status ?? ""] ?? 2) - (emaPriority[dataB.tracker_1h?.ema_status ?? ""] ?? 2);
      } else if (sortKey === "price") {
        cmp = (dataB.price?.current ?? 0) - (dataA.price?.current ?? 0);
      } else if (sortKey === "ticker") {
        cmp = a.localeCompare(b);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [tickers, data, sortKey, sortOrder, filterSignal, filterType, types]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortOrder("asc"); }
  };

  const handleEditNote = (ticker: string) => {
    setEditingNote(ticker);
    setNoteValue(notes[ticker] || "");
  };

  const handleSaveNote = (ticker: string) => {
    updateNote(ticker, noteValue);
    setEditingNote(null);
  };

  const getEMACellColor = (price: number, ema: number): string => {
    if (!ema) return "text-slate-400";
    if (price > ema) return "text-green-400";
    if (Math.abs(price - ema) / ema < 0.005) return "text-orange-400";
    return "text-red-400";
  };

  const getRSIColor = (rsi: number): string => {
    if (rsi >= 70) return "text-red-400";
    if (rsi >= 50) return "text-green-400";
    if (rsi >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getSignalBadge = (signal: string) => {
    if (signal === "AL") return "bg-green-600 text-white font-bold";
    if (signal === "İzle") return "bg-yellow-600 text-white";
    if (signal === "SAT") return "bg-red-600 text-white font-bold";
    return "bg-slate-700 text-slate-300";
  };

  const getVolumeColor = (ratio: number): string => {
    if (ratio >= 1.5) return "text-green-400";
    if (ratio >= 0.8) return "text-slate-300";
    return "text-slate-500";
  };

  const formatUpdated = (d: Date) => {
    return d.toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  if (tickers.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Tracker</h1>
        <p className="text-slate-400 mb-8">Real-time 1H technical monitoring</p>
        <div className="border border-white/10 rounded-lg p-8 text-center">
          <p className="text-slate-400 text-lg">Tracker listeniz boş. Diğer sayfalardan "Add to Tracker" butonunu kullanarak hisse ekleyin.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-0.5">Tracker Tablosu</h2>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>{sortedTickers.length} hisse — 1H teknik analiz</span>
            {lastUpdated && (
              <span className="text-slate-500">
                • Güncellendi: <span className="text-slate-300">{formatUpdated(lastUpdated)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={fetchTrackerData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm rounded font-semibold transition"
        >
          {loading ? "Güncelleniyor..." : "Yenile"}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <select
          value={filterSignal}
          onChange={(e) => setFilterSignal(e.target.value)}
          className="px-3 py-2 bg-black border border-white/15 text-white rounded text-sm"
        >
          <option value="">Tüm Sinyaller</option>
          <option value="AL">AL</option>
          <option value="İzle">İzle</option>
          <option value="Bekle">Bekle</option>
          <option value="SAT">SAT</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-black border border-white/15 text-white rounded text-sm"
        >
          <option value="">Tüm Tipler</option>
          <option value="Swing">Swing</option>
          <option value="Long">Long</option>
          <option value="Option">Option</option>
          <option value="CSP">CSP</option>
          <option value="CC">CC</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-xs md:text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-3 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("ticker")}>
                Ticker {sortKey === "ticker" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("price")}>
                Fiyat {sortKey === "price" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold">Değişim 1H</th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold">Hacim</th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold">EMA20</th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold">EMA50</th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold">EMA200</th>
              <th className="px-3 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("ema_status")}>
                EMA Durum {sortKey === "ema_status" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-3 py-3 text-right text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("rsi")}>
                RSI {sortKey === "rsi" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-3 py-3 text-left text-slate-300 font-semibold">Patern</th>
              <th className="px-3 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("signal")}>
                Sinyal {sortKey === "signal" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-3 py-3 text-left text-slate-300 font-semibold hidden md:table-cell">Not</th>
              <th className="px-3 py-3 text-center text-slate-300 font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sortedTickers.map((ticker, idx) => {
              const t = data[ticker];
              const isEditingNote = editingNote === ticker;
              const ch1h = t?.tracker_1h?.change_pct_1h ?? 0;
              const isOdd = idx % 2 === 1;

              return (
                <tr
                  key={ticker}
                  className={`border-b border-white/8 transition-colors hover:bg-white/5 ${isOdd ? "bg-white/[0.02]" : "bg-black"}`}
                >
                  {/* Ticker + Hover Chart */}
                  <td
                    className="px-3 py-3 relative"
                    onMouseEnter={() => setHoverTicker(ticker)}
                    onMouseLeave={() => setHoverTicker(null)}
                  >
                    <div className="flex flex-col gap-1.5">
                      <Link href={`/stock/${ticker}`} className="font-bold text-blue-400 hover:text-blue-300 leading-none">
                        {ticker}
                      </Link>
                      {t && (
                        <span className="text-slate-500 text-[10px] leading-none">
                          {t.sector && t.sector !== "Unknown" ? t.sector : t.company || ""}
                        </span>
                      )}
                    </div>

                    {/* TradingView chart hover popup */}
                    {hoverTicker === ticker && (
                      <div
                        className="absolute left-0 top-full mt-1 z-50 bg-[#0d1117] border border-white/15 rounded-lg shadow-2xl overflow-hidden"
                        style={{ width: 360, height: 230 }}
                      >
                        <iframe
                          src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${ticker}&symbol=${ticker}&interval=60&theme=dark&style=1&locale=en&hide_top_toolbar=1&hide_legend=1&save_image=0&withdateranges=0&hideideas=1&hide_side_toolbar=1`}
                          width="360"
                          height="230"
                          style={{ border: "none", display: "block" }}
                          title={`${ticker} 1H`}
                          loading="eager"
                          allow="fullscreen"
                        />
                      </div>
                    )}
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3 text-right text-white font-semibold">
                    {t ? `$${fmt2(t.price?.current)}` : <span className="text-slate-600">—</span>}
                  </td>

                  {/* 1H Change */}
                  <td className={`px-3 py-3 text-right font-semibold ${ch1h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t ? `${ch1h >= 0 ? "+" : ""}${fmt2(ch1h)}%` : "—"}
                  </td>

                  {/* Volume Ratio */}
                  <td className={`px-3 py-3 text-right ${getVolumeColor(t?.tracker_1h?.volume_ratio ?? 1)}`}>
                    {t ? `${fmt2(t.tracker_1h?.volume_ratio)}x` : "—"}
                  </td>

                  {/* EMA20 */}
                  <td className={`px-3 py-3 text-right font-mono ${getEMACellColor(t?.price?.current ?? 0, t?.tracker_1h?.ema_20 ?? 0)}`}>
                    {t ? `$${fmt2(t.tracker_1h?.ema_20)}` : "—"}
                  </td>

                  {/* EMA50 */}
                  <td className={`px-3 py-3 text-right font-mono ${getEMACellColor(t?.price?.current ?? 0, t?.tracker_1h?.ema_50 ?? 0)}`}>
                    {t ? `$${fmt2(t.tracker_1h?.ema_50)}` : "—"}
                  </td>

                  {/* EMA200 */}
                  <td className={`px-3 py-3 text-right font-mono ${getEMACellColor(t?.price?.current ?? 0, t?.tracker_1h?.ema_200 ?? 0)}`}>
                    {t ? `$${fmt2(t.tracker_1h?.ema_200)}` : "—"}
                  </td>

                  {/* EMA Status */}
                  <td className="px-3 py-3 text-left">
                    {t ? (
                      <span className={`px-2 py-0.5 rounded text-white text-xs font-semibold ${
                        t.tracker_1h?.ema_status === "Bullish" ? "bg-green-700" :
                        t.tracker_1h?.ema_status === "Yükseliş" ? "bg-green-800" :
                        t.tracker_1h?.ema_status === "Nötr" ? "bg-slate-700" :
                        t.tracker_1h?.ema_status === "Düşüş" ? "bg-red-800" :
                        "bg-red-700"
                      }`}>
                        {t.tracker_1h?.ema_status}
                      </span>
                    ) : "—"}
                  </td>

                  {/* RSI */}
                  <td className={`px-3 py-3 text-right font-semibold ${getRSIColor(t?.tracker_1h?.rsi ?? 50)}`}>
                    {t ? fmt1(t.tracker_1h?.rsi) : "—"}
                  </td>

                  {/* Pattern */}
                  <td className="px-3 py-3 text-left text-slate-400 text-xs">
                    {t?.tracker_1h?.candle_pattern || "—"}
                  </td>

                  {/* Signal */}
                  <td className="px-3 py-3 text-left">
                    {t ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getSignalBadge(t.tracker_1h?.signal)}`}>
                        {t.tracker_1h?.signal}
                      </span>
                    ) : "—"}
                  </td>

                  {/* Note */}
                  <td className="px-3 py-3 text-left hidden md:table-cell">
                    {isEditingNote ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveNote(ticker)}
                          className="flex-1 px-2 py-1 bg-black border border-white/20 text-white rounded text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNote(ticker)}
                          className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleEditNote(ticker)}
                        className="text-slate-500 text-xs cursor-pointer hover:text-slate-300 truncate max-w-[120px]"
                      >
                        {notes[ticker] || "—"}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex gap-1.5 justify-center items-center">
                      {/* Type selector inline with actions */}
                      <select
                        value={types[ticker] || "Swing"}
                        onChange={(e) => updateType(ticker, e.target.value)}
                        className="text-xs px-1.5 py-1 bg-black border border-white/15 text-slate-300 rounded"
                      >
                        <option>Swing</option>
                        <option>Long</option>
                        <option>Option</option>
                        <option>CSP</option>
                        <option>CC</option>
                      </select>
                      <Link
                        href={`/stock/${ticker}`}
                        className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded whitespace-nowrap"
                      >
                        Detay
                      </Link>
                      <button
                        onClick={() => removeFromTracker(ticker)}
                        className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded"
                      >
                        Kaldır
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && tickers.length > 0 && Object.keys(data).length === 0 && (
        <div className="text-center py-12 text-slate-500">Veriler yükleniyor...</div>
      )}
    </div>
  );
}
