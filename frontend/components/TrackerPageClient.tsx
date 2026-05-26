"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTracker } from "@/components/TrackerContext";
import Link from "next/link";

interface TrackerData {
  ticker: string;
  company: string;
  sector: string;
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
  };
}

type SortKey = "signal" | "rsi" | "ema_status" | "price" | "ticker";
type SortOrder = "asc" | "desc";

export function TrackerPageClient() {
  const { tickers, notes, types, removeFromTracker, updateNote, updateType } = useTracker();
  const [data, setData] = useState<Record<string, TrackerData>>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("signal");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterSignal, setFilterSignal] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);

  // Fetch tracker data
  const fetchTrackerData = useCallback(async () => {
    if (tickers.length === 0) {
      setData({});
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      const results = await response.json();
      const dataMap: Record<string, TrackerData> = {};
      results.forEach((item: any) => {
        dataMap[item.ticker] = item;
      });
      setData(dataMap);
    } catch (error) {
      console.error("Failed to fetch tracker data:", error);
    } finally {
      setLoading(false);
    }
  }, [tickers]);

  useEffect(() => {
    fetchTrackerData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchTrackerData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrackerData]);

  // Sort logic: Signal priority > RSI desc > EMA Status
  const signalPriority: Record<string, number> = {
    "AL": 0,
    "İzle": 1,
    "Bekle": 2,
    "SAT": 3,
  };

  const emaPriority: Record<string, number> = {
    "Bullish": 0,
    "Yükseliş": 1,
    "Nötr": 2,
    "Düşüş": 3,
    "Bearish": 4,
  };

  const sortedTickers = useMemo(() => {
    let filtered = tickers.filter((ticker) => {
      const t = data[ticker];
      if (!t) return true;
      if (filterSignal && t.tracker_1h.signal !== filterSignal) return false;
      if (filterType && types[ticker] !== filterType) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const dataA = data[a];
      const dataB = data[b];

      if (!dataA || !dataB) return 0;

      let cmp = 0;

      if (sortKey === "signal") {
        cmp = signalPriority[dataA.tracker_1h.signal] - signalPriority[dataB.tracker_1h.signal];
        if (cmp === 0) {
          cmp = dataB.tracker_1h.rsi - dataA.tracker_1h.rsi; // RSI descending
          if (cmp === 0) {
            cmp = emaPriority[dataA.tracker_1h.ema_status] - emaPriority[dataB.tracker_1h.ema_status];
          }
        }
      } else if (sortKey === "rsi") {
        cmp = dataB.tracker_1h.rsi - dataA.tracker_1h.rsi;
      } else if (sortKey === "ema_status") {
        cmp = emaPriority[dataA.tracker_1h.ema_status] - emaPriority[dataB.tracker_1h.ema_status];
      } else if (sortKey === "price") {
        cmp = dataB.price.current - dataA.price.current;
      } else if (sortKey === "ticker") {
        cmp = a.localeCompare(b);
      }

      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [tickers, data, sortKey, sortOrder, filterSignal, filterType, types]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleEditNote = (ticker: string) => {
    setEditingNote(ticker);
    setNoteValue(notes[ticker] || "");
  };

  const handleSaveNote = (ticker: string) => {
    updateNote(ticker, noteValue);
    setEditingNote(null);
  };

  const getRowBackground = (t: TrackerData): string => {
    const { ema_status, rsi, volume_ratio, signal } = t.tracker_1h;
    const isBullish = ema_status === "Bullish";
    const hasGoodRSI = rsi >= 50 && rsi <= 70;
    const hasGoodVolume = volume_ratio >= 0.8;

    if (isBullish && hasGoodRSI && hasGoodVolume) return "bg-green-950";
    if (signal === "AL") return "bg-green-950";
    if (signal === "İzle") return "bg-yellow-950";
    if (ema_status === "Bearish" || signal === "SAT") return "bg-red-950";
    return "bg-slate-900";
  };

  const getEMACellColor = (price: number, ema: number): string => {
    const diff = Math.abs(price - ema) / ema;
    if (price > ema) return "text-green-400";
    if (diff < 0.005) return "text-orange-400";
    return "text-red-400";
  };

  const getRSIColor = (rsi: number): string => {
    if (rsi >= 70) return "text-red-400";
    if (rsi >= 50) return "text-green-400";
    if (rsi >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getSignalColor = (signal: string): string => {
    if (signal === "AL") return "text-green-400 font-bold";
    if (signal === "İzle") return "text-yellow-400";
    if (signal === "SAT") return "text-red-400 font-bold";
    return "text-slate-400";
  };

  const getVolumeColor = (ratio: number): string => {
    if (ratio >= 1.5) return "text-green-400";
    if (ratio >= 0.8) return "text-slate-300";
    return "text-gray-500";
  };

  if (tickers.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Tracker</h1>
        <p className="text-slate-400 mb-8">Real-time 1H technical monitoring with signals and entry analysis</p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400 text-lg">Tracker listeniz boş. Diğer sayfalardan "Add to Tracker" butonunu kullanarak hisse ekleyin.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Tracker Tablosu</h2>
            <p className="text-slate-400">
              {sortedTickers.length} hisse takip ediliyor — 1H teknik analiz
            </p>
          </div>
          <button
            onClick={fetchTrackerData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-semibold transition"
          >
            {loading ? "Güncelleniyor..." : "Yenile"}
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-3 flex-wrap">
          <select
            value={filterSignal}
            onChange={(e) => setFilterSignal(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded text-sm"
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
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded text-sm"
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-2 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("ticker")}>
                  Ticker {sortKey === "ticker" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold">Fiyat</th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold">Değişim %</th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold">Hacim</th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("rsi")}>
                  EMA20 {sortKey === "rsi" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold">EMA50</th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold">EMA200</th>
                <th className="px-2 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("ema_status")}>
                  EMA Durum {sortKey === "ema_status" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-2 py-3 text-right text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("rsi")}>
                  RSI {sortKey === "rsi" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-2 py-3 text-left text-slate-300 font-semibold">Patern</th>
                <th className="px-2 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white" onClick={() => handleSort("signal")}>
                  Sinyal {sortKey === "signal" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-2 py-3 text-left text-slate-300 font-semibold hidden md:table-cell">Not</th>
                <th className="px-2 py-3 text-center text-slate-300 font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sortedTickers.map((ticker) => {
                const t = data[ticker];
                if (!t) return null;
                const isEditingNote = editingNote === ticker;

                return (
                  <tr key={ticker} className={`border-b border-slate-700/50 ${getRowBackground(t)} hover:bg-slate-800/30 transition`}>
                    {/* Ticker + Type + Hover Chart */}
                    <td
                      className="px-2 py-2 relative"
                      onMouseEnter={() => setHoverTicker(ticker)}
                      onMouseLeave={() => setHoverTicker(null)}
                    >
                      <div className="flex flex-col gap-1">
                        <Link href={`/stock/${ticker}`} className="font-bold text-blue-400 hover:text-blue-300">
                          {ticker}
                        </Link>
                        <select
                          value={types[ticker] || "Swing"}
                          onChange={(e) => updateType(ticker, e.target.value)}
                          className="text-xs px-1 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded"
                        >
                          <option>Swing</option>
                          <option>Long</option>
                          <option>Option</option>
                          <option>CSP</option>
                          <option>CC</option>
                        </select>
                      </div>

                      {/* TradingView Mini Chart Hover - Disabled for stability */}
                      {hoverTicker === ticker && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded p-3 shadow-lg" style={{ width: "280px" }}>
                          <div className="text-white text-xs font-semibold mb-2">{ticker} — Quick Link</div>
                          <a
                            href={`https://www.tradingview.com/chart/?symbol=${ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded text-center transition"
                          >
                            View on TradingView (1H)
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-2 py-2 text-right text-white font-semibold">${t.price.current.toFixed(2)}</td>

                    {/* Change % */}
                    <td className={`px-2 py-2 text-right font-semibold ${t.price.change_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.price.change_pct >= 0 ? "+" : ""}{t.price.change_pct.toFixed(2)}%
                    </td>

                    {/* Volume Ratio */}
                    <td className={`px-2 py-2 text-right ${getVolumeColor(t.tracker_1h.volume_ratio)}`}>
                      {t.tracker_1h.volume_ratio.toFixed(2)}x
                    </td>

                    {/* EMA20 */}
                    <td className={`px-2 py-2 text-right font-semibold ${getEMACellColor(t.price.current, t.tracker_1h.ema_20)}`}>
                      ${t.tracker_1h.ema_20.toFixed(2)}
                    </td>

                    {/* EMA50 */}
                    <td className={`px-2 py-2 text-right font-semibold ${getEMACellColor(t.price.current, t.tracker_1h.ema_50)}`}>
                      ${t.tracker_1h.ema_50.toFixed(2)}
                    </td>

                    {/* EMA200 */}
                    <td className={`px-2 py-2 text-right font-semibold ${getEMACellColor(t.price.current, t.tracker_1h.ema_200)}`}>
                      ${t.tracker_1h.ema_200.toFixed(2)}
                    </td>

                    {/* EMA Status */}
                    <td className="px-2 py-2 text-left">
                      <span className={`px-2 py-1 rounded text-white text-xs font-semibold ${
                        t.tracker_1h.ema_status === "Bullish" ? "bg-green-700" :
                        t.tracker_1h.ema_status === "Yükseliş" ? "bg-green-800" :
                        t.tracker_1h.ema_status === "Nötr" ? "bg-slate-700" :
                        t.tracker_1h.ema_status === "Düşüş" ? "bg-red-800" :
                        "bg-red-700"
                      }`}>
                        {t.tracker_1h.ema_status}
                      </span>
                    </td>

                    {/* RSI */}
                    <td className={`px-2 py-2 text-right font-semibold ${getRSIColor(t.tracker_1h.rsi)}`}>
                      {t.tracker_1h.rsi.toFixed(1)}
                    </td>

                    {/* Pattern */}
                    <td className="px-2 py-2 text-left text-slate-400 text-xs">{t.tracker_1h.candle_pattern}</td>

                    {/* Signal */}
                    <td className={`px-2 py-2 text-left ${getSignalColor(t.tracker_1h.signal)}`}>
                      {t.tracker_1h.signal}
                    </td>

                    {/* Note */}
                    <td className="px-2 py-2 text-left hidden md:table-cell">
                      {isEditingNote ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 text-white rounded text-xs"
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
                          className="text-slate-400 text-xs cursor-pointer hover:text-slate-300 truncate"
                        >
                          {notes[ticker] || "—"}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <Link
                          href={`/stock/${ticker}`}
                          className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded"
                        >
                          Detay
                        </Link>
                        <Link
                          href={`/stock/${ticker}?deepAnalysis=true`}
                          className="px-2 py-1 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded"
                        >
                          Derin
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
      </div>
    </div>
  );
}
