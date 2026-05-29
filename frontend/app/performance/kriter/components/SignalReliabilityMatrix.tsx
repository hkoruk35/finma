"use client";

import type { SignalMatrix } from "@/lib/kriter-helpers";

interface Props {
  signalMatrix: SignalMatrix[];
}

function winRateColor(wr: number, hasData: boolean): string {
  if (!hasData) return "bg-gray-900/40 text-gray-600";
  if (wr >= 70) return "bg-green-800/60 text-green-300";
  if (wr >= 55) return "bg-green-900/40 text-green-400";
  if (wr >= 45) return "bg-yellow-900/40 text-yellow-400";
  if (wr >= 30) return "bg-orange-900/40 text-orange-400";
  return "bg-red-900/40 text-red-400";
}

export default function SignalReliabilityMatrix({ signalMatrix }: Props) {
  if (signalMatrix.length === 0) {
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded p-6 text-center text-gray-500 text-sm font-mono">
        Sinyal verisi yok. Arşiv dosyaları eksik olabilir.
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded p-4 font-mono">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">
        Sinyal Güvenilirlik Matrisi — Win Rate Isı Haritası
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4 text-[9px] flex-wrap">
        {[
          { label: "≥70%", cls: "bg-green-800/60 text-green-300" },
          { label: "55-70%", cls: "bg-green-900/40 text-green-400" },
          { label: "45-55%", cls: "bg-yellow-900/40 text-yellow-400" },
          { label: "30-45%", cls: "bg-orange-900/40 text-orange-400" },
          { label: "<30%", cls: "bg-red-900/40 text-red-400" },
        ].map((l) => (
          <span key={l.label} className={`px-2 py-0.5 rounded ${l.cls}`}>{l.label}</span>
        ))}
      </div>

      {/* Matrix grid */}
      <div className="space-y-2">
        {signalMatrix.slice(0, 12).map((row) => {
          const completed = row.win + row.loss;
          const hasData = completed > 0;
          const cellColor = winRateColor(row.win_rate, hasData);

          return (
            <div key={row.signal} className="flex items-center gap-3">
              {/* Signal name */}
              <div className="w-52 text-[11px] text-gray-400 truncate flex-shrink-0" title={row.signal}>
                {row.signal}
              </div>
              {/* Win rate cell */}
              <div className={`px-3 py-1 rounded text-[11px] font-bold w-16 text-center ${cellColor}`}>
                {hasData ? `%${row.win_rate}` : "N/A"}
              </div>
              {/* Stats */}
              <div className="text-[10px] text-gray-500 flex gap-3">
                <span className="text-green-400">W:{row.win}</span>
                <span className="text-red-400">L:{row.loss}</span>
                {row.pending > 0 && <span className="text-yellow-400">P:{row.pending}</span>}
                <span className="text-gray-600">({row.count} toplam)</span>
                {row.avg_return !== 0 && (
                  <span className={row.avg_return >= 0 ? "text-green-400" : "text-red-400"}>
                    ort: {row.avg_return >= 0 ? "+" : ""}{row.avg_return}%
                  </span>
                )}
              </div>
              {/* Bar */}
              <div className="flex-1 bg-gray-900 rounded h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${hasData && row.win_rate >= 50 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${hasData ? row.win_rate : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {signalMatrix.length > 12 && (
        <div className="text-[10px] text-gray-600 mt-3">
          +{signalMatrix.length - 12} daha fazla sinyal (en sık tetiklenenler gösteriliyor)
        </div>
      )}
    </div>
  );
}
