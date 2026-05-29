export default function KriterLoading() {
  return (
    <div className="min-h-screen bg-[#080b12] text-green-400 font-mono p-8">
      <div className="max-w-screen-2xl mx-auto space-y-4">
        <div className="text-green-400 animate-pulse text-sm">
          {">"} BOGA AI V117 — Kriter Analizi yükleniyor...
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#0d1117] border border-green-900/30 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-[#0d1117] border border-green-900/30 rounded animate-pulse" />
        <div className="h-96 bg-[#0d1117] border border-green-900/30 rounded animate-pulse" />
      </div>
    </div>
  );
}
