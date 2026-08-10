import type { Locale } from '@/lib/i18n/copy';
import type { SectorItem } from './SectorHeatmaps';
import { formatNumber } from "@/lib/formatNumber";

type QuoteMap = Record<string, { value: number; change_pct: number; recent_closes: number[] }>;

const ACCENT = '#38bdf8';

function getLabels(locale: Locale) {
  if (locale === 'tr') return {
    title: 'Sektör Analizi', leaders: 'Öne Çıkanlar', laggards: 'Geride Kalanlar',
    summary: (l: string, lp: string, g: string, gp: string) => `Bugün öne çıkan sektör ${l} (${lp}), en zayıf sektör ise ${g} (${gp}).`,
  };
  if (locale === 'pt') return {
    title: 'Análise Setorial', leaders: 'Destaques', laggards: 'Piores Desempenhos',
    summary: (l: string, lp: string, g: string, gp: string) => `Hoje o setor em destaque é ${l} (${lp}), enquanto ${g} (${gp}) fica para trás.`,
  };
  if (locale === 'es') return {
    title: 'Análisis Sectorial', leaders: 'Destacados', laggards: 'Rezagados',
    summary: (l: string, lp: string, g: string, gp: string) => `Hoy el sector destacado es ${l} (${lp}), mientras que ${g} (${gp}) queda rezagado.`,
  };
  if (locale === 'fr') return {
    title: 'Analyse Sectorielle', leaders: 'En Tête', laggards: 'À la Traîne',
    summary: (l: string, lp: string, g: string, gp: string) => `Aujourd'hui, le secteur en tête est ${l} (${lp}), tandis que ${g} (${gp}) est à la traîne.`,
  };
  return {
    title: 'Sector Analysis', leaders: 'Leaders', laggards: 'Laggards',
    summary: (l: string, lp: string, g: string, gp: string) => `Today's leading sector is ${l} (${lp}), while ${g} (${gp}) lags behind.`,
  };
}

const fmtPct = (pct: number) => `${pct >= 0 ? '+' : ''}${formatNumber(pct, 2)}%`;

/**
 * Gerçek change_pct verisinden türetilmiş, kural-tabanlı sıralama özeti —
 * marketCommentaryEngine.ts'in per-ticker (RSI/EMA/VWAP gerektiren) motoruyla
 * KARIŞTIRILMADI, çünkü sektör ETF'leri için o girdiler burada yok. Bu bir
 * ilk sürüm: günlük/haftalık daha zengin "sektör analizleri" için temel.
 */
export default function SectorAnalysisSummary({ locale, items, quotes }: { locale: Locale; items: SectorItem[]; quotes: QuoteMap }) {
  const labels = getLabels(locale);
  const ranked = [...items]
    .map((it) => ({ ...it, change_pct: quotes[it.ticker]?.change_pct ?? 0 }))
    .sort((a, b) => b.change_pct - a.change_pct);

  if (ranked.every((r) => r.change_pct === 0)) return null;

  const leaders = ranked.slice(0, 3);
  const laggards = ranked.slice(-3).reverse();

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2a3a]">
        <span className="w-1 h-4 rounded-full shrink-0" style={{ background: ACCENT }} />
        <h3 className="text-sm font-medium text-white uppercase tracking-tight">{labels.title}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-[#22c55e] mb-2">{labels.leaders}</h4>
          <div className="space-y-1.5">
            {leaders.map((s) => (
              <div key={s.ticker} className="flex items-center justify-between text-[13px]">
                <span className="text-white/80">{s.label}</span>
                <span className="font-mono font-medium text-[#22c55e]">{fmtPct(s.change_pct)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-[#ef4444] mb-2">{labels.laggards}</h4>
          <div className="space-y-1.5">
            {laggards.map((s) => (
              <div key={s.ticker} className="flex items-center justify-between text-[13px]">
                <span className="text-white/80">{s.label}</span>
                <span className="font-mono font-medium text-[#ef4444]">{fmtPct(s.change_pct)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="px-4 pb-4 text-[12px] text-white/50 leading-relaxed">
        {labels.summary(leaders[0].label, fmtPct(leaders[0].change_pct), laggards[0].label, fmtPct(laggards[0].change_pct))}
      </p>
    </div>
  );
}
