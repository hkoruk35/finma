"use client";

export default function KriterError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#080b12] text-red-400 font-mono p-8 flex flex-col items-center justify-center gap-4">
      <div className="text-sm">{">"} HATA: {error.message}</div>
      <button
        onClick={reset}
        className="px-4 py-2 border border-red-400/40 text-red-400 text-xs rounded hover:bg-red-400/10 transition-colors"
      >
        Tekrar Dene
      </button>
    </div>
  );
}
