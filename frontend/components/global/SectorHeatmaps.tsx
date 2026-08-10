'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/copy';
import { formatNumber } from "@/lib/formatNumber";

export interface SectorItem {
  ticker: string;
  label: string;
}

interface HourlyBar {
  time: string;
  change_pct: number | null;
}

type QuoteMap = Record<string, { value: number; change_pct: number; recent_closes: number[] }>;

const HOUR_SLOTS = ['09:15', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '16:15'];
const ACCENT = '#38bdf8';

function heatBg(pct: number | null) {
  if (pct === null) return { bg: '#111111', text: '#333333' };
  if (pct >= 2.0) return { bg: '#0d4a0d', text: '#56d364' };
  if (pct >= 1.0) return { bg: '#0d3a0d', text: '#3fb950' };
  if (pct >= 0.3) return { bg: '#0d2a0d', text: '#3fb950' };
  if (pct > -0.3) return { bg: '#1a1a1a', text: '#8b949e' };
  if (pct > -1.0) return { bg: '#2a0d0d', text: '#f85149' };
  if (pct > -2.0) return { bg: '#3a0d0d', text: '#f85149' };
  return { bg: '#4a0d0d', text: '#ff7b72' };
}

function getLabels(locale: Locale) {
  if (locale === 'tr') return { title: 'Isı Haritası', hourly: 'Saatlik', daily: 'Günlük', sector: 'SEKTÖR', loading: 'Yükleniyor...', today: 'Bugün' };
  if (locale === 'pt') return { title: 'Mapa de Calor', hourly: 'Por Hora', daily: 'Diário', sector: 'SETOR', loading: 'Carregando...', today: 'Hoje' };
  if (locale === 'es') return { title: 'Mapa de Calor', hourly: 'Por Hora', daily: 'Diario', sector: 'SECTOR', loading: 'Cargando...', today: 'Hoy' };
  if (locale === 'fr') return { title: 'Carte Thermique', hourly: 'Horaire', daily: 'Journalier', sector: 'SECTEUR', loading: 'Chargement...', today: "Aujourd'hui" };
  return { title: 'Heat Map', hourly: 'Hourly', daily: 'Daily', sector: 'SECTOR', loading: 'Loading...', today: 'Today' };
}

/** Son N günün kapanışlarından gün-be-gün Δ% üretir (recent_closes zaten en güncel kapanışla biter). */
function dailyChangesFrom(closes: number[], n: number): (number | null)[] {
  const tail = closes.slice(-(n + 1));
  const out: (number | null)[] = [];
  for (let i = 1; i < tail.length; i++) {
    const prev = tail[i - 1];
    const curr = tail[i];
    out.push(prev > 0 ? ((curr - prev) / prev) * 100 : null);
  }
  while (out.length < n) out.unshift(null);
  return out;
}

/**
 * Sektör ETF'leri (XLK, XLF, ...) için Saatlik/Günlük ısı haritası sekmeleri.
 * Saatlik: /api/watchlist-data'nın hourly bar'larını kullanır (Top7Tracker'ın
 * ISI HARİTASI sekmesiyle AYNI renk skalası — heatBg). Günlük: sunucu
 * tarafında zaten çekilmiş dailyQuotes.recent_closes'tan gün-be-gün Δ%
 * türetilir, ekstra istek yok.
 */
export default function SectorHeatmaps({ locale, items, dailyQuotes }: { locale: Locale; items: SectorItem[]; dailyQuotes: QuoteMap }) {
  const [tab, setTab] = useState<'hourly' | 'daily'>('hourly');
  const [hourly, setHourly] = useState<Record<string, HourlyBar[]> | null>(null);
  const labels = getLabels(locale);

  useEffect(() => {
    let active = true;
    const tickers = items.map((i) => i.ticker).join(',');
    fetch(`/api/watchlist-data?tickers=${tickers}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { ticker: string; hourly?: HourlyBar[] }[]) => {
        if (!active) return;
        const map: Record<string, HourlyBar[]> = {};
        rows.forEach((row) => { if (row?.ticker) map[row.ticker] = row.hourly ?? []; });
        setHourly(map);
      })
      .catch(() => { if (active) setHourly({}); });
    return () => { active = false; };
  }, [items]);

  const dayCols = 8;
  const dayLabels = Array.from({ length: dayCols }, (_, i) => (i === dayCols - 1 ? labels.today : `T-${dayCols - 1 - i}`));

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0" style={{ background: ACCENT }} />
          <h3 className="text-sm font-medium text-white uppercase tracking-tight truncate">{labels.title}</h3>
        </div>
        <div className="flex gap-1.5">
          {(['hourly', 'daily'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wide rounded border transition-colors ${
                tab === t ? 'text-[#38bdf8] border-[#38bdf8] bg-[#38bdf8]/10' : 'text-slate-500 border-[#1e2a3a] hover:text-white'
              }`}
            >
              {t === 'hourly' ? labels.hourly : labels.daily}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px] font-mono min-w-[640px]">
          <thead>
            <tr className="border-b border-[#1e2a3a]">
              <th className="text-left px-3 py-2 text-[9px] font-medium uppercase tracking-wide text-slate-500 sticky left-0 bg-[#0f1117]">{labels.sector}</th>
              {(tab === 'hourly' ? HOUR_SLOTS : dayLabels).map((h, i) => (
                <th key={`${h}-${i}`} className="px-2 py-2 text-[9px] font-medium text-slate-500 whitespace-nowrap text-center">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cells: (number | null)[] =
                tab === 'hourly'
                  ? HOUR_SLOTS.map((_, i) => hourly?.[item.ticker]?.[i]?.change_pct ?? null)
                  : dailyChangesFrom(dailyQuotes[item.ticker]?.recent_closes ?? [], dayCols);
              return (
                <tr key={item.ticker} className="border-b border-[#1e2a3a]/50">
                  <td className="px-3 py-1.5 text-white/80 whitespace-nowrap sticky left-0 bg-[#0f1117]">{item.label}</td>
                  {cells.map((pct, i) => {
                    const c = hourly === null && tab === 'hourly' ? { bg: '#111111', text: '#333333' } : heatBg(pct);
                    return (
                      <td key={i} className="px-2 py-1.5 text-center" style={{ background: c.bg, color: c.text }}>
                        {pct != null ? `${pct >= 0 ? '+' : ''}${formatNumber(pct, 1)}%` : hourly === null && tab === 'hourly' ? '···' : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
