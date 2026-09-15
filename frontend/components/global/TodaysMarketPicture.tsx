"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n/copy";
import type { BogaView, MarketPictureLocale } from "@/lib/marketBiasEngine";

const LABEL: Record<Locale, string> = {
  en: "Current Market Analysis",
  tr: "Güncel Piyasa Analizi",
  es: "Análisis de Mercado Actual",
  fr: "Analyse de Marché Actuelle",
  pt: "Análise de Mercado Atual",
  id: "Analisis Pasar Terkini",
};

const BOGA_VIEW_LABEL: Record<Locale, string> = {
  en: "BOGA View", tr: "BOGA Görüşü", es: "Visión BOGA", fr: "Avis BOGA", pt: "Visão BOGA", id: "Pandangan BOGA",
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
const UPDATED_LABEL: Record<Locale, string> = {
  en: "Updated", tr: "Güncellendi", es: "Actualizado", fr: "Mis à jour", pt: "Atualizado", id: "Diperbarui",
};
const DETAIL_LABEL: Record<Locale, string> = {
  en: "View", tr: "İncele", es: "Ver", fr: "Voir", pt: "Ver", id: "Lihat",
};

const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR", id: "id-ID" };

const BIAS_DOT: Record<BogaView["bias"], string> = {
  risk_on: "🟢", risk_off: "🔴", neutral: "🟡",
};

function formatUpdatedAt(iso: string, locale: Locale): string {
  return `${new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? "en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))} NY`;
}

// Metindeki $AAPL veya AAPL gibi ticker'ları tanı — kazananlar/kaybedenlerden gelen liste
const TICKER_RE = /\b([A-Z]{2,5})(?=\s|[.,;:!?]|$)/g;

interface TickerHoverCardProps {
  ticker: string;
  locale: Locale;
}

function TickerHoverCard({ ticker, locale }: TickerHoverCardProps) {
  const [open, setOpen] = useState(false);
  const detailPath = `/global/${locale}/graphic/${ticker}`;

  return (
    <span className="relative inline-block">
      <span
        className="cursor-pointer font-semibold text-[#60a5fa] underline decoration-dotted underline-offset-2 hover:text-[#93c5fd] transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {ticker}
      </span>
      {open && (
        <span
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-36 rounded-lg border border-[#1c2635] bg-[#0d1117] px-3 py-2 shadow-xl flex flex-col items-center gap-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <span className="text-[11px] font-bold text-slate-200">{ticker}</span>
          <a
            href={detailPath}
            className="w-full rounded bg-[#1c2635] px-2 py-1 text-center text-[10px] font-semibold text-[#60a5fa] hover:bg-[#263347] transition-colors"
          >
            {DETAIL_LABEL[locale] ?? DETAIL_LABEL.en} →
          </a>
        </span>
      )}
    </span>
  );
}

// Metin bloğunu parse et: ## Başlık satırları h3, ticker'lar hover karta dönüştür
function renderRichText(text: string, locale: Locale, knownTickers: Set<string>) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trimEnd();
    if (!line) {
      elements.push(<div key={`gap-${li}`} className="h-2" />);
      continue;
    }

    // Heading: ## ...
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={`h-${li}`} className="mt-4 mb-1 text-[13px] font-bold text-slate-100 first:mt-0">
          {line.slice(3)}
        </h3>
      );
      continue;
    }

    // Normal metin: ticker'ları bul ve hover kart yap
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(TICKER_RE.source, "g");
    while ((m = re.exec(line)) !== null) {
      const word = m[1];
      if (!knownTickers.has(word)) continue;
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(<TickerHoverCard key={`${li}-${m.index}`} ticker={word} locale={locale} />);
      last = m.index + word.length;
    }
    if (last < line.length) parts.push(line.slice(last));

    elements.push(
      <p key={`p-${li}`} className="text-[13px] leading-relaxed text-boga-text-primary">
        {parts}
      </p>
    );
  }

  return elements;
}

interface MarketPictureRow {
  texts: Partial<Record<Locale, string>>;
  boga_view: BogaView | null;
  generated_at: string;
  facts?: {
    topGainers?: { ticker: string }[];
    topLosers?: { ticker: string }[];
  };
}

// Client bileşeni: Supabase'den direkt oku (SSR cache sorununu önle)
export default function TodaysMarketPicture({ locale }: { locale: Locale }) {
  const [row, setRow] = useState<MarketPictureRow | null>(null);

  useEffect(() => {
    supabase
      .from("market_picture")
      .select("texts, boga_view, generated_at, facts")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setRow(data as MarketPictureRow | null));
  }, []);

  if (!row) return null;

  const text = row.texts?.[locale] ?? row.texts?.en;
  if (!text) return null;

  const view = row.boga_view ?? null;
  const viewLocale = locale as MarketPictureLocale;

  // Metinde geçebilecek bilinen ticker'lar — sadece bunları hover karta dönüştür
  const knownTickers = new Set<string>([
    ...(row.facts?.topGainers ?? []).map((g) => g.ticker),
    ...(row.facts?.topLosers ?? []).map((l) => l.ticker),
    // Endeks ve sektör ETF'leri hover'a dahil değil (bunlar stock değil)
  ].filter(Boolean));

  return (
    <div className="mt-4 rounded-xl bg-boga-card-secondary border border-boga-border px-4 py-3.5">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0 bg-[#FFFFFF]" />
          <h3 className="text-[16px] font-bold text-[#FFFFFF] tracking-tight">{LABEL[locale] ?? LABEL.en}</h3>
        </div>
        <span className="text-[10px] text-boga-text-secondary shrink-0">
          {UPDATED_LABEL[locale] ?? UPDATED_LABEL.en}: {formatUpdatedAt(row.generated_at, locale)}
        </span>
      </div>

      <div className="space-y-0.5">
        {renderRichText(text, locale, knownTickers)}
      </div>

      {view && (
        <div className="mt-4 pt-3 border-t border-boga-border/70">
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
              <div className="h-full rounded-full bg-[#FFFFFF]" style={{ width: `${Math.max(0, Math.min(100, view.confidence))}%` }} />
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
