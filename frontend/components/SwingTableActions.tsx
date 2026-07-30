"use client";

import React from "react";
import { exportSwingResultsToXLS } from "@/lib/exportUtils";

interface SwingTableActionsProps {
  picks: any[];
  dateStr: string;
}

export default function SwingTableActions({ picks, dateStr }: SwingTableActionsProps) {
  const exportToCSV = () => {
    if (!picks || picks.length === 0) return;

    const headers = [
      "#", "Ticker", "Company", "Sector", "Score", "Price",
      "Buy Low", "Buy High", "Target Low", "Target High", "Stop Low", "Stop High",
      "1D %", "1W %", "1M %"
    ];

    const rows = picks.map((p, i) => [
      i + 1,
      p.ticker,
      `"${p.company}"`,
      `"${p.sector}"`,
      p.score.toFixed(1),
      p.current_price.toFixed(2),
      p.buy_zone.low.toFixed(2),
      p.buy_zone.high.toFixed(2),
      p.profit_zone.low.toFixed(2),
      p.profit_zone.high.toFixed(2),
      p.stop_zone.low.toFixed(2),
      p.stop_zone.high.toFixed(2),
      p.change_1d?.toFixed(2) || "0",
      p.change_1w?.toFixed(2) || "0",
      p.change_1m?.toFixed(2) || "0"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BOGA_AI_Swing_Picks_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToXLS = () => {
    if (!picks || picks.length === 0) return;
    const mappedPicks = picks.map(p => ({
      ...p,
      price: p.current_price,
    }));
    exportSwingResultsToXLS(mappedPicks);
  };

  const copyToClipboard = () => {
    if (!picks || picks.length === 0) return;

    const text = picks.map((p, i) => 
      `#${i+1} ${p.ticker} | Score: ${p.score.toFixed(1)} | Price: $${p.current_price.toFixed(2)} | Buy: $${p.buy_zone.low}-$${p.buy_zone.high} | Target: $${p.profit_zone.high} | Stop: $${p.stop_zone.low}`
    ).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("Table data copied to clipboard!");
    });
  };

  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={exportToCSV}
        className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-[#00d2ff]/30 rounded-lg text-xs font-medium text-[#00d2ff] hover:bg-[#00d2ff]/10 transition-all"
      >
        📥 CSV Export
      </button>
      <button
        onClick={exportToXLS}
        className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-[#3b82f6]/30 rounded-lg text-xs font-medium text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
      >
        📥 XLS Export
      </button>
      <button
        onClick={copyToClipboard}
        className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-white/10 rounded-lg text-xs font-medium text-white hover:bg-white/5 transition-all"
      >
        📋 Copy List
      </button>
    </div>
  );
}
