"use client";

// Kucuk, herkese acik "cokl grafik icin sec" kutucugu — sol Markets listesi,
// Watchlist ve Trend Hisseleri satirlarinda ayni gorunumde kullanilir.
// Tiklama satirin kendi onClick'ine (ana grafigi degistirme / satiri secme)
// sizmasin diye stopPropagation kendi icinde yapilir.
export default function CompareCheckbox({
  checked,
  onToggle,
  title,
}: {
  checked: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`shrink-0 w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors ${
        checked ? "bg-[#3b82f6] border-[#3b82f6]" : "border-[#3a4a63] hover:border-[#3b82f6]"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={2}>
          <path d="M2.5 6l2.5 2.5L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
