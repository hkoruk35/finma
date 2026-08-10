import Link from "next/link";
import { formatAssetPrice } from "@/lib/symbols";
import type { Locale } from "@/lib/i18n/copy";
import { formatNumber } from "@/lib/formatNumber";

export interface AssetClassItem {
  ticker: string;
  label: string;
  quote?: { value: number; change_pct: number };
}

/**
 * Anonim ana sayfanın (tamamen açık ekran) yeni varlık sınıfı bölümlerinden
 * biri — US endeksleri/sektörleri/FX/emtia/kripto. Her karo mevcut
 * /graphic/[ticker] sayfasına link verir (yeni bir "günlük analiz" sayfası
 * gerekmiyor — preorder-analysis motoru zaten herhangi bir ticker için
 * çalışıyor, bkz. Faz 2 planı). Giriş gerektirmez, kilit yok.
 */
export default function HomeAssetClassSection({
  title,
  items,
  locale,
  accent = "#3b82f6",
}: {
  title: string;
  items: AssetClassItem[];
  locale: Locale;
  accent?: string;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/50 mb-3 px-1">{title}</h2>
      <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 pb-1 md:grid md:grid-cols-5 md:overflow-visible">
        {items.map((item) => {
          const positive = (item.quote?.change_pct ?? 0) >= 0;
          return (
            <Link
              key={item.ticker}
              href={`/global/${locale}/graphic/${item.ticker}`}
              className="snap-start shrink-0 w-[140px] md:w-auto rounded-2xl bg-[#0f1117] border border-white/10 px-4 py-3 hover:border-[#3b82f6]/40 transition-colors"
            >
              <div className="text-[11px] font-medium text-white/40 truncate">{item.label}</div>
              <div className="text-sm font-semibold text-white mt-1">
                {item.quote ? formatAssetPrice(item.quote.value, item.ticker) : "—"}
              </div>
              <div
                className="text-[11px] font-medium mt-0.5"
                style={{ color: !item.quote ? "#8b949e" : positive ? "#3fb950" : "#f85149" }}
              >
                {item.quote ? `${positive ? "+" : ""}${formatNumber(item.quote.change_pct, 2)}%` : "—"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
