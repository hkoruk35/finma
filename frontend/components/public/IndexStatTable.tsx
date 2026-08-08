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
          <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{item.label}</dt>
          <dd
            className={`text-sm font-semibold font-mono tabular-nums ${
              item.positive === undefined ? "text-white" : item.positive ? "text-green-500" : "text-red-500"
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
