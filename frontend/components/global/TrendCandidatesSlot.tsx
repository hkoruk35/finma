'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { TrendStatus } from '@/lib/homeFeed';
import { copy, type Locale } from '@/lib/i18n/copy';
import TickerHoverChart from '../TickerHoverChart';
import { useMemberPlan } from '@/hooks/useMemberPlan';
import PremiumModal from './PremiumModal';

interface Stock {
  ticker: string;
  sector: string;
  status: TrendStatus;
  price: number;
  change_pct: number;
}

interface WatchlistPickRaw {
  ticker: string;
  company?: string;
  sector?: string;
  current_price?: number;
}

interface LiveWatchData {
  ticker: string;
  sector?: string;
  price?: { current: number; change_pct: number };
  tracker_1h?: { signal: string; change_pct_1d: number };
}

const ACCENT = '#a78bfa';

function getLabels(locale: Locale) {
  if (locale === 'tr') return {
    title: 'Trend Adayları', all: 'TÜMÜ', stock: 'HİSSE / SEKTÖR', price: 'FİYAT',
    empty: 'Bugün için trend adayı bulunmuyor', loading: 'Yükleniyor...', href: '/global/tr/watchlist', premiumMember: 'Premium Üye',
  };
  if (locale === 'pt') return {
    title: 'Candidatos em Tendência', all: 'TODOS', stock: 'AÇÃO / SETOR', price: 'PREÇO',
    empty: 'Nenhum candidato hoje', loading: 'Carregando...', href: '/global/pt/watchlist', premiumMember: 'Membro Premium',
  };
  if (locale === 'es') return {
    title: 'Candidatos en Tendencia', all: 'TODO', stock: 'ACCIÓN / SECTOR', price: 'PRECIO',
    empty: 'No hay candidatos hoy', loading: 'Cargando...', href: '/global/es/watchlist', premiumMember: 'Miembro Premium',
  };
  if (locale === 'fr') return {
    title: 'Candidats Tendance', all: 'TOUT', stock: 'ACTION / SECTEUR', price: 'PRIX',
    empty: "Aucun candidat aujourd'hui", loading: 'Chargement...', href: '/global/fr/watchlist', premiumMember: 'Membre Premium',
  };
  return {
    title: 'Trend Candidates', all: 'ALL', stock: 'STOCK / SECTOR', price: 'PRICE',
    empty: 'No trend candidates today', loading: 'Loading...', href: '/global/en/watchlist', premiumMember: 'Premium Member',
  };
}

/**
 * "Trend Adayları" — BOGA'nın izleme/aday havuzu (watchlist_picks.json),
 * henüz onaylanmış swing girişi olmayan hisseler. TrendPicksSlot.tsx'in
 * ("Trend Hisseleri") birebir aynı yapısı, tek fark veri kaynağı
 * (/api/watchlist-picks) ve premium kilit kuralı AYNI (isTrendPickTierUnlocked
 * ile aynı ilke — ilk satır hariç premium olmayana kilitli).
 */
export default function TrendCandidatesSlot({ locale, compactMode }: { locale: Locale; compactMode?: boolean }) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sectorNames = copy[locale].top100.sectors as Record<string, string>;
  const labels = getLabels(locale);
  const { isPremium } = useMemberPlan();
  const [showModal, setShowModal] = useState(false);
  const displayStocks = compactMode ? stocks.slice(0, 7) : stocks;

  useEffect(() => {
    let active = true;

    fetch('/api/watchlist-picks', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { picks: [] })
      .then(async (data) => {
        const picks: WatchlistPickRaw[] = (data.picks ?? []).slice(0, 10);
        if (!active) return;
        if (picks.length === 0) {
          setStocks([]);
          return;
        }

        const tickers = picks.map(p => p.ticker).join(',');
        const liveRows: LiveWatchData[] = await fetch(`/api/watchlist-data?tickers=${tickers}`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => []);
        if (!active) return;

        const liveMap: Record<string, LiveWatchData> = {};
        liveRows.forEach(item => { if (item?.ticker) liveMap[item.ticker] = item; });

        const mapped: Stock[] = picks.map(p => {
          const d = liveMap[p.ticker];
          const signal = d?.tracker_1h?.signal;
          const status: TrendStatus = signal === 'STRONG' ? 'BULLISH' : signal === 'WEAK' ? 'BEARISH' : 'NEUTRAL';
          return {
            ticker: p.ticker,
            sector: d?.sector ?? p.sector ?? '',
            status,
            price: d?.price?.current ?? p.current_price ?? 0,
            change_pct: d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0,
          };
        });
        setStocks(mapped);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });

    return () => { active = false; };
  }, []);

  return (
    <>
      {showModal && <PremiumModal locale={locale} onClose={() => setShowModal(false)} />}

      <div className={`bg-gradient-to-br from-[#150a28] to-[#0a0514] border border-[#1e2a3a]/60 ${compactMode ? 'rounded-xl' : 'rounded-2xl'} overflow-hidden flex flex-col h-full w-full shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
      <div className={`flex items-center justify-between ${compactMode ? 'px-3 py-2.5' : 'px-5 py-4'} border-b border-[#1e2a3a]`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0" style={{ background: ACCENT }} />
          <h3 className={`${compactMode ? 'text-xs' : 'text-sm'} font-medium text-white uppercase tracking-tight truncate`}>{labels.title}</h3>
        </div>
        <Link
          href={labels.href}
          className={`inline-flex items-center gap-1 ${compactMode ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'} bg-[#1e293b] border rounded-full font-medium uppercase tracking-wider transition-all duration-200 hover:bg-white/5`}
          style={{ color: ACCENT, borderColor: `${ACCENT}4d` }}
        >
          {labels.all}
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {displayStocks.length > 0 ? (
        <>
          <div className={`flex items-center justify-between ${compactMode ? 'px-3 py-1.5 text-[9px]' : 'px-5 py-2 text-[11px]'} border-b border-[#1e2a3a] font-medium uppercase tracking-[0.5px] text-slate-500`}>
            <span>{labels.stock}</span>
            <span>{labels.price}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1e2a3a]/70">
            {displayStocks.map((stock, idx) => {
              const locked = idx > 0 && !isPremium;
              return (
                <div
                  key={stock.ticker}
                  className={`flex items-center justify-between gap-2 ${compactMode ? 'px-3 py-2' : 'px-5 py-3.5'} transition-colors duration-150 group hover:bg-white/[0.03] cursor-pointer`}
                  onClick={locked ? () => setShowModal(true) : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-mono font-medium text-slate-500 w-3 shrink-0">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      {locked ? (
                        <div className="text-[11px] font-medium text-[#f59e0b] truncate flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                          <span>{labels.premiumMember}</span>
                        </div>
                      ) : (
                        <TickerHoverChart ticker={stock.ticker}>
                          <div className="text-[15px] font-medium text-white truncate">{stock.ticker}</div>
                        </TickerHoverChart>
                      )}
                      <div className="text-[12px] text-slate-500 truncate">{sectorNames[stock.sector] ?? stock.sector}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[14px] font-mono font-medium text-white">
                      {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '—'}
                    </div>
                    <div
                      className={`text-[13px] font-mono font-medium ${
                        stock.change_pct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                      }`}
                    >
                      {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-xs text-white/60">{loaded ? labels.empty : labels.loading}</p>
        </div>
      )}
      </div>
    </>
  );
}
