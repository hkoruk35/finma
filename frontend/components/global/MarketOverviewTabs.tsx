'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAssetPrice } from '@/lib/symbols';
import type { Locale } from '@/lib/i18n/copy';
import Sparkline from './Sparkline';

export interface MarketQuoteItem {
  ticker: string;
  label: string;
  quote?: { value: number; change_pct: number; recent_closes: number[] };
}

export interface MarketGroup {
  key: string;
  label: string;
  items: MarketQuoteItem[];
}

/**
 * Ana sayfanın üst bölümü: US Endeksleri / Döviz / Emtia / Kripto arasında
 * sekmeli geçiş (sektörler kasıtlı olarak burada değil — sağ sütunda ayrı
 * bir liste olarak gösteriliyor, bkz. HomeSectorListCard). Sekme görseli
 * DetailTabs.tsx'in pill-tab kuralını takip eder; kart görseli
 * HomeAssetClassSection'ın kart tasarımına mini bir Sparkline eklenmiş hali.
 */
export default function MarketOverviewTabs({ groups, locale }: { groups: MarketGroup[]; locale: Locale }) {
  const [active, setActive] = useState(groups[0]?.key ?? '');
  const activeGroup = groups.find((g) => g.key === active) ?? groups[0];

  if (!activeGroup) return null;

  return (
    <section className="mb-5">
      <div className="flex items-center gap-1.5 mb-3 bg-[#141924] p-1.5 rounded-xl border border-[#1e2a3a] w-fit max-w-full overflow-x-auto scrollbar-hide">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActive(g.key)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wide whitespace-nowrap transition-all ${
              active === g.key
                ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 pb-1 md:grid md:overflow-visible"
        style={{ gridTemplateColumns: `repeat(${activeGroup.items.length}, minmax(0, 1fr))` }}
      >
        {activeGroup.items.map((item) => {
          const positive = (item.quote?.change_pct ?? 0) >= 0;
          const color = !item.quote ? '#8b949e' : positive ? '#3fb950' : '#f85149';
          return (
            <Link
              key={item.ticker}
              href={`/global/${locale}/graphic/${item.ticker}`}
              className="snap-start shrink-0 w-[150px] md:w-auto rounded-2xl bg-[#0f1117] border border-white/10 px-4 py-3 hover:border-[#3b82f6]/40 transition-colors"
            >
              <div className="text-[11px] font-medium text-white/40 truncate">{item.label}</div>
              <div className="text-sm font-semibold text-white mt-1">
                {item.quote ? formatAssetPrice(item.quote.value, item.ticker) : '—'}
              </div>
              <div className="flex items-center justify-between mt-1 gap-2">
                <span className="text-[11px] font-medium" style={{ color }}>
                  {item.quote ? `${positive ? '+' : ''}${item.quote.change_pct.toFixed(2)}%` : '—'}
                </span>
                {item.quote && item.quote.recent_closes.length > 1 && (
                  <Sparkline data={item.quote.recent_closes} color={color} changePct={item.quote.change_pct} width={44} height={16} />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
