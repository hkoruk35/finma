import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import type { FeaturedTrendStock } from "@/lib/homeFeed";
import { IndexStatTable } from "@/components/public/IndexStatTable";
import Sparkline from "@/components/global/Sparkline";
import TickerHoverChart from "@/components/TickerHoverChart";
import HomeFeaturedTrendCommentary from "@/components/global/HomeFeaturedTrendCommentary";
import { formatNumber } from "@/lib/formatNumber";

// Ana sayfada eski Nasdaq 100 sutununun yerine gecen kart. S&P 500 kartiyla
// (IndexHighlightCard, bkz. HomeIndexHighlights.tsx) AYNI gorsel yapiyi
// kullanir (baslik cubugu + Tam Analizi Gor + stat tablosu + ozet metni),
// boylece iki sutun ayni detay seviyesinde gorunur. Detay sayfasi (/dailyone)
// bu hisse icin GIRIS YAPMAMIS ziyaretciye de acik — bkz. DailyOneDetailContent.tsx.
const LABELS: Record<Locale, {
  title: string; linkLabel: string; latest: string; daily: string; weekly: string; monthly: string;
  yearly: string; fiveYear: string; entryZone: string; target: string; riskReward: string; whySelected: string;
  score: string;
}> = {
  tr: {
    title: "Günün Trend Hisselerinden", linkLabel: "Tam Analizi Gör", latest: "Güncel",
    daily: "Günlük Değişim", weekly: "Haftalık Değişim", monthly: "Aylık Değişim", yearly: "Yıllık Değişim",
    fiveYear: "5 Yıllık Değişim", entryZone: "Giriş Bölgesi", target: "Hedef Getiri", riskReward: "Risk/Ödül",
    whySelected: "Neden Seçildi", score: "AI Model Puanı",
  },
  en: {
    title: "Today's Trending Stock", linkLabel: "View Full Analysis", latest: "Latest",
    daily: "Daily Change", weekly: "Weekly Change", monthly: "Monthly Change", yearly: "Yearly Change",
    fiveYear: "5-Year Change", entryZone: "Entry Zone", target: "Target Gain", riskReward: "Risk/Reward",
    whySelected: "Why Selected", score: "AI Model Score",
  },
  es: {
    title: "Acción en Tendencia de Hoy", linkLabel: "Ver Análisis Completo", latest: "Más Reciente",
    daily: "Cambio Diario", weekly: "Cambio Semanal", monthly: "Cambio Mensual", yearly: "Cambio Anual",
    fiveYear: "Cambio a 5 Años", entryZone: "Zona de Entrada", target: "Ganancia Objetivo", riskReward: "Riesgo/Beneficio",
    whySelected: "Por Qué se Eligió", score: "Puntuación del Modelo AI",
  },
  fr: {
    title: "Action Tendance du Jour", linkLabel: "Voir l'Analyse Complète", latest: "Plus Récent",
    daily: "Variation Quotidienne", weekly: "Variation Hebdomadaire", monthly: "Variation Mensuelle", yearly: "Variation Annuelle",
    fiveYear: "Variation sur 5 Ans", entryZone: "Zone d'Entrée", target: "Gain Cible", riskReward: "Risque/Rendement",
    whySelected: "Pourquoi Ce Choix", score: "Score du Modèle IA",
  },
  pt: {
    title: "Ação em Tendência de Hoje", linkLabel: "Ver Análise Completa", latest: "Mais Recente",
    daily: "Variação Diária", weekly: "Variação Semanal", monthly: "Variação Mensal", yearly: "Variação Anual",
    fiveYear: "Variação em 5 Anos", entryZone: "Zona de Entrada", target: "Ganho Alvo", riskReward: "Risco/Retorno",
    whySelected: "Por Que Foi Selecionada", score: "Pontuação do Modelo IA",
  },
  id: {
    title: "Saham Tren Hari Ini", linkLabel: "Lihat Analisis Lengkap", latest: "Terbaru",
    daily: "Perubahan Harian", weekly: "Perubahan Mingguan", monthly: "Perubahan Bulanan", yearly: "Perubahan Tahunan",
    fiveYear: "Perubahan 5 Tahun", entryZone: "Zona Masuk", target: "Target Keuntungan", riskReward: "Risiko/Imbalan",
    whySelected: "Alasan Terpilih", score: "Skor Model AI",
  },
};

export default function HomeFeaturedTrendCard({ locale, data }: { locale: Locale; data: FeaturedTrendStock | null }) {
  if (!data) return null;
  const t = LABELS[locale] ?? LABELS.en;
  const detailHref = `/global/${locale}/dailyone?ticker=${data.ticker}`;
  // 2026-08-23 kullanıcı talebi: sparkline artık yeşil/kırmızı yön rengi
  // değil, sabit ve daha ince bir mavi ("biraz daha incelterek mavi yap").
  const sparklineColor = "#3b82f6";

  const periodItems = [
    { label: t.weekly, value: data.change_pct_1w },
    { label: t.monthly, value: data.change_pct_1m },
    { label: t.yearly, value: data.change_pct_1y },
    { label: t.fiveYear, value: data.change_pct_5y },
  ]
    .filter((it) => typeof it.value === "number")
    .map((it) => ({
      label: it.label,
      value: `${it.value! >= 0 ? "+" : ""}${formatNumber(it.value!, 2)}%`,
      positive: it.value! >= 0,
    }));

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a] rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0 bg-[#3b82f6]" />
          <h3 className="text-[16px] font-bold text-[#3b82f6] truncate">{t.title}</h3>
        </div>
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[#1e293b] border border-[#3b82f6]/30 text-[#3b82f6] rounded-full font-bold tracking-wide transition-all duration-200 hover:bg-white/5 shrink-0 whitespace-nowrap"
        >
          {t.linkLabel}
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <TickerHoverChart ticker={data.ticker} locale={locale}>
              <Link href={detailHref} className="text-xl font-black text-white hover:text-[#3b82f6] transition-colors">
                {data.ticker}
              </Link>
            </TickerHoverChart>
            {data.sector && <span className="text-xs font-bold text-white/50 truncate">{data.sector}</span>}
            <span className="text-[10px] bg-[#3b82f6]/20 text-[#3b82f6] px-2 py-0.5 rounded-full font-bold tracking-wide">
              {t.latest}
            </span>
          </div>
          <span className="text-sm font-mono font-bold shrink-0">
            {data.price > 0 ? `$${formatNumber(data.price, 2)}` : "—"}{" "}
            <span className={data.change_pct >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}>
              {data.change_pct >= 0 ? "+" : ""}
              {formatNumber(data.change_pct, 2)}%
            </span>
          </span>
        </div>

        {data.sparkline.length > 1 && (
          <div className="w-full h-24 mb-4 rounded-lg overflow-hidden border border-white/5 bg-black/20">
            <Sparkline data={data.sparkline} color={sparklineColor} changePct={data.change_pct} responsive fillOpacity={0.35} strokeWidth={1} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e2a3a] border border-white/10 text-xs">
            <span className="text-white/70">{t.score}:</span>
            <span className="font-bold text-white">{Math.round(data.score)}/100</span>
          </span>
          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/40 text-xs">
            <span className="text-white/70">{t.target}:</span>
            <span className="font-bold text-[#10b981]">
              {data.targetPct >= 0 ? "+" : ""}
              {formatNumber(data.targetPct, 1)}%
            </span>
          </span>
        </div>

        {periodItems.length > 0 && <IndexStatTable columns={2} items={periodItems} />}

        {data.selectionReasons.length > 0 && (
          <div className="mb-4">
            <p className="text-[13px] font-bold text-[#3b82f6] mb-2">{t.whySelected}</p>
            <ul className="space-y-1">
              {data.selectionReasons.slice(0, 4).map((reason, i) => (
                <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-1.5">
                  <span className="text-[#3b82f6] mt-0.5 shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 2026-08-23 kullanıcı talebi: SADECE "24/7 Yapay Zeka Grafik &
            Piyasa Yorumlayıcısı" başlığı altındaki metinler (özet + Kritik
            Seviyeler & Pivotlar + Hacim & Hareketlilik) — teknik gösterge
            kartları YOK, bkz. HomeFeaturedTrendCommentary.tsx. */}
        <HomeFeaturedTrendCommentary ticker={data.ticker} locale={locale} />
      </div>
    </div>
  );
}
