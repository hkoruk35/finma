import Link from "next/link";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

export default function HotThemes2026Section() {
  const totalStocks = new Set(HOT_THEMES_2026.flatMap((t) => t.stocks.map((s) => s.ticker))).size;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-5 border-b border-[#e3b341]/20 pb-3 flex-wrap">
        <div className="w-1 h-5 bg-[#e3b341] rounded-full" />
        <h2 className="text-xs font-black text-[#e3b341] uppercase tracking-[0.25em]">
          2026 GÜNCEL TEMATİK LİSTE
        </h2>
        <span className="text-[10px] text-white/30 uppercase tracking-wide">
          {HOT_THEMES_2026.length} tema · {totalStocks} hisse · CES 2026 / Pentagon bütçesi / CHIPS Act katalizörleri
        </span>
      </div>

      <div className="space-y-4">
        {HOT_THEMES_2026.map((theme) => (
          <article
            key={theme.slug}
            className="border rounded-xl p-5"
            style={{ borderColor: `${theme.accent}30`, background: `${theme.accent}08` }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-black tabular-nums" style={{ color: theme.accent }}>
                  {String(theme.number).padStart(2, "0")}
                </span>
                <h3 className="text-sm font-black uppercase tracking-wide text-white leading-snug">
                  {theme.title}
                </h3>
              </div>
              <Link
                href={`/csp/${theme.slug}`}
                className="shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all hover:bg-white/10"
                style={{ borderColor: theme.accent, color: theme.accent }}
              >
                Takip Sayfasını Aç →
              </Link>
            </div>

            <p className="text-[12px] text-slate-400 leading-relaxed mb-4">{theme.summary}</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
              {theme.stocks.map((stock) => (
                <Link
                  key={stock.ticker}
                  href={`/stock/${stock.ticker}`}
                  className="block rounded-lg border border-white/5 bg-black/20 px-3 py-2 hover:border-white/20 transition-all"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-[12px]" style={{ color: theme.accent }}>
                      {stock.ticker}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">{stock.company}</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-snug mt-1">{stock.blurb}</p>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
