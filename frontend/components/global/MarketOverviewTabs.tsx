'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatAssetPrice } from '@/lib/symbols';
import type { Locale } from '@/lib/i18n/copy';
import Sparkline from './Sparkline';
import TickerHoverChart from '@/components/TickerHoverChart';

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

export default function MarketOverviewTabs({ groups, locale }: { groups: MarketGroup[]; locale: Locale }) {
  const [active, setActive] = useState(groups[0]?.key ?? '');
  const activeGroup = groups.find((g) => g.key === active) ?? groups[0];

  if (!activeGroup) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-1.5 mb-3 bg-[#0d131f] p-1.5 rounded-xl border border-[#1e2a3a] w-full overflow-x-auto scrollbar-hide">
        {groups.map((g) => {
          const isActive = active === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setActive(g.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-[#3b82f6] text-white shadow-md shadow-blue-500/30 border border-blue-400/40'
                  : 'text-[#38bdf8] hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {activeGroup.items.map((item) => {
          const changePct = item.quote?.change_pct ?? 0;
          const positive = changePct >= 0;
          const color = !item.quote ? '#8b949e' : positive ? '#3fb950' : '#f85149';
          return (
            <TickerHoverChart key={item.ticker} ticker={item.ticker} locale={locale}>
              <Link
                href={`/global/${locale}/graphic/${item.ticker}`}
                className="group block rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-3.5 hover:border-[#3b82f6]/50 hover:bg-[#141b2a] transition-all duration-200 shadow-sm"
              >
                <div className="text-[11px] font-medium text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                  {item.label}
                </div>
                <div className="text-sm font-bold font-mono text-white mt-1 tracking-tight">
                  {item.quote ? formatAssetPrice(item.quote.value, item.ticker) : '—'}
                </div>
                <div className="flex items-center justify-between mt-2 gap-1.5">
                  <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}15` }}>
                    {item.quote ? `${positive ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                  </span>
                  {item.quote && item.quote.recent_closes.length > 1 && (
                    <Sparkline data={item.quote.recent_closes} color={color} changePct={changePct} width={48} height={18} />
                  )}
                </div>
              </Link>
            </TickerHoverChart>
          );
        })}
      </div>
    </section>
  );
}
