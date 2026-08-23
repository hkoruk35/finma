import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { INDEX_DEFINITIONS, type IndexSymbol } from "@/lib/indices";
import { getLatestSnapshotPerSymbol, resolveNarrative } from "@/lib/indexSnapshots";
import { ClientTime } from "@/components/global/ClientTime";

// Ana sayfa sidebar'inin en altina, Sektorler kartinin altina: S&P 500 /
// Nasdaq 100 disindaki tum dunya endeksleri icin SADECE METIN (grafiksiz,
// istatistik tablosuz) SEO ozeti — her endeksin en son session'ina ait
// AI ozetinden (ayni kaynak, IndexDailySnapshotSection ile) tek paragraf,
// en yeni guncelleme en ustte, en fazla 10 kayit.
const OTHER_SYMBOLS: IndexSymbol[] = [
  "DJI", "RUT", "DAX", "FTSE100", "CAC40", "IBEX35", "STOXX600", "FTSEMIB", "SMI", "AEX",
  "NIKKEI225", "HANGSENG", "SHANGHAI", "KOSPI", "NIFTY50", "IHSG", "ASX200",
  "BOVESPA", "IPCMEXICO", "MERVAL",
];

const MAX_ITEMS = 10;

const STRINGS: Record<Locale, { title: string; readMore: string }> = {
  tr: { title: "Son Dünya Borsası Analizleri", readMore: "Devamı →" },
  en: { title: "Latest World Market Analyses", readMore: "Read More →" },
  es: { title: "Últimos Análisis de Mercados Mundiales", readMore: "Leer Más →" },
  fr: { title: "Dernières Analyses des Marchés Mondiaux", readMore: "Lire la Suite →" },
  pt: { title: "Últimas Análises dos Mercados Mundiais", readMore: "Ler Mais →" },
  id: { title: "Analisis Pasar Dunia Terbaru", readMore: "Baca Selengkapnya →" },
};

export default async function HomeIndexTextFeed({ locale }: { locale: Locale }) {
  const t = STRINGS[locale] ?? STRINGS.en;
  const snapshots = await getLatestSnapshotPerSymbol(OTHER_SYMBOLS);

  const items = snapshots
    .map((snapshot) => {
      const narrative = resolveNarrative(snapshot.ai_narrative, locale);
      if (!narrative?.summary) return null;
      const indexDef = INDEX_DEFINITIONS[snapshot.index_symbol];
      if (!indexDef) return null;
      return { snapshot, narrative, indexDef };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => new Date(b.snapshot.created_at).getTime() - new Date(a.snapshot.created_at).getTime())
    .slice(0, MAX_ITEMS);

  if (items.length === 0) return null;

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a] rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.15)]">
      <div className="flex items-center px-4 py-3 border-b border-[#1e2a3a]">
        <span className="w-1 h-4 rounded-full shrink-0 bg-[#3b82f6] mr-2" />
        <h3 className="text-[14px] font-bold text-[#3b82f6] truncate">{t.title}</h3>
      </div>

      <div className="divide-y divide-[#1e2a3a]/70">
        {items.map(({ snapshot, narrative, indexDef }) => (
          <div key={snapshot.index_symbol} className="p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500 font-medium mb-1">
              {/* Ana sayfada 4 farklı tarih formatı karışıyordu (2026-08-23 kullanıcı
                  geri bildirimi) — bu satır artık HomeIndexHighlights.tsx'teki "NY:"
                  satırıyla (yıl dahil DD.MM.YYYY HH:MM) aynı formatı kullanıyor. */}
              <span>NY: {new Intl.DateTimeFormat(locale, { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.created_at))}</span>
              <span className="opacity-40">·</span>
              <span>Local: <ClientTime timestamp={snapshot.created_at} lang={locale} /></span>
            </div>
            <Link
              href={`/global/${locale}/${indexDef.slug}`}
              className="text-[13px] font-bold text-[#3b82f6] hover:underline transition-colors"
            >
              {indexDef.names[locale]}
            </Link>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 mb-1.5 line-clamp-3">
              {narrative.summary}
            </p>
            <Link
              href={`/global/${locale}/${indexDef.slug}`}
              className="text-[10px] font-bold text-[#3b82f6] hover:underline"
            >
              {t.readMore}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
