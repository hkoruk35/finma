import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Locale } from "@/lib/i18n/copy";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

const STRINGS: Record<Locale, { title: string; all: string; revenue: string; eps: string }> = {
  tr: { title: "Son Bilanço Analizleri", all: "TÜMÜ", revenue: "Gelir", eps: "EPS" },
  en: { title: "Recent Earnings Analysis", all: "ALL", revenue: "Rev", eps: "EPS" },
  es: { title: "Últimos Resultados", all: "TODO", revenue: "Ingr.", eps: "BPA" },
  fr: { title: "Derniers Résultats", all: "TOUT", revenue: "CA", eps: "BPA" },
  pt: { title: "Resultados Recentes", all: "TODOS", revenue: "Rec.", eps: "LPA" },
  id: { title: "Analisis Laba Terbaru", all: "SEMUA", revenue: "Pend.", eps: "EPS" },
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
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#1e293b] border border-[#3b82f6]/30 text-[#3b82f6] rounded-full font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/5 shrink-0"
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
                    <p className="text-[12px] text-white/70 line-clamp-2 mb-3 leading-relaxed">
                      {ai.summary}
                    </p>
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
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
