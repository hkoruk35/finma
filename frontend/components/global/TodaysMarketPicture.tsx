import type { Locale } from "@/lib/i18n/copy";
import { buildTodaysMarketPicture, type SectorPerf } from "@/lib/marketPicture";

const LABEL: Record<Locale, string> = {
  en: "Today's market picture",
  tr: "Bugünün piyasa görünümü",
  es: "El panorama del mercado hoy",
  fr: "Le marché aujourd'hui",
  pt: "O panorama do mercado hoje",
  id: "Gambaran pasar hari ini",
};

export default function TodaysMarketPicture({
  locale,
  sectors,
  vixChangePct,
}: {
  locale: Locale;
  sectors: SectorPerf[];
  vixChangePct?: number | null;
}) {
  const text = buildTodaysMarketPicture(locale, sectors, vixChangePct);
  if (!text) return null;

  return (
    <div className="mt-4 rounded-xl bg-boga-card-secondary border border-boga-border px-4 py-3">
      <p className="text-[11px] font-medium text-boga-text-secondary">{LABEL[locale] ?? LABEL.en}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-boga-text-primary">{text}</p>
    </div>
  );
}
