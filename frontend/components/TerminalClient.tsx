"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import TVChartEmbed from "@/components/TVChartEmbed";
import { useSmartTracker } from "@/components/SmartTrackerContext";
import { computePnl } from "@/lib/smartTracker";

// ─── Types ────────────────────────────────────────────────────────────────────

type Instrument = {
  ticker: string;
  label: string;
  tvSymbol: string;
  ySymbol: string;
  isStock?: boolean; // has /stock/[ticker] page
};

type PriceInfo = { price: number | null; change_1d: number | null };

type HourlySignal = {
  ticker: string;
  status: string;
  status_detail: string;
  alert_level: string;
  current_price: number;
  intraday: { rsi_1h: number; trend_1h: string; volume_ratio: number };
};

// ─── Instrument Config ────────────────────────────────────────────────────────

const GROUPS: { group: string; items: Instrument[] }[] = [
  {
    group: "US Equity Markets",
    items: [
      { ticker: "SPY",  label: "S&P 500 ETF",    tvSymbol: "AMEX:SPY",   ySymbol: "SPY" },
      { ticker: "QQQ",  label: "Nasdaq 100",      tvSymbol: "NASDAQ:QQQ", ySymbol: "QQQ" },
      { ticker: "DIA",  label: "Dow Jones",        tvSymbol: "AMEX:DIA",   ySymbol: "DIA" },
      { ticker: "IWM",  label: "Russell 2000",     tvSymbol: "AMEX:IWM",   ySymbol: "IWM" },
      { ticker: "VXX",  label: "Volatility VXX",   tvSymbol: "CBOE:VXX",   ySymbol: "VXX" },
    ],
  },
  {
    group: "US Sectors",
    items: [
      { ticker: "XLK",  label: "Technology",          tvSymbol: "AMEX:XLK",  ySymbol: "XLK" },
      { ticker: "XLF",  label: "Financials",           tvSymbol: "AMEX:XLF",  ySymbol: "XLF" },
      { ticker: "XLE",  label: "Energy",               tvSymbol: "AMEX:XLE",  ySymbol: "XLE" },
      { ticker: "XLV",  label: "Health Care",          tvSymbol: "AMEX:XLV",  ySymbol: "XLV" },
      { ticker: "XLY",  label: "Cons. Discretionary",  tvSymbol: "AMEX:XLY",  ySymbol: "XLY" },
      { ticker: "XLP",  label: "Cons. Staples",        tvSymbol: "AMEX:XLP",  ySymbol: "XLP" },
      { ticker: "XLI",  label: "Industrials",          tvSymbol: "AMEX:XLI",  ySymbol: "XLI" },
      { ticker: "XLB",  label: "Materials",            tvSymbol: "AMEX:XLB",  ySymbol: "XLB" },
      { ticker: "XLRE", label: "Real Estate",          tvSymbol: "AMEX:XLRE", ySymbol: "XLRE" },
      { ticker: "XLU",  label: "Utilities",            tvSymbol: "AMEX:XLU",  ySymbol: "XLU" },
      { ticker: "XLC",  label: "Comm. Services",       tvSymbol: "AMEX:XLC",  ySymbol: "XLC" },
    ],
  },
  {
    group: "Currencies",
    items: [
      { ticker: "EURUSD", label: "EUR/USD", tvSymbol: "FX_IDC:EURUSD", ySymbol: "EURUSD=X" },
      { ticker: "GBPUSD", label: "GBP/USD", tvSymbol: "FX_IDC:GBPUSD", ySymbol: "GBPUSD=X" },
      { ticker: "USDJPY", label: "USD/JPY", tvSymbol: "FX_IDC:USDJPY", ySymbol: "JPY=X"    },
      { ticker: "USDCHF", label: "USD/CHF", tvSymbol: "FX_IDC:USDCHF", ySymbol: "CHF=X"    },
      { ticker: "AUDUSD", label: "AUD/USD", tvSymbol: "FX_IDC:AUDUSD", ySymbol: "AUDUSD=X" },
      { ticker: "USDCAD", label: "USD/CAD", tvSymbol: "FX_IDC:USDCAD", ySymbol: "CAD=X"    },
    ],
  },
  {
    group: "Commodities",
    items: [
      { ticker: "GOLD",   label: "Gold",         tvSymbol: "TVC:GOLD",   ySymbol: "GC=F" },
      { ticker: "SILVER", label: "Silver",        tvSymbol: "TVC:SILVER", ySymbol: "SI=F" },
      { ticker: "USOIL",  label: "Crude Oil WTI", tvSymbol: "TVC:USOIL",  ySymbol: "CL=F" },
      { ticker: "NATGAS", label: "Natural Gas",   tvSymbol: "TVC:NATGAS", ySymbol: "NG=F" },
    ],
  },
];

const ALL_INSTRUMENTS: Instrument[] = GROUPS.flatMap((g) => g.items);

// ─── Signal Config ─────────────────────────────────────────────────────────────

const SIGNAL_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ENTRY_NOW:      { label: "ENTRY NOW",      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  ENTRY_WATCH:    { label: "WATCH",          color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30"       },
  HOLD:           { label: "HOLD",           color: "text-teal-400",    bg: "bg-teal-500/10 border-teal-500/30"       },
  TIGHTEN_STOP:   { label: "TIGHTEN STOP",   color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/30"       },
  PARTIAL_PROFIT: { label: "PARTIAL PROFIT", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30"     },
  TAKE_PROFIT:    { label: "TAKE PROFIT",    color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30"   },
  WAIT:           { label: "WAIT",           color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/30"     },
  STOP_ALERT:     { label: "STOP ALERT",     color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30"         },
  STOP_HIT:       { label: "STOP HIT",       color: "text-red-500",     bg: "bg-red-600/10 border-red-600/30"         },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const pColor = (v: number | null) =>
  v == null ? "text-slate-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";

const sgn = (v: number) => (v > 0 ? "+" : "");

// ─── Interval options ──────────────────────────────────────────────────────────

const INTERVALS: { label: string; value: string }[] = [
  { label: "1m",  value: "1"  },
  { label: "5m",  value: "5"  },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "1h",  value: "60" },
  { label: "4h",  value: "240"},
  { label: "1D",  value: "D"  },
  { label: "1W",  value: "W"  },
];

// ─── InstrumentRow ─────────────────────────────────────────────────────────────

function InstrumentRow({
  inst,
  price,
  selected,
  checked,
  onSelect,
  onToggleCheck,
}: {
  inst: Instrument;
  price?: PriceInfo;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
}) {
  const chg = price?.change_1d ?? null;
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border-b border-[#1a2234] transition-colors ${
        selected ? "bg-[#1a2744]" : "hover:bg-white/[0.03]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleCheck}
        onClick={(e) => e.stopPropagation()}
        className="w-3 h-3 accent-[#3b82f6] shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-black text-white truncate">{inst.ticker}</span>
          {price?.price != null && (
            <span className="text-[11px] font-mono text-white">{fmt(price.price)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] text-slate-500 truncate">{inst.label}</span>
          {chg != null && (
            <span className={`text-[10px] font-mono font-bold ${pColor(chg)}`}>
              {sgn(chg)}{fmt(Math.abs(chg))}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── WatchlistRow ──────────────────────────────────────────────────────────────

function WatchlistRow({
  ticker,
  price,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  onRemove,
}: {
  ticker: string;
  price?: PriceInfo;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onRemove: () => void;
}) {
  const chg = price?.change_1d ?? null;
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-2 border-b border-[#1a2234] transition-colors ${
        selected ? "bg-[#1a2744]" : "hover:bg-white/[0.03]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleCheck}
        onClick={(e) => e.stopPropagation()}
        className="w-3 h-3 accent-[#3b82f6] shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-black text-white">{ticker}</span>
          {price?.price != null && (
            <span className="text-[11px] font-mono text-white">{fmt(price.price)}</span>
          )}
        </div>
        {chg != null && (
          <span className={`text-[10px] font-mono ${pColor(chg)}`}>
            {sgn(chg)}{fmt(Math.abs(chg))}%
          </span>
        )}
      </div>
      <Link
        href={`/stock/${ticker}`}
        className="text-[9px] text-[#3b82f6] hover:text-blue-300 px-1"
        title="Stock detail"
      >
        ↗
      </Link>
      <button
        onClick={onRemove}
        className="text-[10px] text-slate-600 hover:text-red-400 px-1"
      >
        ✕
      </button>
    </div>
  );
}

// ─── MultiScreen Overlay ───────────────────────────────────────────────────────

function MultiScreenOverlay({
  tickers,
  interval,
  getInstrument,
  onClose,
}: {
  tickers: string[];
  interval: string;
  getInstrument: (t: string) => { tvSymbol: string; label: string } | null;
  onClose: () => void;
}) {
  const [fullscreenTicker, setFullscreenTicker] = useState<string | null>(null);
  const count = tickers.length;
  const cols = count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : count <= 6 ? 3 : 4;

  // Single-chart fullscreen within the overlay
  if (fullscreenTicker) {
    const inst = getInstrument(fullscreenTicker);
    return (
      <div className="fixed inset-0 z-50 bg-[#060a12] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0e17] border-b border-[#1e2a3a] shrink-0">
          <span className="text-xs font-black text-white uppercase tracking-widest">
            {fullscreenTicker} <span className="text-slate-400 font-normal">{inst?.label}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreenTicker(null)}
              className="px-3 py-1.5 text-xs font-bold bg-[#141924] border border-[#1e2a3a] rounded text-[#3b82f6] hover:bg-[#1e2a3a] transition-colors"
            >
              ⊞ Grid View
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold bg-[#141924] border border-[#1e2a3a] rounded text-white hover:bg-[#1e2a3a] transition-colors"
            >
              ← Back to Normal View
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {inst && (
            <TVChartEmbed
              tvSymbol={inst.tvSymbol}
              interval={interval}
              containerId={`tv_fs_${fullscreenTicker}`}
              height={null}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#060a12] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0e17] border-b border-[#1e2a3a] shrink-0">
        <span className="text-xs font-black text-[#3b82f6] uppercase tracking-widest">
          Multi-Screen — {count} Chart{count !== 1 ? "s" : ""}
          <span className="ml-3 text-slate-500 font-normal normal-case">Click ⛶ to expand any chart</span>
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-bold bg-[#141924] border border-[#1e2a3a] rounded text-white hover:bg-[#1e2a3a] transition-colors"
        >
          ← Back to Normal View
        </button>
      </div>
      <div
        className="flex-1 grid gap-0.5 p-0.5 overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {tickers.map((ticker, i) => {
          const inst = getInstrument(ticker);
          if (!inst) return null;
          return (
            <div key={`${ticker}-${i}`} className="bg-[#0a0e17] border border-[#1a2234] rounded overflow-hidden flex flex-col group">
              <div className="flex items-center justify-between px-2 py-1 border-b border-[#1a2234] shrink-0">
                <span className="text-[10px] font-black text-white uppercase tracking-wide">
                  {ticker} <span className="text-slate-500 font-normal">{inst.label}</span>
                </span>
                <button
                  onClick={() => setFullscreenTicker(ticker)}
                  title="Full screen"
                  className="text-[11px] text-slate-500 hover:text-white transition-colors px-1"
                >
                  ⛶
                </button>
              </div>
              <div className="flex-1">
                <TVChartEmbed
                  tvSymbol={inst.tvSymbol}
                  interval={interval}
                  containerId={`tv_multi_${ticker}_${i}`}
                  height={null}
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TerminalClient() {
  const { activeTracker } = useSmartTracker();

  // Selected instrument (for main chart)
  const [selected, setSelected] = useState<Instrument>(GROUPS[0].items[0]);

  // Checked tickers (for multi-screen, max 12)
  const [checked, setChecked] = useState<string[]>([]);
  const [multiScreen, setMultiScreen] = useState(false);

  // Price data
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});

  // Hourly signals map: ticker → signal
  const [signals, setSignals] = useState<Record<string, HourlySignal>>({});

  // Chart interval
  const [chartInterval, setChartInterval] = useState("15");

  // Right panel tab
  const [rightTab, setRightTab] = useState<"daily" | "watchlist" | "positions">("daily");
  const [dailyPicks, setDailyPicks] = useState<any[]>([]);

  // Watchlist (localStorage)
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchInput, setWatchInput] = useState("");

  // Watchlist: selected ticker in right panel
  const [watchSelected, setWatchSelected] = useState<string | null>(null);

  // Sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Load watchlist from localStorage ────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("terminal_watchlist");
      if (saved) setWatchlist(JSON.parse(saved));
    } catch {}
  }, []);

  const saveWatchlist = (list: string[]) => {
    setWatchlist(list);
    try { localStorage.setItem("terminal_watchlist", JSON.stringify(list)); } catch {}
  };

  const addToWatchlist = () => {
    const t = watchInput.trim().toUpperCase();
    if (!t || watchlist.includes(t) || watchlist.length >= 30) return;
    saveWatchlist([...watchlist, t]);
    setWatchInput("");
  };

  // ── Fetch prices ─────────────────────────────────────────────────────────────
  const fetchPrices = useCallback(async (ySymbols: string[]) => {
    if (!ySymbols.length) return;
    try {
      const res = await fetch(`/api/quote?tickers=${ySymbols.join(",")}`);
      if (!res.ok) return;
      const data: Record<string, { price: number | null; change_1d: number | null }> = await res.json();
      setPrices((prev) => {
        const next = { ...prev };
        // Map ySymbol → ticker for display
        for (const inst of ALL_INSTRUMENTS) {
          if (data[inst.ySymbol]) next[inst.ticker] = data[inst.ySymbol];
        }
        // Also map direct ticker prices (for watchlist stocks)
        for (const [k, v] of Object.entries(data)) {
          if (!next[k]) next[k] = v;
        }
        return next;
      });
    } catch {}
  }, []);

  useEffect(() => {
    // Fetch instrument prices
    const ySymbols = ALL_INSTRUMENTS.map((i) => i.ySymbol);
    fetchPrices(ySymbols);
    const id = setInterval(() => fetchPrices(ySymbols), 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  useEffect(() => {
    if (!watchlist.length) return;
    fetchPrices(watchlist);
  }, [watchlist, fetchPrices]);

  // ── Fetch latest hourly signals ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const now = new Date();
      const slots: string[] = [];
      for (let h = 0; h <= 3; h++) {
        const d = new Date(now.getTime() - h * 3_600_000);
        const datePart = d.toISOString().slice(0, 10);
        const hourPart = String(d.getHours()).padStart(2, "0");
        slots.push(`${datePart}T${hourPart}`);
      }
      for (const slot of slots) {
        try {
          const res = await fetch(`/intraday_history/${slot}.json`);
          if (!res.ok) continue;
          const json = await res.json();
          const map: Record<string, HourlySignal> = {};
          for (const sig of json.signals ?? []) map[sig.ticker] = sig;
          setSignals(map);
          return;
        } catch {}
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch Daily Picks (Swing All) ──────────────────────────────────────────
  useEffect(() => {
    async function loadDaily() {
      try {
        const res = await fetch("/swing_all_picks.json?v=" + Date.now());
        if (res.ok) {
          const json = await res.json();
          setDailyPicks(json.picks || []);
        }
      } catch {}
    }
    loadDaily();
  }, []);

  // ── Toggle multi-screen ticker ────────────────────────────────────────────────
  const toggleCheck = (ticker: string) => {
    setChecked((prev) =>
      prev.includes(ticker)
        ? prev.filter((t) => t !== ticker)
        : prev.length < 12
        ? [...prev, ticker]
        : prev
    );
  };

  // ── Resolve instrument (from left panel or watchlist) ─────────────────────────
  const getInstrument = (ticker: string): { tvSymbol: string; label: string } | null => {
    const inst = ALL_INSTRUMENTS.find((i) => i.ticker === ticker);
    if (inst) return inst;
    // Watchlist stock: use NASDAQ prefix as fallback
    return { tvSymbol: ticker, label: ticker };
  };

  const selectWatchlistTicker = (ticker: string) => {
    setWatchSelected(ticker);
    const inst = getInstrument(ticker);
    if (inst) {
      setSelected({ ticker, label: inst.label, tvSymbol: inst.tvSymbol, ySymbol: ticker });
    }
  };

  const selectedSignal = signals[selected.ticker];
  const sigCfg = selectedSignal ? (SIGNAL_CFG[selectedSignal.status] ?? SIGNAL_CFG.WAIT) : null;

  const openPositions = (activeTracker?.positions ?? []).filter((p) => p.status === "open");

  return (
    <div className="flex h-full bg-[#060a12] overflow-hidden font-mono relative">

      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div className={`${sidebarOpen ? "w-[220px]" : "w-0"} transition-all duration-300 shrink-0 border-r border-[#1a2234] flex flex-col bg-[#080d18] overflow-hidden relative`}>
        <div className="px-3 py-2 border-b border-[#1a2234] shrink-0 flex items-center justify-between">
          <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest">Markets</span>
          {checked.length > 0 && (
            <span className="ml-2 text-[8px] text-slate-500">{checked.length}/12</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {GROUPS.map((group) => (
            <div key={group.group}>
              <div className="px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 bg-[#060a12] sticky top-0 z-10">
                {group.group}
              </div>
              {group.items.map((inst) => (
                <InstrumentRow
                  key={inst.ticker}
                  inst={inst}
                  price={prices[inst.ticker]}
                  selected={selected.ticker === inst.ticker}
                  checked={checked.includes(inst.ticker)}
                  onSelect={() => { setSelected(inst); setWatchSelected(null); }}
                  onToggleCheck={() => toggleCheck(inst.ticker)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Center Panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a2234] bg-[#080d18] shrink-0 flex-wrap">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors mr-1"
            title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          >
            <svg className={`w-4 h-4 text-slate-400 ${!sidebarOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Quick Nav */}
          {/* Quick Nav removed as requested */}
          {/* Symbol info */}
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm font-black text-white">{selected.ticker}</span>
            <span className="text-[10px] text-slate-400">{selected.label}</span>
            {prices[selected.ticker]?.price != null && (
              <span className="text-sm font-mono text-white">
                {fmt(prices[selected.ticker]!.price!)}
              </span>
            )}
            {prices[selected.ticker]?.change_1d != null && (
              <span className={`text-xs font-mono ${pColor(prices[selected.ticker]!.change_1d)}`}>
                {sgn(prices[selected.ticker]!.change_1d!)}{fmt(Math.abs(prices[selected.ticker]!.change_1d!))}%
              </span>
            )}
          </div>

          {/* Hourly signal badge */}
          {sigCfg && selectedSignal && (
            <div className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] ${sigCfg.bg}`}>
              <span className={`font-black ${sigCfg.color}`}>{sigCfg.label}</span>
              <span className="text-slate-400 hidden sm:inline truncate max-w-[200px]">
                {selectedSignal.status_detail}
              </span>
              {selectedSignal.intraday && (
                <>
                  <span className="text-slate-500">RSI {selectedSignal.intraday.rsi_1h.toFixed(0)}</span>
                  <span className="text-slate-500">{selectedSignal.intraday.trend_1h}</span>
                  <span className="text-slate-500">Vol {selectedSignal.intraday.volume_ratio.toFixed(1)}x</span>
                </>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Interval selector */}
          <div className="flex items-center gap-0.5 bg-[#0d1117] border border-[#1e2a3a] rounded px-1 py-0.5">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv.value)}
                className={`px-2 py-0.5 text-[9px] font-bold rounded transition-colors ${
                  chartInterval === iv.value
                    ? "bg-[#3b82f6] text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>

          {/* Multi-screen button */}
          {checked.length > 0 && (
            <button
              onClick={() => setMultiScreen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded hover:bg-[#3b82f6]/20 transition-colors"
            >
              <span>⊞</span> Multi-Screen ({checked.length})
            </button>
          )}

          {/* Detail link (only for stocks) */}
          {selected.isStock && (
            <Link
              href={`/stock/${selected.ticker}`}
              className="px-2 py-1 text-[9px] font-bold text-[#3b82f6] border border-[#3b82f6]/30 rounded hover:bg-[#3b82f6]/10"
            >
              Detail ↗
            </Link>
          )}
        </div>

        {/* Chart */}
        <div className="flex-1 overflow-hidden">
          <TVChartEmbed
            key={`${selected.ticker}-${chartInterval}`}
            tvSymbol={selected.tvSymbol}
            interval={chartInterval}
            containerId="tv_main_chart"
            height={undefined as any}
          />
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div className="w-[260px] shrink-0 border-l border-[#1a2234] flex flex-col bg-[#080d18] overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#1a2234] shrink-0">
          {(["daily", "watchlist", "positions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                rightTab === tab
                  ? "text-[#3b82f6] border-b-2 border-[#3b82f6] bg-[#3b82f6]/5"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab === "daily" ? "Daily" : tab === "watchlist" ? "Watchlist" : `Positions (${openPositions.length})`}
            </button>
          ))}
        </div>

        {/* Daily Tab */}
        {rightTab === "daily" && (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {dailyPicks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[11px] text-slate-600 text-center px-4">
                No daily picks found
              </div>
            ) : (
              dailyPicks.map((pick) => {
                const ticker = pick.ticker;
                const price = prices[ticker]?.price ?? pick.current_price;
                const chg = prices[ticker]?.change_1d ?? pick.change_1d;
                const score = pick.boga_score_100 || pick.score;

                return (
                  <div
                    key={ticker}
                    className={`px-3 py-2 border-b border-[#1a2234] transition-colors cursor-pointer ${
                      selected.ticker === ticker ? "bg-[#1a2744]" : "hover:bg-white/[0.03]"
                    }`}
                    onClick={() => {
                      setSelected({
                        ticker,
                        label: pick.company || ticker,
                        tvSymbol: ticker,
                        ySymbol: ticker
                      });
                      setWatchSelected(null);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-black text-white">{ticker}</span>
                        <span className="text-[10px] font-bold text-[#3b82f6] bg-[#3b82f6]/10 px-1 rounded">
                          {score.toFixed(0)}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-white">{fmt(price)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-slate-500 truncate max-w-[120px]">
                        {pick.company}
                      </span>
                      <span className={`text-[10px] font-mono ${pColor(chg)}`}>
                        {sgn(chg)}{fmt(Math.abs(chg))}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Watchlist Tab */}
        {rightTab === "watchlist" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Add ticker input */}
            <div className="flex gap-1 px-2 py-2 border-b border-[#1a2234] shrink-0">
              <input
                value={watchInput}
                onChange={(e) => setWatchInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addToWatchlist()}
                placeholder="Add ticker…"
                className="flex-1 bg-[#0d1117] border border-[#1e2a3a] rounded px-2 py-1 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-[#3b82f6]"
              />
              <button
                onClick={addToWatchlist}
                className="px-2 py-1 text-[10px] font-black bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded hover:bg-[#3b82f6]/20"
              >
                +
              </button>
            </div>

            {watchlist.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[11px] text-slate-600 text-center px-4">
                Add tickers to your watchlist
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {watchlist.map((ticker) => (
                  <WatchlistRow
                    key={ticker}
                    ticker={ticker}
                    price={prices[ticker]}
                    selected={watchSelected === ticker}
                    checked={checked.includes(ticker)}
                    onSelect={() => selectWatchlistTicker(ticker)}
                    onToggleCheck={() => toggleCheck(ticker)}
                    onRemove={() => saveWatchlist(watchlist.filter((t) => t !== ticker))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Positions Tab */}
        {rightTab === "positions" && (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {openPositions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[11px] text-slate-600 text-center px-4">
                No open positions
              </div>
            ) : (
              openPositions.map((pos) => {
                const pnl = computePnl(pos, pos.currentPrice);
                return (
                  <div
                    key={pos.id}
                    className="px-3 py-2.5 border-b border-[#1a2234] hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => {
                      setSelected({ ticker: pos.ticker, label: pos.ticker, tvSymbol: pos.ticker, ySymbol: pos.ticker });
                      setWatchSelected(null);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-black text-white">{pos.ticker}</span>
                      <span className={`text-[11px] font-mono font-bold ${pColor(pnl.pnlUsd)}`}>
                        {sgn(pnl.pnlUsd)}${fmt(Math.abs(pnl.pnlUsd))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">
                        Entry ${fmt(pos.entryPrice ?? 0)}
                      </span>
                      <span className={`text-[10px] font-mono ${pColor(pnl.pnlPct)}`}>
                        {sgn(pnl.pnlPct)}{fmt(Math.abs(pnl.pnlPct))}%
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[9px] text-slate-500">
                      <span className="text-emerald-600">T: ${fmt(pos.profitZoneHigh)}</span>
                      <span className="text-red-600">S: ${fmt(pos.stopZoneLow)}</span>
                    </div>
                    {signals[pos.ticker] && (
                      <div className={`mt-1 text-[8px] font-bold ${SIGNAL_CFG[signals[pos.ticker].status]?.color ?? "text-slate-400"}`}>
                        ⚡ {SIGNAL_CFG[signals[pos.ticker].status]?.label ?? signals[pos.ticker].status}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Multi-Screen Overlay ─────────────────────────────────────────────── */}
      {multiScreen && checked.length > 0 && (
        <MultiScreenOverlay
          tickers={checked}
          interval={chartInterval}
          getInstrument={getInstrument}
          onClose={() => setMultiScreen(false)}
        />
      )}
    </div>
  );
}
