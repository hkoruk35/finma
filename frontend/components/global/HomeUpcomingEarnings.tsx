import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { getUpcomingEarnings } from "@/lib/earningsCalendar";

const STRINGS: Record<Locale, { title: string; all: string; epsEst: string; revEst: string }> = {
  tr: { title: "Yaklaşan Bilançolar", all: "TÜMÜ", epsEst: "EPS Tah.", revEst: "Gelir Tah." },
  en: { title: "Upcoming Earnings", all: "ALL", epsEst: "EPS Est.", revEst: "Rev Est." },
  es: { title: "Próximos Resultados", all: "TODO", epsEst: "BPA Est.", revEst: "Ingr. Est." },
  fr: { title: "Résultats à Venir", all: "TOUT", epsEst: "BPA Est.", revEst: "CA Est." },
  pt: { title: "Próximos Resultados", all: "TODOS", epsEst: "LPA Est.", revEst: "Rec. Est." },
};

const WEEKDAY_LOCALE: Record<Locale, string> = { tr: "tr-TR", en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-BR" };

function fmtMoney(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}

export default async function HomeUpcomingEarnings({ locale }: { locale: Locale }) {
  const t = STRINGS[locale] ?? STRINGS.en;
  const items = await getUpcomingEarnings(4);
  const allHref = `/global/${locale}/earning-calendar`;

  if (items.length === 0) {
    return (
      <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden">
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
        <div className="p-6 text-center text-[#94a3b8] text-sm">
          Şu an yaklaşan bilanço bulunmuyor.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden">
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

      <div className="divide-y divide-[#1e2a3a]/70">
        {items.map((item) => {
          const d = new Date(item.earningsDate + "T00:00:00");
          const weekday = d.toLocaleDateString(WEEKDAY_LOCALE[locale] ?? "en-US", { weekday: "short" }).toUpperCase();
          const day = d.getDate();

          return (
            <Link
              key={item.ticker}
              href={`/global/${locale}/graphic/${item.ticker}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <div className="shrink-0 w-11 text-center">
                <div className="text-[9px] font-bold text-slate-500 tracking-wide">{weekday}</div>
                <div className="text-lg font-bold text-white leading-tight">{day}</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-white truncate">{item.companyName || item.ticker}</div>
                <div className="text-[11px] text-slate-500">{item.ticker}</div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[9px] text-slate-500">{t.epsEst}</div>
                <div className="text-[12px] font-mono font-bold text-white/80">
                  {item.epsEstimate != null ? `$${item.epsEstimate.toFixed(2)}` : "—"}
                </div>
              </div>

              <div className="shrink-0 text-right w-16">
                <div className="text-[9px] text-slate-500">{t.revEst}</div>
                <div className="text-[12px] font-mono font-bold text-white/80">{fmtMoney(item.revenueEstimate)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
