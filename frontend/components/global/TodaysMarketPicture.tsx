import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n/copy";

const LABEL: Record<Locale, string> = {
  en: "Today's market picture",
  tr: "Bugünün piyasa görünümü",
  es: "El panorama del mercado hoy",
  fr: "Le marché aujourd'hui",
  pt: "O panorama do mercado hoje",
  id: "Gambaran pasar hari ini",
};

interface MarketPictureRow {
  texts: Partial<Record<Locale, string>>;
  generated_at: string;
}

async function getMarketPicture(): Promise<MarketPictureRow | null> {
  const { data } = await supabase.from("market_picture").select("texts, generated_at").eq("id", 1).maybeSingle();
  return (data as MarketPictureRow | null) ?? null;
}

export default async function TodaysMarketPicture({ locale }: { locale: Locale }) {
  const row = await getMarketPicture();
  const text = row?.texts?.[locale] ?? row?.texts?.en;
  if (!text) return null;

  return (
    <div className="mt-4 rounded-xl bg-boga-card-secondary border border-boga-border px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-1 h-4 rounded-full shrink-0 bg-[#FFFFFF]" />
        <h3 className="text-[16px] font-bold text-[#FFFFFF] tracking-tight">{LABEL[locale] ?? LABEL.en}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-boga-text-primary">{text}</p>
    </div>
  );
}
