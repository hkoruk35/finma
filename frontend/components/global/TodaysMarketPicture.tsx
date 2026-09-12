import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n/copy";
import type { BogaView, MarketPictureLocale } from "@/lib/marketBiasEngine";

const LABEL: Record<Locale, string> = {
  en: "BOGA Market Read",
  tr: "BOGA Piyasa Yorumu",
  es: "Lectura de Mercado BOGA",
  fr: "Lecture de Marché BOGA",
  pt: "Leitura de Mercado BOGA",
  id: "Pembacaan Pasar BOGA",
};

const BOGA_VIEW_LABEL: Record<Locale, string> = {
  en: "BOGA View",
  tr: "BOGA Görüşü",
  es: "Visión BOGA",
  fr: "Avis BOGA",
  pt: "Visão BOGA",
  id: "Pandangan BOGA",
};

const CONFIDENCE_LABEL: Record<Locale, string> = {
  en: "Confidence", tr: "Güven", es: "Confianza", fr: "Confiance", pt: "Confiança", id: "Keyakinan",
};
const CONFIRMATION_LABEL: Record<Locale, string> = {
  en: "Key confirmation", tr: "Ana teyit", es: "Confirmación clave", fr: "Confirmation clé", pt: "Confirmação chave", id: "Konfirmasi utama",
};
const RISK_LABEL: Record<Locale, string> = {
  en: "Risk to this view", tr: "Bu görüşe karşı risk", es: "Riesgo para esta visión", fr: "Risque pour cette lecture", pt: "Risco para esta visão", id: "Risiko terhadap pandangan ini",
};

const BIAS_DOT: Record<BogaView["bias"], string> = {
  risk_on: "🟢",
  risk_off: "🔴",
  neutral: "🟡",
};

interface MarketPictureRow {
  texts: Partial<Record<Locale, string>>;
  boga_view: BogaView | null;
  generated_at: string;
}

async function getMarketPicture(): Promise<MarketPictureRow | null> {
  const { data } = await supabase.from("market_picture").select("texts, boga_view, generated_at").eq("id", 1).maybeSingle();
  return (data as MarketPictureRow | null) ?? null;
}

export default async function TodaysMarketPicture({ locale }: { locale: Locale }) {
  const row = await getMarketPicture();
  const text = row?.texts?.[locale] ?? row?.texts?.en;
  if (!text) return null;

  const view = row?.boga_view ?? null;
  const viewLocale = locale as MarketPictureLocale;

  return (
    <div className="mt-4 rounded-xl bg-boga-card-secondary border border-boga-border px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-4 rounded-full shrink-0 bg-[#FFFFFF]" />
        <h3 className="text-[16px] font-bold text-[#FFFFFF] tracking-tight">{LABEL[locale] ?? LABEL.en}</h3>
      </div>

      <div className="text-[13px] leading-relaxed text-boga-text-primary space-y-2 whitespace-pre-line">{text}</div>

      {view && (
        <div className="mt-3 pt-3 border-t border-boga-border/70">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-boga-text-secondary">
              {BOGA_VIEW_LABEL[locale] ?? BOGA_VIEW_LABEL.en}
            </span>
            <span className="text-[13px] font-bold text-boga-text-primary">
              {BIAS_DOT[view.bias]} {view.biasLabel[viewLocale] ?? view.biasLabel.en}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-boga-text-secondary shrink-0 w-20">{CONFIDENCE_LABEL[locale] ?? CONFIDENCE_LABEL.en}</span>
            <div className="flex-1 h-1.5 rounded-full bg-boga-border overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FFFFFF]"
                style={{ width: `${Math.max(0, Math.min(100, view.confidence))}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-boga-text-primary shrink-0">{view.confidence}/100</span>
          </div>

          <p className="text-[11px] text-boga-text-secondary">
            <span className="font-medium text-boga-text-primary">{CONFIRMATION_LABEL[locale] ?? CONFIRMATION_LABEL.en}: </span>
            {view.confirmation[viewLocale] ?? view.confirmation.en}
          </p>
          <p className="text-[11px] text-boga-text-secondary mt-0.5">
            <span className="font-medium text-boga-text-primary">{RISK_LABEL[locale] ?? RISK_LABEL.en}: </span>
            {view.risk[viewLocale] ?? view.risk.en}
          </p>
        </div>
      )}
    </div>
  );
}
