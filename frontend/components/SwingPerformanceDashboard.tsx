"use client";

import { useState, useMemo, useDeferredValue, useRef } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import type { Locale } from "@/lib/i18n/copy";
import TickerHoverChart from "./TickerHoverChart";
import PremiumModal from "@/components/global/PremiumModal";
import { formatNumber } from "@/lib/formatNumber";

const PAGE_SIZE = 50;

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface PerformanceStats {
  win_rate: number;
  avg_return_pct: number;
  total_picks: number;
  period_days: number;
  above_5pct_rate: number;
  above_10pct_rate: number;
  above_15pct_rate?: number;
  stop_loss_pct?: string | number;
  last_updated?: string;
  completed_count?: number;
  pending_count?: number;
}

interface Trade {
  date: string;
  ticker: string;
  company: string;
  sector: string;
  subsector: string;
  entry: number;
  max_price: number | null;
  sl_pct: number | null;
  return_pct: number | null;
  days: number | null;
  result: string;
  peak_date: string | null;
  ema50_1d?: number;
  active_sl_level?: number;
  peak_gain_pct?: number | null;
  is_duplicate?: boolean;
  entry_date?: string;
  entry_price?: number;
  atr_14?: number;
  stop_price?: number;
  stop_pct?: number;
  exit_date?: string;
  exit_price?: number;
  exit_reason?: string;
  realized_return_pct?: number;
  mfe_pct?: number;
  mae_pct?: number;
  holding_days?: number;
  hit_3?: boolean;
  hit_5?: boolean;
  hit_7?: boolean;
  hit_10?: boolean;
  hit_15?: boolean;
  hit_20?: boolean;
  days_to_3?: number | null;
  days_to_5?: number | null;
  days_to_7?: number | null;
  days_to_10?: number | null;
  days_to_15?: number | null;
  days_to_20?: number | null;
}

interface SwingPick {
  ticker: string;
  company?: string;
  sector?: string;
  score: number;
  rank?: number;
  current_price?: number;
  buy_zone?: { low: number; high: number };
  profit_zone?: { low: number; high: number };
  stop_zone?: { low: number; high: number };
  rsi?: number;
  adx?: number;
  rvol?: number;
  trend_status?: string;
  holding_period?: string;
}

interface Props {
  initialHistory: Trade[];
  stats?: PerformanceStats;
  todayPicks?: SwingPick[];
  picksGeneratedAt?: string;
  hideBotLink?: boolean;
  hideExportButtons?: boolean;
  /** When set, frontend applies this SL threshold (e.g. -7) overriding JSON result/return values. */
  applySlPct?: number;
  locale?: Locale;
  /** On /global/{locale}/performance, ticker clicks must not navigate anywhere â€”
   *  only the hover-preview chart is allowed. Root /performance keeps the normal link. */
  disableTickerLink?: boolean;
}

const METHODOLOGY_NOTE: Record<"en" | "tr" | "es" | "fr" | "pt" | "id", string> = {
  tr: "Metodoloji notu: Bu istatistikler 1 Ocak'tan itibaren Ã¼retilen tÃ¼m sinyalleri 20 iÅŸlem gÃ¼nÃ¼ boyunca disiplinli olarak takip eden v2 modeline dayanÄ±r. Sinyalden sonraki gÃ¼n aÃ§Ä±lÄ±ÅŸÄ±nda gap %3'ten fazlaysa iÅŸlem pas geÃ§ilir. Stop seviyesi 1.8x ATR (min %4, maks %10) ile belirlenir ve iÅŸlem maliyeti %0.1 dÃ¼ÅŸÃ¼lÃ¼r.",
  en: "Methodology note: These statistics are based on the v2 model tracking all signals generated since Jan 1 over a disciplined 20 trading-day window. Signals with a T+1 open gap > +3% are skipped. Stop loss is set at 1.8x ATR (min 4%, max 10%) and 0.1% transaction cost is deducted.",
  es: "Nota metodolÃ³gica: Estas estadÃ­sticas se basan en el modelo v2 que realiza un seguimiento disciplinado de todas las seÃ±ales desde el 1 de enero durante 20 dÃ­as de negociaciÃ³n. Se omiten las seÃ±ales con gap inicial > +3%. El stop loss es 1.8x ATR (mÃ­n 4%, mÃ¡x 10%) y se descuenta un 0.1% de costo.",
  fr: "Note mÃ©thodologique: Ces statistiques reposent sur le modÃ¨le v2 suivant toutes les lignes depuis le 1er janvier sur une fenÃªtre disciplinÃ©e de 20 jours de bourse. Les signaux avec un gap > +3% Ã  l'ouverture sont ignorÃ©s. Le stop-loss est de 1.8x ATR (min 4%, max 10%) et un coÃ»t de 0,1% est dÃ©duit.",
  pt: "Nota metodolÃ³gica: Essas estatÃ­sticas utilizam o modelo v2 acompanhando todas as sinalizaÃ§Ãµes desde 1Âº de janeiro em uma janela disciplinada de 20 dias Ãºteis. Sinais com gap de abertura > +3% sÃ£o desconsiderados. O stop loss Ã© de 1.8x ATR (mÃ­n 4%, mÃ¡x 10%) e Ã© descontado 0,1% de custo.",
  id: "Catatan metodologi: Statistik ini didasarkan pada model v2 yang melacak seluruh sinyal sejak 1 Januari secara disiplin selama jendela 20 hari perdagangan. Sinyal dengan gap pembukaan T+1 lebih dari +3% dilewati. Stop loss ditetapkan pada 1.8x ATR (min 4%, maks 10%) dan biaya transaksi 0.1% dikurangkan.",
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RESULT_COLORS: Record<string, string> = {
  WIN:     "text-[#22c55e] bg-[#22c55e]/10",
  LOSS:    "text-[#ef4444] bg-[#ef4444]/10",
  PENDING: "text-[#3b82f6] bg-[#3b82f6]/10",
  NO_DATA: "text-[#00d2ff] bg-transparent",
};

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "â€”";
  return formatNumber(n, dec);
}

function retColor(n: number | null | undefined): string {
  if (n == null) return "text-[#00d2ff]";
  return n > 0 ? "text-[#22c55e]" : n < 0 ? "text-[#ef4444]" : "text-white";
}

function pnlFromReturn(ret: number | null): number | null {
  if (ret == null) return null;
  return parseFloat((1000 * ret / 100).toFixed(2));
}


export default function SwingPerformanceDashboard({ initialHistory, stats: serverStats, todayPicks = [], picksGeneratedAt, hideBotLink = false, hideExportButtons = false, applySlPct, locale = "tr", disableTickerLink = false }: Props) {
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const SL_PCT = applySlPct ?? serverStats?.stop_loss_pct ?? -3.5; // Dynamic stop-loss from server or fallback
  const lastUpdated = serverStats?.last_updated;

  // Applies frontend SL cap if applySlPct is set; otherwise uses JSON values directly.
  const effectiveReturn = (t: Trade): number | null => {
    if (applySlPct != null && t.return_pct != null && t.return_pct < applySlPct) {
      return applySlPct;
    }
    return t.return_pct;
  };

  const effectiveResult = (t: Trade): string => {
    if (applySlPct != null && t.return_pct != null && t.return_pct < applySlPct) {
      return "LOSS";
    }
    return t.result;
  };

  const slTriggered = (t: Trade): boolean => {
    if (applySlPct != null && t.return_pct != null && t.return_pct < applySlPct) {
      return true;
    }
    return t.result === "LOSS";
  };
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showStats, setShowStats] = useState(true);
  const [selectedSector,    setSelectedSector]    = useState("All");
  const [selectedSubsector, setSelectedSubsector] = useState("All");
  const [selectedYear,      setSelectedYear]      = useState("All");
  const [selectedMonth,     setSelectedMonth]     = useState("All");
  const [selectedDate,      setSelectedDate]      = useState("");
  const [searchTicker,      setSearchTicker]      = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Trade; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pdfExporting, setPdfExporting] = useState(false);

  const deferredSector    = useDeferredValue(selectedSector);
  const deferredSubsector = useDeferredValue(selectedSubsector);
  const deferredYear      = useDeferredValue(selectedYear);
  const deferredMonth     = useDeferredValue(selectedMonth);
  const deferredDate      = useDeferredValue(selectedDate);
  const deferredTicker    = useDeferredValue(searchTicker);

  const formatLastUpdated = (isoString?: string) => {
    if (!isoString) return "â€”";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
        " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return "â€”"; }
  };

  // â”€â”€ Derived filter options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => { if (t.sector && t.sector !== "Unknown") s.add(t.sector); });
    return Array.from(s).sort();
  }, [initialHistory]);

  const subsectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => {
      if (t.subsector && t.subsector.trim() !== "" && t.subsector !== "Unknown" &&
        (selectedSector === "All" || t.sector === selectedSector)) s.add(t.subsector);
    });
    return Array.from(s).sort();
  }, [initialHistory, selectedSector]);

  const years = useMemo(() => {
    const y = new Set<string>();
    initialHistory.forEach(t => { if (t.date) y.add(t.date.slice(0, 4)); });
    return Array.from(y).sort((a, b) => b.localeCompare(a));
  }, [initialHistory]);

  const months = useMemo(() => {
    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const m = new Set<string>();
    initialHistory.forEach(t => {
      if (t.date && (selectedYear === "All" || t.date.startsWith(selectedYear))) m.add(t.date.slice(5, 7));
    });
    return Array.from(m).sort().map(mm => ({ value: mm, label: MONTH_NAMES[parseInt(mm) - 1] ?? mm }));
  }, [initialHistory, selectedYear]);

  // â”€â”€ Filtered + Sorted â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filtered = useMemo(() => {
    let data = initialHistory.filter(t => {
      if (deferredSector    !== "All" && t.sector    !== deferredSector)    return false;
      if (deferredSubsector !== "All" && t.subsector !== deferredSubsector) return false;
      if (deferredYear      !== "All" && !t.date.startsWith(deferredYear))  return false;
      if (deferredMonth     !== "All" && t.date.slice(5, 7) !== deferredMonth) return false;
      if (deferredDate && t.date !== deferredDate)                           return false;
      if (deferredTicker && !t.ticker.toLowerCase().includes(deferredTicker.toLowerCase())) return false;
      return true;
    });

    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      data.sort((a, b) => b.date.localeCompare(a.date));
    }
    return data;
  }, [initialHistory, deferredSector, deferredSubsector, deferredYear, deferredMonth, deferredDate, deferredTicker, sortConfig]);

  const resetPagination = () => setVisibleCount(PAGE_SIZE);
  const visibleTrades = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const expiredGap = filtered.filter(t => t.exit_reason === "EXPIRED_GAP" || t.result === "EXPIRED_GAP").length;
    const pending = filtered.filter(t => t.result === "PENDING" && !t.is_duplicate).length;

    // Active trades: non-duplicate, non-pending, non-expired-gap
    const activeStatsTrades = filtered.filter(t => !t.is_duplicate && t.result !== "PENDING" && t.result !== "EXPIRED_GAP" && t.exit_reason !== "EXPIRED_GAP" && effectiveReturn(t) != null);
    
    const wins = activeStatsTrades.filter(t => (effectiveReturn(t) ?? 0) > 0).length;
    const losses = activeStatsTrades.filter(t => (effectiveReturn(t) ?? 0) <= 0).length;
    const slHits = filtered.filter(t => !t.is_duplicate && (t.exit_reason === "STOP" || slTriggered(t))).length;
    const sumRet = activeStatsTrades.reduce((s, t) => s + (t.realized_return_pct ?? effectiveReturn(t) ?? 0), 0);
    const sumMfe = activeStatsTrades.reduce((s, t) => s + (t.mfe_pct ?? t.peak_gain_pct ?? 0), 0);
    const sumMae = activeStatsTrades.reduce((s, t) => s + (t.mae_pct ?? 0), 0);
    const statsCount = activeStatsTrades.length;

    const tradesWithDays = activeStatsTrades.filter(t => (t.holding_days ?? t.days) != null && (t.holding_days ?? t.days ?? 0) > 0);
    const avgDays = tradesWithDays.length > 0
      ? tradesWithDays.reduce((s, t) => s + (t.holding_days ?? t.days ?? 0), 0) / tradesWithDays.length
      : null;

    if (statsCount === 0) {
      return {
        totalSignals: total,
        expiredGapCount: expiredGap,
        pending: pending,
        completedCount: 0,
        wins: 0,
        losses: 0,
        slHits: 0,
        winRate: "â€”",
        avgReturn: "â€”",
        avgMfe: "â€”",
        avgMae: "â€”",
        avgDays: "â€”",
        avgPnl: "â€”",
        isFallback: true
      };
    }

    return {
      totalSignals: total,
      expiredGapCount: expiredGap,
      pending,
      completedCount: statsCount,
      wins,
      losses,
      slHits,
      winRate: formatNumber(wins / statsCount * 100, 1),
      avgReturn: formatNumber(sumRet / statsCount, 1),
      avgMfe: formatNumber(sumMfe / statsCount, 1),
      avgMae: formatNumber(sumMae / statsCount, 1),
      avgDays: avgDays != null ? formatNumber(avgDays, 1) : "â€”",
      avgPnl: formatNumber(sumRet / statsCount * 10, 0),
      isFallback: false
    };
  }, [filtered]);

  // â”€â”€ Days-to-Profit Distribution (Updated Live) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const daysDistribution = useMemo(() => {
    const buckets = [
      { label: "1-5d",  min: 1,  max: 5  },
      { label: "6-10d", min: 6,  max: 10 },
      { label: "11-20d",min: 11, max: 20 },
      { label: "21-30d",min: 21, max: 30 },
    ];

    return buckets.map(b => {
      const trades = filtered.filter(t =>
        !t.is_duplicate &&
        t.result !== "PENDING" &&
        t.result !== "EXPIRED_GAP" &&
        (t.holding_days ?? t.days) != null &&
        (t.holding_days ?? t.days ?? 0) >= b.min && (t.holding_days ?? t.days ?? 0) <= b.max &&
        (t.realized_return_pct ?? effectiveReturn(t) ?? 0) > 0
      );
      const sumRet = trades.reduce((s, t) => s + (t.realized_return_pct ?? effectiveReturn(t) ?? 0), 0);
      const avgRet = trades.length > 0 ? sumRet / trades.length : 0;
      return { ...b, count: trades.length, avgRet: parseFloat((avgRet).toFixed(1)) };
    });
  }, [filtered]);

  // â”€â”€ Profit Target Breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const profitTargets = useMemo(() => {
    const active = filtered.filter(t => !t.is_duplicate && t.result !== "PENDING" && t.result !== "EXPIRED_GAP" && t.exit_reason !== "EXPIRED_GAP");
    const targets = [3, 5, 7, 10, 15, 20];
    return targets.map(pct => {
      const reached = active.filter(t => {
        if (pct === 3) return t.hit_3 ?? ((t.mfe_pct ?? t.return_pct ?? 0) >= 3);
        if (pct === 5) return t.hit_5 ?? ((t.mfe_pct ?? t.return_pct ?? 0) >= 5);
        if (pct === 7) return t.hit_7 ?? ((t.mfe_pct ?? t.return_pct ?? 0) >= 7);
        if (pct === 10) return t.hit_10 ?? ((t.mfe_pct ?? t.return_pct ?? 0) >= 10);
        if (pct === 15) return t.hit_15 ?? ((t.mfe_pct ?? t.return_pct ?? 0) >= 15);
        if (pct === 20) return t.hit_20 ?? ((t.mfe_pct ?? t.return_pct ?? 0) >= 20);
        return false;
      });

      const dayProp = pct === 3 ? "days_to_3" : pct === 5 ? "days_to_5" : pct === 7 ? "days_to_7" : pct === 10 ? "days_to_10" : pct === 15 ? "days_to_15" : "days_to_20";
      const validDays = reached.map(t => (t as any)[dayProp] ?? t.holding_days ?? t.days).filter((d): d is number => d != null && d > 0);
      const avgD = validDays.length > 0 ? validDays.reduce((a, b) => a + b, 0) / validDays.length : null;

      return {
        pct,
        count: reached.length,
        rate: active.length > 0 ? formatNumber(reached.length / active.length * 100, 1) : "0",
        avgDays: avgD != null ? formatNumber(avgD, 1) : "â€”",
      };
    });
  }, [filtered]);

  // â”€â”€ Sector heatmap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const heatmap = useMemo(() => {
    const map: Record<string, { total: number; sumRet: number }> = {};
    filtered.forEach(t => {
      if (t.is_duplicate) return;
      if (!t.sector || t.sector === "Unknown") return;
      if (!map[t.sector]) map[t.sector] = { total: 0, sumRet: 0 };
      map[t.sector].total++;
      map[t.sector].sumRet += effectiveReturn(t) ?? 0;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, total: d.total, avgReturn: d.total > 0 ? (d.sumRet / d.total) : 0 }))
      .sort((a, b) => b.avgReturn - a.avgReturn);
  }, [filtered]);

  function heatColor(avg: number) {
    if (avg >= 15) return "bg-[#22c55e]/25 border-[#22c55e]/60";
    if (avg >= 8)  return "bg-[#22c55e]/15 border-[#22c55e]/40";
    if (avg > 0)   return "bg-[#22c55e]/10 border-[#22c55e]/30";
    if (avg < 0)   return "bg-[#ef4444]/20 border-[#ef4444]/50";
    return "bg-[#141924] border-[#1e2a3a]";
  }

  function resetFilters() {
    setSelectedSector("All");
    setSelectedSubsector("All");
    setSelectedYear("All");
    setSelectedMonth("All");
    setSelectedDate("");
    resetPagination();
  }

  const hasActiveFilter =
    selectedSector !== "All" || selectedSubsector !== "All" ||
    selectedYear !== "All" || selectedMonth !== "All" || selectedDate !== "" || searchTicker !== "";

  const handleSort = (key: keyof Trade) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: keyof Trade }) => {
    if (sortConfig?.key !== column) return <span className="ml-1 opacity-20">â‡…</span>;
    return <span className="ml-1 text-[#3b82f6] font-medium">{sortConfig.direction === 'asc' ? 'â†‘' : 'â†“'}</span>;
  };

  const maxDaysBucket = Math.max(...daysDistribution.map(b => b.avgRet), 1);

  // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleExportCSV = () => {
    const headers = ["Date","Ticker","Company","Sector","Subsector","Entry Price","Peak Price","Peak Gain %","Return % (w/ SL)","SL Hit","Days to Peak","Result","Duplicate (30d)"];
    const csvRows = [headers.join(",")];
    filtered.forEach(t => {
      const row = [
        t.date, t.ticker,
        `"${(t.company || "").replace(/"/g, '""')}"`,
        `"${(t.sector || "").replace(/"/g, '""')}"`,
        `"${(t.subsector || "").replace(/"/g, '""')}"`,
        t.entry, t.max_price || 0,
        t.peak_gain_pct ?? 0,
        effectiveReturn(t) ?? 0,
        slTriggered(t) ? "YES" : "NO",
        t.days || 0,
        effectiveResult(t),
        t.is_duplicate ? "YES" : "NO"
      ];
      csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `finma_swing_trades_SL3.5pct_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    let tableHtml = `<table border="1"><thead><tr style="background-color:#f3f4f6;font-weight:bold;">
      <th>Date</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Subsector</th>
      <th>Entry Price</th><th>Peak Price</th><th>Peak Gain %</th><th>Return %</th><th>SL Hit</th><th>Days to Peak</th><th>Result</th><th>Duplicate (30d)</th>
    </tr></thead><tbody>`;
    filtered.forEach(t => {
      tableHtml += `<tr>
        <td>${t.date}</td><td>${t.ticker}</td><td>${t.company||""}</td>
        <td>${t.sector||""}</td><td>${t.subsector||""}</td>
        <td>${t.entry}</td><td>${t.max_price||0}</td><td>${t.peak_gain_pct??0}</td>
        <td>${effectiveReturn(t)??0}</td><td>${slTriggered(t)?"YES":"NO"}</td>
        <td>${t.days||0}</td><td>${effectiveResult(t)}</td><td>${t.is_duplicate?"YES":"NO"}</td>
      </tr>`;
    });
    tableHtml += "</tbody></table>";
    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `finma_swing_trades_SL3.5pct_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    setPdfExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPos = 15;
      const margin = 10;

      // Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('BOGA AI Trending Stocks Engine Performance Report', margin, yPos);
      yPos += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Stop Loss: Bot-Calculated | Generated: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 8;

      // Summary Stats
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Summary Statistics', margin, yPos);
      yPos += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const summaryLines = [
        `Win Rate (with SL):              ${stats.winRate}%`,
        `Average Return (with SL):        ${stats.avgReturn}%`,
        `Average Days to Peak:            ${stats.avgDays}d`,
        `Total Signals:                   ${stats.totalSignals}`,
        `Completed Trades:                ${stats.completedCount}`,
        `Wins / Losses:                   ${stats.wins} / ${stats.losses}`,
        `Trades Reaching +5%:             ${profitTargets.find(p => p.pct === 5)?.rate ?? 0}%`,
        `Trades Reaching +10%:            ${profitTargets.find(p => p.pct === 10)?.rate ?? 0}%`,
        `Trades Reaching +15%:            ${profitTargets.find(p => p.pct === 15)?.rate ?? 0}%`,
      ];

      summaryLines.forEach(line => {
        pdf.text(line, margin, yPos);
        yPos += 6;
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 15;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
        }
      });

      yPos += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`Trade Log (Showing first 50 of ${filtered.length} trades)`, margin, yPos);
      yPos += 8;

      // Table Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      const colX = [margin, margin + 18, margin + 28, margin + 40, margin + 52, margin + 62];
      pdf.text('Date', colX[0], yPos);
      pdf.text('Ticker', colX[1], yPos);
      pdf.text('Entry', colX[2], yPos);
      pdf.text('Return%', colX[3], yPos);
      pdf.text('Days', colX[4], yPos);
      pdf.text('Result', colX[5], yPos);
      yPos += 6;

      // Table Data
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      filtered.slice(0, 50).forEach(t => {
        if (yPos > pageHeight - 15) {
          pdf.addPage();
          yPos = 15;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text('Date', colX[0], yPos);
          pdf.text('Ticker', colX[1], yPos);
          pdf.text('Entry', colX[2], yPos);
          pdf.text('Return%', colX[3], yPos);
          pdf.text('Days', colX[4], yPos);
          pdf.text('Result', colX[5], yPos);
          yPos += 6;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
        }
        pdf.text(t.date, colX[0], yPos);
        pdf.text(t.ticker, colX[1], yPos);
        pdf.text(fmt(t.entry), colX[2], yPos);
        pdf.text(`${fmt(effectiveReturn(t), 1)}%`, colX[3], yPos);
        pdf.text(t.days ? `${t.days}d` : 'â€”', colX[4], yPos);
        pdf.text(effectiveResult(t), colX[5], yPos);
        yPos += 5;
      });

      pdf.save(`finma_swing_performance_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF export failed. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div ref={dashboardRef} className="space-y-4">
      {showPremiumModal && <PremiumModal locale={locale ?? "tr"} onClose={() => setShowPremiumModal(false)} />}
      {/* â”€â”€ Hero Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mb-6 rounded-2xl overflow-hidden border border-white/5 bg-[#0f172a] shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#22c55e] to-[#3b82f6] opacity-30" />
        {/* Header Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${stats.isFallback ? "bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" : "bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]"}`} />
              <span className={`text-[10px] font-medium uppercase tracking-[0.2em] ${stats.isFallback ? "text-[#f59e0b]" : "text-[#3b82f6]"}`}>
                {stats.isFallback ? (locale === "tr" ? "Sistem Geneli (Filtrede Ä°ÅŸlem Yok)" : locale === "pt" ? "Todo o Sistema (Sem OperaÃ§Ãµes no Filtro)" : "System-wide (No Trades in Filter)") : (locale === "tr" ? "Sistem Ä°statistikleri" : locale === "pt" ? "EstatÃ­sticas do Sistema" : "System Statistics")}
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-medium text-white italic uppercase tracking-tighter leading-none">BOGA AI <span className="text-[#3b82f6] not-italic">TREND STOCKS</span> PERFORMANCE</h2>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {locale === "tr" ? "GeÃ§miÅŸ DÃ¶nem Performans Ã–zeti" : locale === "pt" ? "Resumo de Desempenho HistÃ³rico" : "Historical Performance Summary"} Â· <span className="text-[#f59e0b] font-medium">{locale === "tr" ? "Dinamik Stop-Loss (AI)" : locale === "pt" ? "Stop-Loss DinÃ¢mico (IA)" : "Dynamic Stop-Loss (AI)"}</span>
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {lastUpdated && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg">
                  <svg className="w-3 h-3 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {locale === "tr" ? "Performans:" : locale === "pt" ? "Desempenho:" : "Performance:"} {formatLastUpdated(lastUpdated)}
                </span>
              )}
              {picksGeneratedAt && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg">
                  <svg className="w-3 h-3 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  {locale === "tr" ? "Trend AdaylarÄ±:" : locale === "pt" ? "Picks de TendÃªncia:" : "Trend Picks:"} {formatLastUpdated(picksGeneratedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
              <span className="px-3 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] font-medium">
                {serverStats?.stop_loss_pct || "Dynamic SL"}
              </span>
              <span className="px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] font-medium">
                {stats.completedCount} {locale === "tr" ? "TamamlandÄ±" : locale === "pt" ? "ConcluÃ­do" : "Completed"}
              </span>
              <button
                onClick={() => setShowStats(v => !v)}
                className={`px-3 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${showStats ? "bg-[#3b82f6]/25 border-[#3b82f6]/60 text-[#3b82f6]" : "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                {locale === "tr" ? "Genel Ä°statistikler" : locale === "pt" ? "EstatÃ­sticas Globais" : "Global Statistics"}
                {todayPicks.length > 0 && <span className="text-[10px] opacity-60">({todayPicks.length})</span>}
              </button>
            </div>
            {/* BOT ANALÄ°Z SÄ°STEMÄ° butonu â€” mavi kutu iÃ§inde */}
            {!hideBotLink && (
              <Link
                href="/admin/analytics/performance/kriter"
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/20 hover:border-[#3b82f6]/60 transition-all duration-200"
              >
                <span className="relative flex items-center justify-center w-4 h-4 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/40">
                  <svg className="w-2.5 h-2.5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                </span>
                <span className="text-[10px] font-medium text-[#3b82f6] uppercase tracking-widest">{locale === "tr" ? "BOT ANALÄ°Z SÄ°STEMÄ°" : locale === "pt" ? "SISTEMA DE ANÃLISE DO BOT" : "BOT ANALYSIS SYSTEM"}</span>
                <svg className="w-2.5 h-2.5 text-[#3b82f6]/50 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            )}
          </div>
        </div>

        {showStats && <>
        {/* Big Numbers Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-white/5 border-b border-white/5 bg-white/[0.01]">
          <div className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1.5 font-medium">{locale === "tr" ? "KÃ‚RLI Ä°ÅžLEM ORANI" : locale === "pt" ? "TAXA DE ACERTO" : "WIN RATE"}</p>
            <p className="text-xl sm:text-2xl font-mono font-medium text-[#22c55e] tracking-tight">
              {stats.winRate === "â€”" ? "â€”" : `${stats.winRate}%`}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase">{stats.wins} {locale === "tr" ? "KÃ‚R" : "WIN"} / {stats.losses} {locale === "tr" ? "ZARAR" : "LOSS"}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1.5 font-medium">{locale === "tr" ? "ORT. GERÃ‡EKLEÅžEN GETÄ°RÄ°" : locale === "pt" ? "RETORNO MÃ‰DIO REALIZADO" : "AVG REALIZED RETURN"}</p>
            <p className={`text-xl sm:text-2xl font-mono font-medium tracking-tight ${stats.avgReturn === "â€”" ? "text-white" : parseFloat(stats.avgReturn) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {stats.avgReturn === "â€”" ? "â€”" : `${parseFloat(stats.avgReturn) >= 0 ? "+" : ""}${stats.avgReturn}%`}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase">{locale === "tr" ? "%0.1 Ä°ÅŸlem Maliyeti DÃ¼ÅŸÃ¼lmÃ¼ÅŸ" : "Net of 0.1% Cost"}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1.5 font-medium">{locale === "tr" ? "ORTALAMA MAKS. GETÄ°RÄ° (MFE)" : locale === "pt" ? "RETORNO MÃXIMO MÃ‰DIO (MFE)" : "AVG MAX RETURN (MFE)"}</p>
            <p className="text-xl sm:text-2xl font-mono font-medium text-[#3b82f6] tracking-tight">
              {stats.avgMfe === "â€”" ? "â€”" : `+${stats.avgMfe}%`}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase italic">{locale === "tr" ? "Potansiyel Tepe FiyatÄ±" : "Peak Opportunity"}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1.5 font-medium">{locale === "tr" ? "ORT. RÄ°SK & SÃœRE" : locale === "pt" ? "RISCO & DURAÃ‡ÃƒO MÃ‰DIA" : "AVG RISK & DURATION"}</p>
            <p className="text-xl sm:text-2xl font-mono font-medium text-white tracking-tight">
              {stats.avgMae}% <span className="text-xs font-normal text-slate-400">/ {stats.avgDays}g</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase">{locale === "tr" ? "Ort. Ã‡ekilme (MAE) / Ort. Takip" : "Avg MAE / Avg Holding"}</p>
          </div>
        </div>

        {/* Methodology disclaimer â€” keeps win-rate/avg-return stats from being read as guaranteed/realized results */}
        <div className="px-6 py-3 border-b border-white/5 bg-[#f59e0b]/[0.04]">
          <p className="text-[10px] text-slate-500 leading-relaxed">{METHODOLOGY_NOTE[locale]}</p>
        </div>

        {/* Profit Target Breakdown */}
        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01]">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-3 font-medium">{locale === "tr" ? "HEDEF BAZLI ANALÄ°Z â€” OlasÄ±lÄ±k ve Ortalama SÃ¼re" : locale === "pt" ? "ANÃLISE POR ALVO â€” Probabilidade e DuraÃ§Ã£o MÃ©dia" : "TARGET-BASED ANALYSIS â€” Probability and Avg Duration"}</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {profitTargets.map(pt => (
              <div key={pt.pct} className="rounded-2xl bg-black/40 border border-white/5 p-4 text-center hover:border-[#22c55e]/20 transition-all group">
                <p className="text-[9px] text-[#3b82f6] font-medium uppercase tracking-widest mb-2">+{pt.pct}% {locale === "tr" ? "HEDEF" : locale === "pt" ? "ALVO" : "TARGET"}</p>
                <p className="text-2xl font-medium font-mono text-white tracking-tighter group-hover:text-[#22c55e] transition-colors">{pt.avgDays === "â€”" ? "â€”" : `${pt.avgDays} ${locale === "tr" ? "G" : "D"}`}</p>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                   <span className="text-[10px] text-white font-medium">{pt.rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Days-to-Profit Distribution Bar Chart */}
        <div className="px-6 py-5 border-t border-[#1e2a3a]">
          <p className="text-sm text-[#00d2ff] uppercase tracking-wider mb-4 font-medium">{locale === "tr" ? "GÃ¼n DaÄŸÄ±lÄ±mÄ± â€” KazandÄ±ran Ä°ÅŸlemler (Ort. Getiri)" : locale === "pt" ? "DistribuiÃ§Ã£o de Dias â€” OperaÃ§Ãµes Vencedoras (Retorno MÃ©dio)" : "Days Distribution â€” Winning Trades (Avg Return)"}</p>
          <div className="flex items-end gap-3 h-28">
            {daysDistribution.map(b => {
              const barHeight = maxDaysBucket > 0 ? Math.max(4, (b.avgRet / maxDaysBucket) * 96) : 4;
              return (
                <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                  <p className="text-sm md:text-base font-mono text-[#22c55e] font-medium">{b.avgRet > 0 ? `+${b.avgRet}%` : "â€”"}</p>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#22c55e]/60 to-[#22c55e]/20 border border-[#22c55e]/30 transition-all"
                    style={{ height: `${barHeight}%` }}
                  />
                  <p className="text-sm font-medium text-[#00d2ff] text-center">{b.label}</p>
                  <p className="text-xs md:text-sm font-medium text-white">{b.count}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-[#00d2ff] mt-2">{locale === "tr" ? "Her Ã§ubuk, o elde tutma sÃ¼resi iÃ§inde zirve yapan kazanÃ§lÄ± iÅŸlemler iÃ§in ortalama getiriyi ve iÅŸlem sayÄ±sÄ±nÄ± gÃ¶sterir." : locale === "pt" ? "Cada barra mostra o retorno mÃ©dio e o nÃºmero de operaÃ§Ãµes vencedoras que atingiram o pico dentro desse perÃ­odo de retenÃ§Ã£o." : "Each bar shows the avg return and trade count for winning trades that peaked within that holding period."}</p>
        </div>

        {/* Quick Percentile Row */}
        <div className="grid grid-cols-3 gap-0 divide-x divide-[#1e2a3a] border-t border-[#1e2a3a]">
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] md:text-sm text-[#00d2ff] uppercase tracking-wider mb-1 font-medium">{locale === "tr" ? "+5% UlaÅŸtÄ±" : locale === "pt" ? "Atingiu +5%" : "Reached +5%"}</p>
            <p className="text-xl md:text-2xl font-medium font-mono text-[#22c55e]">{profitTargets.find(p => p.pct === 5)?.rate ?? 0}%</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] md:text-sm text-[#00d2ff] uppercase tracking-wider mb-1 font-medium">{locale === "tr" ? "+10% UlaÅŸtÄ±" : locale === "pt" ? "Atingiu +10%" : "Reached +10%"}</p>
            <p className="text-xl md:text-2xl font-medium font-mono text-[#3b82f6]">{profitTargets.find(p => p.pct === 10)?.rate ?? 0}%</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] md:text-sm text-[#00d2ff] uppercase tracking-wider mb-1 font-medium">{locale === "tr" ? "+15% UlaÅŸtÄ±" : locale === "pt" ? "Atingiu +15%" : "Reached +15%"}</p>
            <p className="text-xl md:text-2xl font-medium font-mono text-[#a78bfa]">{profitTargets.find(p => p.pct === 15)?.rate ?? 0}%</p>
          </div>
        </div>
        {/* Gizle butonu */}
        <div className="flex justify-end px-6 py-3 border-t border-white/5">
          <button
            onClick={() => setShowStats(false)}
            className="px-4 py-1.5 rounded-xl text-[11px] font-medium bg-[#1e2a3a] text-slate-400 border border-white/5 hover:border-[#ef4444]/40 hover:text-[#ef4444] transition-all uppercase tracking-widest flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            {locale === "tr" ? "Gizle" : locale === "pt" ? "Ocultar" : "Hide"}
          </button>
        </div>
        </>}
      </div>

      {/* â”€â”€ BugÃ¼nkÃ¼ Swing AdaylarÄ± Paneli â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showStats && todayPicks.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-[#3b82f6]/20 bg-[#0a1628] shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#3b82f6] via-[#6366f1] to-[#3b82f6]" />
          {/* Panel Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a3a]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6] animate-pulse" />
              <div>
                <p className="text-[11px] font-medium text-[#3b82f6] uppercase tracking-[0.25em]">{locale === "tr" ? "GÃ¼ncel Veriler" : locale === "pt" ? "Dados ao Vivo" : "Live Data"}</p>
                <h3 className="text-base font-medium text-white uppercase tracking-tight">
                  {locale === "tr" ? "BugÃ¼nkÃ¼ Trend AdaylarÄ±" : locale === "pt" ? "Picks de TendÃªncia de Hoje" : "Today's Trend Picks"}
                  <span className="ml-2 text-[#3b82f6]">({todayPicks.length} {locale === "tr" ? "hisse" : locale === "pt" ? "aÃ§Ãµes" : "stocks"})</span>
                </h3>
              </div>
              {picksGeneratedAt && (
                <span className="hidden md:flex items-center gap-1.5 text-[10px] font-medium text-slate-500 ml-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {formatLastUpdated(picksGeneratedAt)}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowStats(false)}
              className="px-4 py-1.5 rounded-xl text-[11px] font-medium bg-[#1e2a3a] text-slate-400 border border-white/5 hover:border-[#ef4444]/40 hover:text-[#ef4444] transition-all uppercase tracking-widest flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              Gizle
            </button>
          </div>
          {/* Picks Grid */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {todayPicks.map((pick, i) => {
              const scoreColor = pick.score >= 80 ? "text-[#f59e0b]" : pick.score >= 70 ? "text-[#3b82f6]" : "text-[#22c55e]";
              const scoreBorder = pick.score >= 80 ? "border-[#f59e0b]/30" : pick.score >= 70 ? "border-[#3b82f6]/30" : "border-[#22c55e]/30";
              const scoreBg = pick.score >= 80 ? "bg-[#f59e0b]/10" : pick.score >= 70 ? "bg-[#3b82f6]/10" : "bg-[#22c55e]/10";
              const cardClassName = "rounded-xl bg-[#0d1521] border border-white/5 p-4 hover:border-[#3b82f6]/30 hover:bg-[#0f1e30] transition-all group";

              // Non-premium: sunucu (page.tsx) buy_zone/profit_zone/stop_zone'u
              // zaten null gÃ¶ndermiÅŸtir (bkz. lib/pickMasking.ts, Faz 0B) â€”
              // burada isPremium'a deÄŸil, o sinyale bakÄ±lÄ±r.
              if (!pick.buy_zone) {
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setShowPremiumModal(true)}
                    className={cardClassName + " w-full text-left"}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        {/* Kilitli ticker */}
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-base font-medium tracking-tight" style={{ color: "#f59e0b" }}>Premium</span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-medium mt-0.5">Premium</p>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-[11px] font-medium ${scoreBg} border ${scoreBorder} ${scoreColor}`}>
                        {pick.score != null ? formatNumber(pick.score, 0) : "â€”"}
                      </div>
                    </div>
                    {/* GiriÅŸ/Hedef/Stop artÄ±k burada gÃ¶sterilmiyor â€” sunucu
                        (Faz 0B, lib/pickMasking.ts) bu alanlarÄ± non-premium
                        iÃ§in zaten null gÃ¶nderiyor; RSI/ADX/sektÃ¶r gibi
                        iÅŸlem-planÄ±-olmayan teknik veriler aÃ§Ä±k kalÄ±yor. */}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {pick.rsi != null && (
                        <span className="text-[9px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                          RSI {formatNumber(pick.rsi, 0)}
                        </span>
                      )}
                      {pick.adx != null && (
                        <span className="text-[9px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                          ADX {formatNumber(pick.adx, 0)}
                        </span>
                      )}
                      {pick.sector && (
                        <span className="text-[9px] font-medium text-[#00d2ff] bg-[#00d2ff]/5 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                          {pick.sector}
                        </span>
                      )}
                    </div>
                  </button>
                );
              }

              const cardInner = (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <TickerHoverChart ticker={pick.ticker}><p className="text-base font-medium text-[#3b82f6] group-hover:text-white transition-colors tracking-tight">{pick.ticker}</p></TickerHoverChart>
                      {pick.company && (
                        <p className="text-[10px] text-slate-500 font-medium truncate max-w-[130px]">{pick.company}</p>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[11px] font-medium ${scoreBg} border ${scoreBorder} ${scoreColor}`}>
                      {pick.score != null ? formatNumber(pick.score, 0) : "â€”"}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {pick.buy_zone && (
                      <div className="bg-black/30 rounded-lg py-1.5 px-1">
                        <p className="text-[8px] text-[#22c55e] font-medium uppercase mb-0.5">{locale === "tr" ? "GiriÅŸ" : locale === "pt" ? "Entrada" : "Entry"}</p>
                        <p className="text-[10px] font-mono font-medium text-white">
                          ${formatNumber(pick.buy_zone.low, 0)}â€“{formatNumber(pick.buy_zone.high, 0)}
                        </p>
                      </div>
                    )}
                    {pick.profit_zone && (
                      <div className="bg-black/30 rounded-lg py-1.5 px-1">
                        <p className="text-[8px] text-[#3b82f6] font-medium uppercase mb-0.5">{locale === "tr" ? "Hedef" : locale === "pt" ? "Alvo" : "Target"}</p>
                        <p className="text-[10px] font-mono font-medium text-white">
                          ${formatNumber(pick.profit_zone.low, 0)}â€“{formatNumber(pick.profit_zone.high, 0)}
                        </p>
                      </div>
                    )}
                    {pick.stop_zone && (
                      <div className="bg-black/30 rounded-lg py-1.5 px-1">
                        <p className="text-[8px] text-[#ef4444] font-medium uppercase mb-0.5">Stop</p>
                        <p className="text-[10px] font-mono font-medium text-white">
                          ${formatNumber(pick.stop_zone.low, 0)}â€“{formatNumber(pick.stop_zone.high, 0)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {pick.rsi != null && (
                      <span className="text-[9px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                        RSI {pick.rsi != null ? formatNumber(pick.rsi, 0) : "â€”"}
                      </span>
                    )}
                    {pick.adx != null && (
                      <span className="text-[9px] font-medium text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                        ADX {pick.adx != null ? formatNumber(pick.adx, 0) : "â€”"}
                      </span>
                    )}
                    {pick.sector && (
                      <span className="text-[9px] font-medium text-[#00d2ff] bg-[#00d2ff]/5 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                        {pick.sector}
                      </span>
                    )}
                  </div>
                </>
              );
              return disableTickerLink ? (
                <div key={i} className={cardClassName}>{cardInner}</div>
              ) : (
                <Link key={i} href={`/stock/${pick.ticker}`} className={cardClassName}>{cardInner}</Link>
              );
            })}
          </div>
          <div className="px-6 py-3 border-t border-[#1e2a3a] flex items-center justify-between">
            <p className="text-[10px] text-slate-500 font-medium">
              {locale === "tr" ? "Her gÃ¼n piyasa kapanÄ±ÅŸÄ±ndan sonra otomatik gÃ¼ncellenir. Veriler gerÃ§ek zamanlÄ± fiyatlarÄ± yansÄ±tÄ±r. 15 dakika gecikme ile saat baÅŸlarÄ± gÃ¼ncellenir." : locale === "pt" ? "Atualizado automaticamente apÃ³s o fechamento do mercado todos os dias. Os dados refletem preÃ§os em tempo real. Atraso de 15 minutos, atualizado a cada hora." : "Updated automatically after market close every day. Data reflects real-time prices. Delayed by 15 mins and updated every hour."}
            </p>
            <button
              onClick={() => setShowStats(false)}
              className="px-4 py-1.5 rounded-xl text-[11px] font-medium bg-[#1e2a3a] text-slate-400 border border-white/5 hover:border-[#ef4444]/40 hover:text-[#ef4444] transition-all uppercase tracking-widest flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              {locale === "tr" ? "Gizle" : locale === "pt" ? "Ocultar" : "Hide"}
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <select value={selectedSector} onChange={e => { setSelectedSector(e.target.value); setSelectedSubsector("All"); }}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">{locale === "tr" ? "TÃ¼m SektÃ¶rler" : locale === "pt" ? "Todos os Setores" : "All Sectors"}</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={selectedSubsector} onChange={e => setSelectedSubsector(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">{locale === "tr" ? "TÃ¼m Alt SektÃ¶rler" : locale === "pt" ? "Todos os Subsetores" : "All Subsectors"}</option>
          {subsectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth("All"); }}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">{locale === "tr" ? "TÃ¼m YÄ±llar" : locale === "pt" ? "Todos os Anos" : "All Years"}</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">{locale === "tr" ? "TÃ¼m Aylar" : locale === "pt" ? "Todos os Meses" : "All Months"}</option>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
          title="Filter by exact date" />

        <div className="relative">
          <input type="text" placeholder={locale === "tr" ? "Hisse Ara..." : locale === "pt" ? "Buscar Ativo..." : "Search Ticker..."} value={searchTicker}
            onChange={e => setSearchTicker(e.target.value)}
            className="bg-[#1a2030] border border-[#1e2a3a] text-white pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6] w-full md:w-40" />
          <svg className="w-4 h-4 text-[#00d2ff] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>

        {hasActiveFilter && (
          <button onClick={resetFilters}
            className="px-4 py-2.5 rounded-xl text-sm border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">
            {locale === "tr" ? "SÄ±fÄ±rla" : locale === "pt" ? "Redefinir" : "Reset"}
          </button>
        )}
      </div>

      {/* â”€â”€ Sector Heatmap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {heatmap.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-white mb-3 uppercase tracking-widest">{locale === "tr" ? "SektÃ¶r KarlÄ±lÄ±k IsÄ± HaritasÄ±" : locale === "pt" ? "Mapa de Calor de Rentabilidade por Setor" : "Sector Profitability Heatmap"}</h3>
          {/* Mobile: auto-scrolling ticker */}
          <div className="md:hidden overflow-hidden relative">
            <div className="flex gap-2 animate-[ticker_30s_linear_infinite] w-max">
              {[...heatmap, ...heatmap].map((s, i) => (
                <button key={i}
                  onClick={() => setSelectedSector(s.name === selectedSector ? "All" : s.name)}
                  className={`rounded-lg border px-3 py-2 ${heatColor(s.avgReturn)} flex items-center gap-2 transition-colors shrink-0 ${s.name === selectedSector ? "ring-1 ring-white" : ""}`}>
                  <span className="text-[9px] font-medium text-white uppercase tracking-wider whitespace-nowrap">{s.name}</span>
                  <span className={`text-sm font-medium font-mono ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {s.avgReturn >= 0 ? "+" : ""}{formatNumber(s.avgReturn, 1)}%
                  </span>
                  <span className="text-[9px] text-[#00d2ff] font-medium">{s.total}p</span>
                </button>
              ))}
            </div>
          </div>
          {/* Desktop: single row, compact cards */}
          <div className="hidden md:flex gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-1">
            {heatmap.map(s => (
              <button key={s.name}
                onClick={() => setSelectedSector(s.name === selectedSector ? "All" : s.name)}
                className={`rounded-lg border px-2.5 py-2 ${heatColor(s.avgReturn)} flex flex-col gap-1 transition-colors duration-200 shrink-0 text-left min-w-[90px] ${s.name === selectedSector ? "ring-2 ring-white" : "hover:bg-[#1a2030]"}`}>
                <p className="text-[9px] font-medium text-white uppercase tracking-wider truncate w-full" title={s.name}>{s.name}</p>
                <p className={`text-sm font-medium font-mono leading-none ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {s.avgReturn >= 0 ? "+" : ""}{formatNumber(s.avgReturn, 1)}%
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-[8px] text-[#00d2ff] font-medium uppercase">AVG</p>
                  <p className="text-[9px] font-medium text-white">{s.total}<span className="text-[8px] text-[#00d2ff] ml-0.5">p</span></p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ Trade History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h3 className="text-xl font-medium text-white">{locale === "tr" ? "GeÃ§miÅŸ Ä°ÅŸlem KayÄ±tlarÄ±" : locale === "pt" ? "Registro HistÃ³rico de OperaÃ§Ãµes" : "Historical Trade Log"}</h3>
            <div className="flex items-center gap-2">
              <p className="text-xs text-white">{locale === "tr" ? `Toplam ${filtered.length} iÅŸlemin ${Math.min(visibleCount, filtered.length)} tanesi gÃ¶steriliyor` : `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length} trades`}</p>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] font-medium">{locale === "tr" ? "Bot-HesaplÄ± Stop-Loss UygulandÄ±" : locale === "pt" ? "Stop-Loss Calculado pelo Bot Aplicado" : "Bot-Calc Stop-Loss Applied"}</span>
            </div>
          </div>
          {!hideExportButtons && (
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const text = filtered.map(t => `${t.date}\t${t.ticker}\t${fmt(t.entry)}\t${fmt(effectiveReturn(t), 1)}%\t${t.days||0}d\t${effectiveResult(t)}`).join("\n");
              navigator.clipboard.writeText(`Date\tTicker\tEntry\tReturn%\tDays\tResult\n${text}`);
              alert(locale === "tr" ? "Liste baÅŸarÄ±yla kopyalandÄ±!" : locale === "pt" ? "Lista copiada com sucesso para a Ã¡rea de transferÃªncia!" : "List successfully copied to clipboard!");
            }}
              className="px-4 py-2 rounded-xl text-[10px] font-medium bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6] hover:text-white transition-all flex items-center gap-2 uppercase tracking-widest">
              {locale === "tr" ? "LÄ°STEYÄ° KOPYALA" : locale === "pt" ? "COPIAR LISTA" : "COPY LIST"}
            </button>
            <button onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl text-[10px] font-medium bg-[#1e293b] text-white border border-white/5 hover:border-[#3b82f6] transition-all flex items-center gap-2 uppercase tracking-widest">
              CSV
            </button>
            <button onClick={handleExportExcel}
              className="px-4 py-2 rounded-xl text-[10px] font-medium bg-[#1e293b] text-white border border-white/5 hover:border-[#22c55e] transition-all flex items-center gap-2 uppercase tracking-widest">
              EXCEL
            </button>
            <button onClick={handleExportPDF} disabled={pdfExporting}
              className="px-4 py-2 rounded-xl text-[10px] font-medium bg-[#1e293b] text-white border border-white/5 hover:border-[#ef4444] transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest">
              {pdfExporting ? "PDF..." : "PDF"}
            </button>
          </div>
          )}
        </div>

        {/* â”€â”€ Mobile Terminal List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="md:hidden rounded-xl overflow-hidden border border-[#1e2a3a] bg-[#0d1117]">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0d1521] border-b border-[#1e2a3a]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/60" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 ml-1">swing_performance.log â€” {filtered.length} {locale === "tr" ? "kayÄ±t" : locale === "pt" ? "registros" : "records"}</span>
          </div>
          {/* Column labels */}
          <div className="grid grid-cols-[1fr_52px_52px_52px_48px] gap-0 px-3 py-1.5 border-b border-[#1e2a3a] bg-[#0a0f1a]">
            <span className="text-[9px] font-medium text-slate-600 uppercase tracking-wider">{locale === "tr" ? "TÄ°CKER / SEKTÃ–R" : locale === "pt" ? "TICKER / SETOR" : "TICKER / SECTOR"}</span>
            <span className="text-[9px] font-medium text-slate-600 uppercase tracking-wider text-right">{locale === "tr" ? "GÄ°RÄ°Åž" : locale === "pt" ? "ENTRADA" : "ENTRY"}</span>
            <span className="text-[9px] font-medium text-slate-600 uppercase tracking-wider text-right">PEAK</span>
            <span className="text-[9px] font-medium text-[#22c55e]/60 uppercase tracking-wider text-right">RET%</span>
            <span className="text-[9px] font-medium text-slate-600 uppercase tracking-wider text-right">{locale === "tr" ? "SONUÃ‡" : locale === "pt" ? "RESULTADO" : "RESULT"}</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-[#1e2a3a]/60">
            {visibleTrades.map((t, i) => {
              const effRet = effectiveReturn(t);
              const effRes = effectiveResult(t);
              const slHit = slTriggered(t);
              const pnl = pnlFromReturn(effRet);
              const resultDot =
                effRes === "WIN"     ? "bg-[#22c55e]" :
                effRes === "LOSS"    ? "bg-[#ef4444]" :
                effRes === "PENDING" ? "bg-[#3b82f6] animate-pulse" : "bg-slate-600";
              const resultTxt =
                effRes === "WIN"     ? "text-[#22c55e]" :
                effRes === "LOSS"    ? "text-[#ef4444]" :
                effRes === "PENDING" ? "text-[#3b82f6]" : "text-slate-400";
              return (
                <div key={i}
                  className={`grid grid-cols-[1fr_52px_52px_52px_48px] gap-0 px-3 py-2 items-center
                    ${slHit ? "bg-[#ef4444]/5" : i % 2 === 0 ? "bg-transparent" : "bg-white/[0.012]"}
                    active:bg-[#1a2030] transition-colors`}
                >
                  {/* Col 1: Ticker + meta */}
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500">{String(i + 1).padStart(3, "0")}</span>
                      {!t.ticker ? (
                        <span className="text-[13px] font-medium leading-none flex items-center gap-1" style={{ color: "#f59e0b" }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                          Premium
                        </span>
                      ) : (
                        <TickerHoverChart ticker={t.ticker}>
                          {disableTickerLink ? (
                            <span className="text-[13px] font-medium text-[#3b82f6] tracking-tight leading-none">{t.ticker}</span>
                          ) : (
                            <Link href={`/stock/${t.ticker}`} className="text-[13px] font-medium text-[#3b82f6] tracking-tight leading-none hover:underline">
                              {t.ticker}
                            </Link>
                          )}
                        </TickerHoverChart>
                      )}
                      {slHit && <span className="text-[8px] font-medium text-[#ef4444] bg-[#ef4444]/10 px-1 py-0.5 rounded leading-none">SL</span>}
                      {t.is_duplicate && <span className="text-[8px] font-medium text-slate-500 bg-white/5 px-1 py-0.5 rounded leading-none">DUP</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-mono text-slate-600">{t.date.slice(5)}</span>
                      {t.sector && t.sector !== "Unknown" && (
                        <span className="text-[9px] text-[#00d2ff]/60 font-medium truncate max-w-[110px]">{t.sector}</span>
                      )}
                      {t.subsector && (
                        <span className="text-[8px] text-slate-600 truncate max-w-[100px] hidden xs:block">{t.subsector}</span>
                      )}
                    </div>
                    {t.days != null && t.result !== "PENDING" && (
                      <span className="text-[8px] font-mono text-slate-600">{t.days}d{t.peak_date ? ` Â· ${t.peak_date.slice(5)}` : ""}</span>
                    )}
                  </div>

                  {/* Col 2: Entry */}
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-400">${fmt(t.entry, 0)}</span>
                  </div>

                  {/* Col 3: Peak */}
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-300">
                      {t.max_price != null ? `$${fmt(t.max_price, 0)}` : "â€”"}
                    </span>
                  </div>

                  {/* Col 4: Return % + PnL */}
                  <div className="text-right">
                    <span className={`text-[12px] font-medium font-mono leading-none ${retColor(effRet)}`}>
                      {effRet != null
                        ? (effRet > 0 ? `+${fmt(effRet, 1)}` : fmt(effRet, 1))
                        : "â€”"}
                    </span>
                    {pnl != null && (
                      <p className={`text-[8px] font-mono leading-none mt-0.5 ${retColor(pnl)}`}>
                        {pnl > 0 ? `+$${formatNumber(Math.abs(pnl), 0)}` : pnl < 0 ? `-$${formatNumber(Math.abs(pnl), 0)}` : "$0"}
                      </p>
                    )}
                  </div>

                  {/* Col 5: Result */}
                  <div className="flex items-center justify-end gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${resultDot}`} />
                    <span className={`text-[9px] font-medium uppercase ${resultTxt}`}>
                      {effRes === "PENDING" ? "PND" : effRes}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* â”€â”€ Desktop Table View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* â”€â”€ Desktop Table View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="hidden md:block glass-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2a3a] scrollbar-track-transparent" style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
            <table className="w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#0d1521" }}>
                <tr className="border-b-2 border-[#1e2a3a] text-[#58a6ff] text-[10px]">
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('date')}>{locale === "tr" ? "TARÄ°H" : locale === "pt" ? "DATA" : "DATE"} <SortIcon column="date" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('ticker')}>{locale === "tr" ? "SEMBOL" : locale === "pt" ? "SÃMBOLO" : "SYMBOL"} <SortIcon column="ticker" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right text-[#3fb950] cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('return_pct')}>{locale === "tr" ? "GETÄ°RÄ°" : locale === "pt" ? "RETORNO" : "RETURN"} <SortIcon column="return_pct" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('entry')}>{locale === "tr" ? "GÄ°RÄ°Åž" : locale === "pt" ? "ENTRADA" : "ENTRY"} <SortIcon column="entry" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right text-[#a855f7] cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('ema50_1d')}>EMA50 <SortIcon column="ema50_1d" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('max_price')}>{locale === "tr" ? "TEPE" : locale === "pt" ? "PICO" : "PEAK"} <SortIcon column="max_price" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right text-[#f59e0b] cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('peak_gain_pct')}>{locale === "tr" ? "TEPE %" : locale === "pt" ? "PICO %" : "PEAK %"} <SortIcon column="peak_gain_pct" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right text-[#00d2ff] cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('return_pct')}>{locale === "tr" ? "FÄ°YAT" : locale === "pt" ? "PREÃ‡O" : "PRICE"} <SortIcon column="return_pct" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-center cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('days')}>{locale === "tr" ? "GÃœN" : locale === "pt" ? "DIAS" : "DAYS"} <SortIcon column="days" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-right text-[#3b82f6] cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('return_pct')}>PNL <SortIcon column="return_pct" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('sector')}>{locale === "tr" ? "SEKTÃ–R" : locale === "pt" ? "SETOR" : "SECTOR"} <SortIcon column="sector" /></th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wider text-center cursor-pointer hover:bg-[#1e2a3a] whitespace-nowrap" onClick={() => handleSort('result')}>{locale === "tr" ? "SONUÃ‡" : locale === "pt" ? "RESULTADO" : "RESULT"} <SortIcon column="result" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]/60">
                {visibleTrades.map((t, i) => {
                  const effRet = effectiveReturn(t);
                  const effRes = effectiveResult(t);
                  const resultCls = RESULT_COLORS[effRes] ?? "text-white";
                  const pnl = pnlFromReturn(effRet);
                  const slHit = slTriggered(t);

                  const getValColor = (val: number | null | undefined) => {
                    if (val == null || val === 0) return "#8b949e";
                    return val > 0 ? "#3fb950" : "#f85149";
                  };

                  return (
                    <tr key={i} className={`hover:bg-[#1a2030]/60 transition-colors ${slHit ? "bg-[#ef4444]/5" : i % 2 !== 0 ? "bg-white/[0.018]" : ""}`}>
                      <td className="px-2 py-1.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">{t.date}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {!t.ticker ? (
                          <span className="font-semibold text-[11px] tracking-tight flex items-center gap-1" style={{ color: "#f59e0b" }}>
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                            Premium
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <TickerHoverChart ticker={t.ticker}>
                              {disableTickerLink ? (
                                <span className="font-semibold text-[11px] text-[#3b82f6] tracking-tight">{t.ticker}</span>
                              ) : (
                                <Link href={`/stock/${t.ticker}`} className="font-semibold text-[11px] text-[#3b82f6] hover:text-white hover:underline tracking-tight">{t.ticker}</Link>
                              )}
                            </TickerHoverChart>
                            {t.is_duplicate && (
                              <span title="30 gÃ¼n iÃ§inde tekrar" className="text-[8px] font-semibold text-slate-500 bg-white/5 px-1 py-0.5 rounded">DUP</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] whitespace-nowrap" style={{ color: getValColor(effRet), fontWeight: 700 }}>
                        {effRet != null ? (effRet > 0 ? `+${fmt(effRet, 2)}%` : effRet < 0 ? `${fmt(effRet, 2)}%` : "0.00%") : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">${fmt(t.entry)}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-[#a855f7] font-semibold whitespace-nowrap">
                        {t.ema50_1d != null ? `$${fmt(t.ema50_1d)}` : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-slate-200 whitespace-nowrap" title={t.peak_date || ""}>
                        {t.max_price != null ? `$${fmt(t.max_price)}` : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] whitespace-nowrap" style={{ color: getValColor(t.peak_gain_pct), fontWeight: 700 }}>
                        {t.peak_gain_pct != null ? `${t.peak_gain_pct > 0 ? "+" : ""}${fmt(t.peak_gain_pct, 2)}%` : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-[#00d2ff] font-semibold whitespace-nowrap">
                        {effRet != null ? `$${fmt(t.entry * (1 + effRet / 100))}` : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-center text-[11px] text-slate-300 whitespace-nowrap">
                        {t.result === "PENDING"
                          ? <span className="text-[#3b82f6] font-semibold text-[9px] px-1.5 py-0.5 bg-[#3b82f6]/10 rounded">PND</span>
                          : t.days != null ? <span className="font-mono">{t.days}d</span> : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] whitespace-nowrap" style={{ color: getValColor(pnl), fontWeight: 700 }}>
                        {pnl != null ? (pnl > 0 ? `+$${formatNumber(Math.abs(pnl), 0)}` : pnl < 0 ? `-$${formatNumber(Math.abs(pnl), 0)}` : "$0") : "â€”"}
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-slate-300 uppercase font-semibold whitespace-nowrap">
                        <span className="truncate block max-w-[110px]" title={t.sector}>{t.sector || "â€”"}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${resultCls}`}>{effRes}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-[#00d2ff]">{locale === "tr" ? "SeÃ§ili filtreler iÃ§in iÅŸlem bulunamadÄ±." : locale === "pt" ? "Nenhuma operaÃ§Ã£o encontrada para os filtros selecionados." : "No trades found for selected filters."}</div>
          )}
        </div>

        {visibleCount < filtered.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-8 py-3 rounded-xl bg-[#1e2a3a] border border-[#2d3a4b] text-sm font-medium text-white hover:border-[#3b82f6] hover:text-white transition-all">
              {locale === "tr" ? `${Math.min(PAGE_SIZE, filtered.length - visibleCount)} daha yÃ¼kle` : `Load ${Math.min(PAGE_SIZE, filtered.length - visibleCount)} more`}
              <span className="ml-2 text-[#00d2ff]">({locale === "tr" ? `${filtered.length - visibleCount} kaldÄ±` : `${filtered.length - visibleCount} remaining`})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

