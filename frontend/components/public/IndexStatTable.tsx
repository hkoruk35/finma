// Paylasilan, ince ("thin") tablo tarzi stat listesi — market-index sayfalarinda
// (frontend/app/global/[locale]/[indexSlug]/**) grid kutucuklari yerine kullanilir.
// Tek kaynak: butun 6 sayfa dosyasi (index/daily/daily-detail/weekly/weekly-detail)
// ayni bilesen + tip olcegini kullanir, boylece punto/renk tutarliligi garanti edilir.

export type IndexStatItem = {
  label: string;
  value: string;
  positive?: boolean; // true => yesil, false => kirmizi, undefined => notr (beyaz)
};

export function IndexStatTable({ items, columns = 2 }: { items: IndexStatItem[]; columns?: 2 | 3 }) {
  const colClass = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl className={`grid grid-cols-1 ${colClass} gap-x-6 rounded-lg border border-[#1e2a3a] bg-[#0a0e17]/40 overflow-hidden mb-4`}>
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#1e2a3a]/70 last:border-b-0"
        >
          {/* 2026-08-23 kullanıcı talebi: teknik terim/kısaltma olmayan
              etiketler (Kapanış, Değişim, Hacim, vb.) büyük harfle
              yazılmasın — zorla uppercase CSS'i kaldırıldı, etiketler artık
              kaynaktaki (copy.ts) doğal Title Case haliyle görünüyor.
              Zaten kısaltma olanlar (RSI (14), ATR (14), EMA20, VIX, DXY,
              US10Y) kaynak metinde büyük harfle yazılı olduğu için
              görünüşte değişmiyor. */}
          <dt className="text-[11px] font-medium text-slate-500 tracking-wide">{item.label}</dt>
          <dd
            className={`text-sm font-semibold font-mono tabular-nums ${
              item.positive === undefined ? "text-white" : item.positive ? "!text-[#3fb950]" : "!text-[#f85149]"
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
