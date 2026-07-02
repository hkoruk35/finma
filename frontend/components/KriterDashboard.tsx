"use client";

import React from "react";

export default function KriterDashboard({
  initialTrades = [],
  initialStats = null,
  initialSignalMatrix = null,
  initialDailyTrend = null,
  reportDays = [],
}: {
  initialTrades?: any[];
  initialStats?: any;
  initialSignalMatrix?: any;
  initialDailyTrend?: any;
  reportDays?: string[];
}) {
  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8">
      <div className="glass-card p-8 rounded-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Kriter Analiz Dashboard</h2>
        <p className="text-gray-400">Son {reportDays?.length || 0} rapor gününde açılan trade'lerin teknik analizi</p>

        {reportDays && reportDays.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Report Days ({reportDays.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportDays.map((day: string, idx: number) => (
                <div key={idx} className="bg-[#1a1a2e] p-4 rounded">
                  <p className="text-sm text-gray-400">{day}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {initialTrades && initialTrades.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Trades ({initialTrades.length})</h3>
            <p className="text-gray-400 text-sm">Total trades analyzed in period</p>
          </div>
        )}

        {initialStats && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Aggregate Stats</h3>
            <pre className="bg-[#000036] p-4 rounded text-xs text-gray-400 overflow-auto max-h-64">
              {JSON.stringify(initialStats, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
