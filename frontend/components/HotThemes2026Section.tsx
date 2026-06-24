import Link from "next/link";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

export default function HotThemes2026Section() {
  const totalStocks = new Set(HOT_THEMES_2026.flatMap((t) => t.stocks.map((s) => s.ticker))).size;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-[10px] text-white/40 uppercase tracking-wide">
          {HOT_THEMES_2026.length} tema · {totalStocks} hisse · CES 2026 / Pentagon bütçesi / CHIPS Act katalizörleri
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {HOT_THEMES_2026.map((theme) => (
          <Link
            key={theme.slug}
            href={`/csp/${theme.slug}`}
            className="group border rounded-xl p-4 transition-all hover:border-opacity-60 flex flex-col"
            style={{ borderColor: `${theme.accent}25`, background: `${theme.accent}06` }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-black tabular-nums" style={{ color: theme.accent }}>
                  {String(theme.number).padStart(2, "0")}
                </span>
                <h3 className="text-[12px] font-black uppercase tracking-wide text-white leading-snug">
                  {theme.title}
                </h3>
              </div>
              <span
                className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border"
                style={{ borderColor: theme.accent, color: theme.accent }}
              >
                {theme.stocks.length}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-3 line-clamp-2">
              {theme.summary}
            </p>

            <div className="flex flex-wrap gap-1 mt-auto mb-3">
              {theme.stocks.map((s) => (
                <span
                  key={s.ticker}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/30 text-slate-300"
                >
                  {s.ticker}
                </span>
              ))}
            </div>

            <span
              className="text-[10px] font-black uppercase tracking-wider group-hover:underline"
              style={{ color: theme.accent }}
            >
              Takip Sayfasını Aç →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
