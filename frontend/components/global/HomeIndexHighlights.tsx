import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { INDEX_DEFINITIONS, type IndexSymbol } from "@/lib/indices";
import {
  getLatestDailySnapshots,
  resolveNarrative,
  type IndexDailySnapshot,
} from "@/lib/indexSnapshots";
import { getMultiQuote } from "@/lib/homeFeed";
import { IndexStatTable } from "@/components/public/IndexStatTable";
import TickerHoverChart from "@/components/TickerHoverChart";
import { formatNumber } from "@/lib/formatNumber";
import { ClientTime } from "@/components/global/ClientTime";

// Ana sayfada iki sütun: S&P 500 (sol) + Nasdaq 100 (sağ). İçerik ve etiketler
// /global/[locale]/[indexSlug] sayfasıyla (bkz. IndexDailySnapshotSection.tsx)
// aynı kaynaktan (index_daily_snapshot, copy.ts:indices) geliyor — tekrar
// yazılmıyor, sadece grafik ve Yükseliş/Nötr/Risk senaryo kartları çıkarılmış
// halde tekrar kullanılıyor (grafiksiz + SEO metni ağırlıklı ana sayfa özeti).
const HIGHLIGHT_SYMBOLS: IndexSymbol[] = ["SPX", "NDX"];

const LINK_LABEL: Record<Locale, string> = {
  tr: "Tam Analizi Gör",
  en: "View Full Analysis",
  es: "Ver Análisis Completo",
  fr: "Voir l'Analyse Complète",
  pt: "Ver Análise Completa",
  id: "Lihat Analisis Lengkap",
};

const LATEST_LABEL: Record<Locale, string> = {
  tr: "En Güncel", en: "Latest", es: "Más Reciente", fr: "Plus Récent", pt: "Mais Recente", id: "Terbaru",
};

function getT(locale: Locale) {
  return copy[locale].indices;
}

function sessionLabel(session: IndexDailySnapshot["session"], t: ReturnType<typeof getT>) {
  if (session === "premarket") return t.sessionPremarket;
  if (session === "midday") return t.sessionMidday;
  return t.sessionClosing;
}

type Mover = { ticker: string; name?: string; price?: number; change_pct?: number };

async function buildColumn(symbol: IndexSymbol, locale: Locale) {
  const snapshots = await getLatestDailySnapshots(symbol);
  const latest = snapshots[snapshots.length - 1] ?? null;
  if (!latest) return null;
  return { symbol, snapshot: latest };
}

export default async function HomeIndexHighlights({ locale }: { locale: Locale }) {
  const columns = await Promise.all(HIGHLIGHT_SYMBOLS.map((sym) => buildColumn(sym, locale)));
  const quotes = await getMultiQuote(HIGHLIGHT_SYMBOLS);
  const visible = columns.filter((c): c is NonNullable<typeof c> => c !== null);

  if (visible.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
      {visible.map(({ symbol, snapshot }) => (
        <IndexHighlightCard
          key={symbol}
          symbol={symbol}
          snapshot={snapshot}
          locale={locale}
          liveQuote={quotes[symbol]}
        />
      ))}
    </div>
  );
}

function IndexHighlightCard({
  symbol,
  snapshot,
  locale,
  liveQuote,
}: {
  symbol: IndexSymbol;
  snapshot: IndexDailySnapshot;
  locale: Locale;
  liveQuote?: { value: number; change_pct: number };
}) {
  const t = getT(locale);
  const indexDef = INDEX_DEFINITIONS[symbol];
  const name = indexDef.names[locale];
  const narrative = resolveNarrative(snapshot.ai_narrative, locale);
  const sectorLeaders =
    snapshot.sector_leaders && Array.isArray(snapshot.sector_leaders)
      ? (snapshot.sector_leaders as { sector?: string; name?: string; ticker?: string; change_pct?: number }[])
      : null;
  const qs = snapshot.quant_snapshot as Record<string, unknown> | null;
  const topGainers = Array.isArray(qs?.top_gainers) ? (qs!.top_gainers as Mover[]) : [];
  const topLosers = Array.isArray(qs?.top_losers) ? (qs!.top_losers as Mover[]) : [];

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a] rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0 bg-[#3b82f6]" />
          <h3 className="text-[16px] font-bold text-[#3b82f6] truncate">
            {name} — {t.dailyAnalysis}
          </h3>
        </div>
        <Link
          href={`/global/${locale}/${indexDef.slug}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[#1e293b] border border-[#3b82f6]/30 text-[#3b82f6] rounded-full font-bold tracking-wide transition-all duration-200 hover:bg-white/5 shrink-0 whitespace-nowrap"
        >
          {LINK_LABEL[locale]}
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white/70 tracking-wide">
              {t.session}: {sessionLabel(snapshot.session, t)}
            </span>
            <span className="text-[10px] bg-[#3b82f6]/20 text-[#3b82f6] px-2 py-0.5 rounded-full font-bold tracking-wide">
              {LATEST_LABEL[locale]}
            </span>
          </div>
          {liveQuote && (
            <span className="text-sm font-mono font-bold">
              {formatNumber(liveQuote.value, 2)}{" "}
              <span className={liveQuote.change_pct >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}>
                {liveQuote.change_pct >= 0 ? "+" : ""}
                {formatNumber(liveQuote.change_pct, 2)}%
              </span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-medium mb-4">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-[#00d2ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>NY: {new Intl.DateTimeFormat(locale, { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.created_at))}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-[#38bdf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Local: <ClientTime timestamp={snapshot.created_at} lang={locale} /></span>
          </div>
        </div>

        <IndexStatTable
          columns={2}
          items={[
            { label: t.close, value: formatNumber(snapshot.close, 2) ?? "—" },
            {
              label: t.change,
              value: snapshot.change_pct != null ? `${formatNumber(snapshot.change_pct, 2)}%` : "—",
              positive: snapshot.change_pct != null ? snapshot.change_pct >= 0 : undefined,
            },
            {
              label: t.change1w,
              value: snapshot.change_pct_1w != null ? `${formatNumber(snapshot.change_pct_1w, 2)}%` : "—",
              positive: snapshot.change_pct_1w != null ? snapshot.change_pct_1w >= 0 : undefined,
            },
            {
              label: t.change20d,
              value: snapshot.change_pct_20d != null ? `${formatNumber(snapshot.change_pct_20d, 2)}%` : "—",
              positive: snapshot.change_pct_20d != null ? snapshot.change_pct_20d >= 0 : undefined,
            },
            { label: "EMA20", value: formatNumber(snapshot.ema20, 2) ?? "—" },
            { label: "EMA50", value: formatNumber(snapshot.ema50, 2) ?? "—" },
            { label: "EMA200", value: formatNumber(snapshot.ema200, 2) ?? "—" },
            { label: t.rsi, value: formatNumber(snapshot.rsi14, 1) ?? "—" },
            { label: t.atr, value: formatNumber(snapshot.atr14, 2) ?? "—" },
            {
              label: t.volatility,
              value: snapshot.volatility_20d != null ? `${formatNumber(snapshot.volatility_20d, 2)}%` : "—",
            },
            {
              label: t.distanceFrom20dHigh,
              value:
                snapshot.distance_from_20d_high_pct != null
                  ? `${formatNumber(snapshot.distance_from_20d_high_pct, 2)}%`
                  : "—",
              positive:
                snapshot.distance_from_20d_high_pct != null ? snapshot.distance_from_20d_high_pct >= 0 : undefined,
            },
            { label: t.advancers, value: snapshot.advancers?.toString() ?? "—", positive: snapshot.advancers != null ? true : undefined },
            { label: t.decliners, value: snapshot.decliners?.toString() ?? "—", positive: snapshot.decliners != null ? false : undefined },
            { label: t.volume, value: snapshot.volume != null ? formatNumber(snapshot.volume, 0) : "—" },
          ]}
        />

        <IndexStatTable
          columns={3}
          items={[
            { label: "VIX", value: formatNumber(snapshot.vix, 2) ?? "—" },
            { label: "US10Y", value: snapshot.us10y != null ? `${formatNumber(snapshot.us10y, 2)}%` : "—" },
            { label: "DXY", value: formatNumber(snapshot.dxy, 2) ?? "—" },
          ]}
        />

        {sectorLeaders && sectorLeaders.length > 0 && (
          <div className="mb-4">
            <p className="text-[13px] font-bold text-[#3b82f6] mb-2">{t.sectorLeaders}</p>
            <div className="flex flex-wrap gap-2">
              {sectorLeaders.map((leader, i) => (
                <span
                  key={`${leader.sector ?? leader.ticker ?? leader.name ?? i}`}
                  className="px-2.5 py-1 rounded-md bg-[#141924] border border-[#1e2a3a] text-xs text-slate-300"
                >
                  {leader.ticker ? (
                    <TickerHoverChart ticker={leader.ticker} locale={locale}>
                      <Link
                        href={`/global/${locale}/analysis/${leader.ticker}`}
                        className="hover:text-[#00d2ff] transition-colors"
                      >
                        {leader.sector || leader.name || leader.ticker}
                      </Link>
                    </TickerHoverChart>
                  ) : (
                    leader.sector || leader.name || leader.ticker
                  )}
                  {leader.change_pct != null ? (
                    <span className={leader.change_pct >= 0 ? "!text-[#3fb950]" : "!text-[#f85149]"}>
                      {" "}
                      {leader.change_pct >= 0 ? "+" : ""}
                      {formatNumber(leader.change_pct, 2)}%
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}

        {(topGainers.length > 0 || topLosers.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {topGainers.length > 0 && <HighlightMoverList title={t.topGainers} movers={topGainers} locale={locale} />}
            {topLosers.length > 0 && <HighlightMoverList title={t.topLosers} movers={topLosers} locale={locale} />}
          </div>
        )}

        {narrative && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300 leading-relaxed">{narrative.summary}</p>
            <HighlightNarrativeRow label={t.narrativeMarketDrivers} text={narrative.market_drivers} />
            <HighlightNarrativeRow label={t.narrativeTrendInterpretation} text={narrative.trend_interpretation} />
            <HighlightNarrativeRow label={t.narrativeRiskFactors} text={narrative.risk_factors} />
            {/* Yükseliş/Nötr/Risk senaryo kartları burada BİLİNÇLİ OLARAK yok —
                ana sayfa özetinde kullanılmıyor, tam analiz sayfasında kalıyor. */}
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightMoverList({ title, movers, locale }: { title: string; movers: Mover[]; locale: Locale }) {
  return (
    <div className="rounded-lg bg-[#141924] border border-[#1e2a3a] p-3">
      <p className="text-[13px] font-bold text-[#3b82f6] mb-2">{title}</p>
      <div className="divide-y divide-[#1e2a3a]">
        {movers.map((m) => (
          <div key={m.ticker} className="flex items-center justify-between py-1.5 text-sm">
            <span className="font-semibold text-slate-200">
              <TickerHoverChart ticker={m.ticker} locale={locale}>
                <Link href={`/global/${locale}/analysis/${m.ticker}`} className="hover:text-[#3b82f6] transition-colors">
                  {m.name || m.ticker}
                </Link>
              </TickerHoverChart>
            </span>
            <span className="flex items-center gap-2 font-mono">
              {m.price != null ? <span className="text-slate-400">{formatNumber(m.price, 2)}</span> : null}
              {m.change_pct != null ? (
                <span className={m.change_pct >= 0 ? "!text-[#3fb950]" : "!text-[#f85149]"}>
                  {m.change_pct >= 0 ? "+" : ""}
                  {formatNumber(m.change_pct, 2)}%
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightNarrativeRow({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-[13px] font-bold text-[#3b82f6] mb-1">{label}</p>
      <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}
