"use client";

import { useState, useMemo } from "react";
import { InsiderTransaction } from "@/lib/insider-data";
import { Locale } from "@/lib/i18n/copy";
import { copy } from "@/lib/i18n/copy";

interface InsiderTransactionGridProps {
  data: InsiderTransaction[];
  locale: Locale;
  onTickerClick?: (ticker: string) => void;
}

type TransactionTypeFilter = "all" | "BUY" | "SELL" | "GRANT" | "EXERCISE";
type SortKey = "date" | "shares" | "type" | "name";
type SortOrder = "asc" | "desc";

export default function InsiderTransactionGrid({
  data,
  locale,
  onTickerClick,
}: InsiderTransactionGridProps) {
  const [filterType, setFilterType] = useState<TransactionTypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const t = copy[locale];
  const insiderT = t.insider || {};
  const columnT = insiderT.column || {};
  const typeT = insiderT.transactionType || {};

  // Filter and sort
  const filtered = useMemo(() => {
    let result = data.filter((tx) => {
      const matchesType = filterType === "all" || tx.transactionType === filterType;
      const matchesSearch =
        !searchTerm ||
        tx.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.executiveName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });

    // Sort
    result.sort((a, b) => {
      let aVal: any = a.transactionDate;
      let bVal: any = b.transactionDate;

      switch (sortKey) {
        case "shares":
          aVal = a.sharesTransacted;
          bVal = b.sharesTransacted;
          break;
        case "type":
          aVal = a.transactionType;
          bVal = b.transactionType;
          break;
        case "name":
          aVal = a.executiveName.toLowerCase();
          bVal = b.executiveName.toLowerCase();
          break;
        default:
          aVal = a.transactionDate;
          bVal = b.transactionDate;
      }

      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === "desc" ? -cmp : cmp;
    });

    return result;
  }, [data, filterType, sortKey, sortOrder, searchTerm]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    const baseClasses = "px-2 py-1 rounded text-xs font-medium whitespace-nowrap";
    switch (type) {
      case "BUY":
        return `${baseClasses} bg-green-900/30 text-green-300 border border-green-700`;
      case "SELL":
        return `${baseClasses} bg-red-900/30 text-red-300 border border-red-700`;
      case "GRANT":
        return `${baseClasses} bg-blue-900/30 text-blue-300 border border-blue-700`;
      case "EXERCISE":
        return `${baseClasses} bg-purple-900/30 text-purple-300 border border-purple-700`;
      default:
        return `${baseClasses} bg-slate-700/30 text-slate-300 border border-slate-600`;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return `$${value.toFixed(2)}`;
  };

  const formatShares = (shares: number) => {
    return shares.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "pt" ? "pt-BR" : "en-US");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900/50 p-4 rounded-lg border border-slate-800">
        <div className="flex-1">
          <input
            type="text"
            placeholder={insiderT.filter?.byType || "Search ticker or name..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TransactionTypeFilter)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">{insiderT.filter?.all || "All"}</option>
          <option value="BUY">{insiderT.filter?.buysOnly || "Buys Only"}</option>
          <option value="SELL">{insiderT.filter?.sellsOnly || "Sells Only"}</option>
          <option value="GRANT">Grants</option>
          <option value="EXERCISE">Exercises</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-800">
              <th className="px-4 py-3 text-left font-medium text-slate-200 cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort("name")}>
                {columnT.executive || "Executive"} {sortKey === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-200 cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort("type")}>
                {columnT.type || "Type"} {sortKey === "type" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-200 cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort("shares")}>
                {columnT.shares || "Shares"} {sortKey === "shares" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-200 hidden md:table-cell">
                {columnT.price || "Price"}
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-200 cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort("date")}>
                {columnT.transactionDate || "Date"} {sortKey === "date" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {insiderT.noData || "No insider transactions found"}
                </td>
              </tr>
            ) : (
              filtered.map((tx, idx) => (
                <tr
                  key={`${tx.cik}-${tx.transactionDate}-${idx}`}
                  className="border-b border-slate-800/50 hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-3 text-white">
                    <div className="flex flex-col">
                      <span className="font-medium">{tx.executiveName}</span>
                      <span className="text-xs text-slate-400">{tx.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={getTransactionTypeBadge(tx.transactionType)}>
                      {typeT[tx.transactionType as keyof typeof typeT] || tx.transactionType}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    {formatShares(tx.sharesTransacted)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white hidden md:table-cell">
                    {formatCurrency(tx.transactionPrice)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {formatDate(tx.transactionDate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Data source attribution */}
      <div className="text-xs text-slate-500 text-center pt-2">
        {insiderT.dataSource || "Source: SEC EDGAR Form 4 Filings"}
      </div>

      {/* Results count */}
      {filtered.length > 0 && (
        <div className="text-xs text-slate-400 text-center">
          Showing {filtered.length} of {data.length} transactions
        </div>
      )}
    </div>
  );
}
