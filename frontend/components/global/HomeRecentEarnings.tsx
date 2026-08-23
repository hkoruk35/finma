import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Locale } from "@/lib/i18n/copy";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

const STRINGS: Record<
  Locale,
  {
    title: string;
    all: string;
    revenue: string;
    eps: string;
    score: string;
    keyTakeaways: string;
    bullish: string;
    bearish: string;
    source: string;
    detail: string;
  }
> = {
  tr: {
    title: "Son Bilanço Analizleri", all: "Tümü", revenue: "Gelir", eps: "EPS",
    score: "BOGA AI Skoru", keyTakeaways: "Öne Çıkanlar", bullish: "Boğa Sinyalleri", bearish: "Ayı Sinyalleri",
    source: "SEC EDGAR", detail: "Analiz Detayı →",
  },
  en: {
    title: "Recent Earnings Analysis", all: "All", revenue: "Rev", eps: "EPS",
    score: "BOGA AI Score", keyTakeaways: "Key Takeaways", bullish: "Bullish Signals", bearish: "Bearish Signals",
    source: "SEC EDGAR", detail: "Full Analysis →",
  },
  es: {
    title: "Últimos Resultados", all: "Todo", revenue: "Ingr.", eps: "BPA",
    score: "Puntuación BOGA AI", keyTakeaways: "Puntos Clave", bullish: "Señales Alcistas", bearish: "Señales Bajistas",
    source: "SEC EDGAR", detail: "Análisis Completo →",
  },
  fr: {
    title: "Derniers Résultats", all: "Tout", revenue: "CA", eps: "BPA",
    score: "Score BOGA AI", keyTakeaways: "Points Clés", bullish: "Signaux Haussiers", bearish: "Signaux Baissiers",
    source: "SEC EDGAR", detail: "Analyse Complète →",
  },
  pt: {
    title: "Resultados Recentes", all: "Todos", revenue: "Rec.", eps: "LPA",
    score: "Pontuação BOGA AI", keyTakeaways: "Principais Pontos", bullish: "Sinais de Alta", bearish: "Sinais de Baixa",
    source: "SEC EDGAR", detail: "Análise Completa →",
  },
  id: {
    title: "Analisis Laba Terbaru", all: "Semua", revenue: "Pend.", eps: "EPS",
    score: "Skor BOGA AI", keyTakeaways: "Poin Utama", bullish: "Sinyal Bullish", bearish: "Sinyal Bearish",
    source: "SEC EDGAR", detail: "Analisis Lengkap →",
  },
};

async function getRecent(locale: Locale) {
  const { data } = await supabaseAdmin
    .from("earnings_reports")
    .select("*")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2);

  return (data || []).map((row: any) => ({
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    reportDate: row.report_date,
    formType: row.sec_form_type,
    ai: row.ai_summary?.[locale] ?? row.ai_summary?.en ?? null,
  }));
}

export default async function HomeRecentEarnings({ locale }: { locale: Locale }) {
  const t = STRINGS[locale] ?? STRINGS.en;
  const items = await getRecent(locale);
  const allHref = `/global/${locale}/earning`;

  if (items.length === 0) return null;

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0 bg-[#3b82f6]" />
          <h3 className="text-[16px] font-bold text-[#3b82f6] truncate">{t.title}</h3>
        </div>
        <Link
          href={allHref}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#1e293b] border border-[#3b82f6]/30 text-[#3b82f6] rounded-full font-bold tracking-wide transition-all duration-200 hover:bg-white/5 shrink-0"
        >
          {t.all}
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <div className="flex md:grid md:grid-cols-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide md:divide-x divide-[#1e2a3a]/70">
        {items.map((item) => {
          const ai = item.ai;
          const revenuePositive = ai?.revenue_status && !/below|altı|bajas?|baisse|baixo/i.test(ai.revenue_status);

          return (
            <div key={item.id} className="flex-none w-[90%] md:w-auto snap-center p-4 hover:bg-white/[0.02] transition-colors flex flex-col justify-between border-r border-[#1e2a3a]/70 last:border-r-0 md:border-r-0">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Link href={`/global/${locale}/graphic/${item.ticker}`} className="text-lg font-bold text-white hover:text-[#3b82f6] transition-colors flex items-center gap-2">
                      {item.ticker}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 uppercase">
                        {item.formType}
                      </span>
                    </Link>
                    <div className="text-[11px] text-white/50 truncate max-w-[150px]">{item.companyName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/40 font-mono">{item.reportDate}</div>
                  </div>
                </div>

                {ai && (
                  <>
                    <p className="text-[12px] text-white/70 line-clamp-3 mb-3 leading-relaxed">
                      {ai.summary}
                    </p>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: revenuePositive ? "#22c55e" : "#ef4444",
                          backgroundColor: revenuePositive ? "#22c55e15" : "#ef444415",
                        }}
                      >
                        {t.revenue}: {ai.revenue_status}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/70">
                        {t.eps}: {ai.eps_status}
                      </span>
                      {typeof ai.ai_score === "number" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30">
                          {t.score}: {ai.ai_score}/10
                        </span>
                      )}
                    </div>

                    {Array.isArray(ai.key_takeaways) && ai.key_takeaways.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[12px] font-bold text-[#3b82f6] mb-1">{t.keyTakeaways}</div>
                        <ul className="space-y-1">
                          {ai.key_takeaways.slice(0, 2).map((k: string, i: number) => (
                            <li key={i} className="text-[11px] text-white/70 flex gap-1.5 leading-snug">
                              <span className="text-[#3b82f6] mt-0.5 shrink-0">•</span>
                              <span className="line-clamp-1">{k}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {((Array.isArray(ai.bullish_signals) && ai.bullish_signals.length > 0) ||
                      (Array.isArray(ai.bearish_signals) && ai.bearish_signals.length > 0)) && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {Array.isArray(ai.bullish_signals) && ai.bullish_signals.length > 0 && (
                          <div className="bg-[#22c55e]/5 border border-[#22c55e]/10 rounded-lg p-2">
                            <div className="text-[11px] font-bold text-[#22c55e] mb-1">{t.bullish}</div>
                            <div className="text-[10px] text-[#22c55e]/80 font-medium line-clamp-2 leading-snug">
                              {ai.bullish_signals[0]}
                            </div>
                          </div>
                        )}
                        {Array.isArray(ai.bearish_signals) && ai.bearish_signals.length > 0 && (
                          <div className="bg-[#ef4444]/5 border border-[#ef4444]/10 rounded-lg p-2">
                            <div className="text-[11px] font-bold text-[#ef4444] mb-1">{t.bearish}</div>
                            <div className="text-[10px] text-[#ef4444]/80 font-medium line-clamp-2 leading-snug">
                              {ai.bearish_signals[0]}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end mb-4">
                      <Link href={`/global/${locale}/graphic/${item.ticker}`} className="text-[10px] font-bold text-[#3b82f6] hover:underline">
                        {t.detail}
                      </Link>
                    </div>
                  </>
                )}
              </div>

              {/* Mini Chart Area */}
              <div className="h-[180px] w-full mt-4 relative border border-[#1e2a3a]/40 rounded-lg overflow-hidden bg-black/30">
                <BogaChartEngine 
                  symbol={item.ticker}
                  lang={locale}
                  height={180}
                  defaultTimeframe="W"
                  defaultCandleType="line"
                  compact={true}
                  showToolbar={false}
                  hideIndicatorToggles={true}
                  indicators={[]}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
