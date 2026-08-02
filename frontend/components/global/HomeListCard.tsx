'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n/copy';
import { copy } from '@/lib/i18n/copy';
import Sparkline from './Sparkline';

export interface HomeListStock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
  sparkline?: number[];
}

const REGISTER_PATH: Record<Locale, string> = {
  tr: 'kayit',
  en: 'register',
  es: 'register',
  fr: 'register',
  pt: 'register',
};

function getLabels(locale: Locale) {
  if (locale === 'tr') return { all: 'TÜMÜ', stock: 'HİSSE / SEKTÖR', price: 'FİYAT', empty: 'Veri bulunmamaktadır', signIn: 'Görmek için giriş yapın' };
  if (locale === 'pt') return { all: 'TODOS', stock: 'AÇÃO / SETOR', price: 'PREÇO', empty: 'Nenhum dado disponível', signIn: 'Entre para ver' };
  if (locale === 'es') return { all: 'TODO', stock: 'ACCIÓN / SECTOR', price: 'PRECIO', empty: 'No hay datos disponibles', signIn: 'Inicia sesión para ver' };
  if (locale === 'fr') return { all: 'TOUT', stock: 'ACTION / SECTEUR', price: 'PRIX', empty: 'Aucune donnée disponible', signIn: 'Connectez-vous pour voir' };
  return { all: 'ALL', stock: 'STOCK / SECTOR', price: 'PRICE', empty: 'No data available', signIn: 'Sign in to reveal' };
}

interface Props {
  title: string;
  accent: string;
  viewAllHref?: string;
  stocks: HomeListStock[];
  locale: Locale;
  loading?: boolean;
}

export default function HomeListCard({ title, accent, viewAllHref, stocks, locale, loading }: Props) {
  const router = useRouter();
  const labels = getLabels(locale);
  const sectorNames = (copy[locale]?.top100?.sectors ?? {}) as Record<string, string>;

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0" style={{ background: accent }} />
          <h3 className="text-xs font-medium text-white uppercase tracking-tight truncate">{title}</h3>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] bg-[#1e293b] border rounded-full font-medium uppercase tracking-wider transition-all duration-200 hover:bg-white/5 shrink-0"
            style={{ color: accent, borderColor: `${accent}4d` }}
          >
            {labels.all}
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        )}
      </div>

      {stocks.length > 0 ? (
        <>
          <div className="grid grid-cols-[1fr_40px_60px] gap-2 px-3 py-1.5 text-[9px] border-b border-[#1e2a3a] font-medium uppercase tracking-[0.5px] text-slate-500">
            <span>{labels.stock}</span>
            <span />
            <span className="text-right">{labels.price}</span>
          </div>
          <div className="flex-1 min-h-0 divide-y divide-[#1e2a3a]/70">
            {stocks.map((stock, idx) => {
              const locked = stock.ticker.startsWith('LOCKED-');
              return (
                <div
                  key={stock.ticker + idx}
                  className="grid grid-cols-[1fr_40px_60px] gap-2 items-center px-3 py-2 transition-colors duration-150 hover:bg-white/[0.03] cursor-pointer"
                  onClick={() =>
                    locked
                      ? router.push(`/global/${locale}/${REGISTER_PATH[locale]}`)
                      : router.push(`/global/${locale}/graphic/${stock.ticker}`)
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono font-medium text-slate-500 w-3 shrink-0">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      {locked ? (
                        <div className="text-[11px] font-medium text-[#f59e0b] truncate flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                          <span className="truncate">{labels.signIn}</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-[13px] font-medium text-white truncate">{stock.ticker}</div>
                          <div className="text-[11px] text-slate-500 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="justify-self-center">
                    <Sparkline data={stock.sparkline ?? []} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} width={40} height={18} />
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-[13px] font-medium text-white/90">
                      {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '—'}
                    </div>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-[1px] rounded text-[9px] font-medium font-mono ${
                        stock.change_pct >= 0 ? 'bg-[#22c55e] text-white' : 'bg-[#ef4444] text-white'
                      }`}
                    >
                      {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-10">
          <p className="text-xs text-white/60">{loading ? '···' : labels.empty}</p>
        </div>
      )}
    </div>
  );
}
