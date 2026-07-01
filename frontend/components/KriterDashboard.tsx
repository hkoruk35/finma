"use client";

import React from "react";

export default function KriterDashboard({
  reportDays = [],
  aggregateStats = null,
  signalMatrix = null,
  dailyTrend = null,
}: {
  reportDays?: any[];
  aggregateStats?: any;
  signalMatrix?: any;
  dailyTrend?: any;
}) {
  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8">
      <div className="glass-card p-8 rounded-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Kriter Analiz Dashboard</h2>
        <p className="text-gray-400">Kriter analysis dashboard component</p>

        {reportDays && reportDays.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Report Days</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportDays.map((day: any, idx: number) => (
                <div key={idx} className="bg-[#1a1a2e] p-4 rounded">
                  <p className="text-sm text-gray-400">{day}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {aggregateStats && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Aggregate Stats</h3>
            <pre className="bg-[#0a0e17] p-4 rounded text-xs text-gray-400 overflow-auto">
              {JSON.stringify(aggregateStats, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
