import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import type { Locale } from "@/lib/i18n/copy";
import { INDEX_LOCALES } from "@/lib/indices";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return INDEX_LOCALES.map((locale) => ({ locale }));
}

const T: Record<Locale, { title: string; subtitle: string; cards: { title: string; desc: string; href: string }[] }> = {
  tr: {
    title: "News",
    subtitle: "BogaStock'un hisse, bilanço ve insider haber akışı — hepsi tek yerde.",
    cards: [
      { title: "Hisse Analizleri", desc: "Günlük ve haftalık AI destekli hisse analizleri, trend ve hacim sinyalleriyle.", href: "/news" },
      { title: "Bilançolar", desc: "Açıklanan çeyreklik bilançolar ve beklenti karşılaştırmaları.", href: "/earning" },
      { title: "Bilanço Takvimi", desc: "Yaklaşan bilanço açıklama tarihleri.", href: "/earning-calendar" },
      { title: "Insider Bilgileri", desc: "SEC Form 4 kayıtlarına dayalı yönetici/içeriden alım-satım hareketleri.", href: "/insider" },
    ],
  },
  en: {
    title: "News",
    subtitle: "BogaStock's stock, earnings and insider news feed — all in one place.",
    cards: [
      { title: "Stock Analyses", desc: "Daily and weekly AI-driven stock analyses with trend and volume signals.", href: "/news" },
      { title: "Earnings", desc: "Reported quarterly earnings and estimate comparisons.", href: "/earning" },
      { title: "Earnings Calendar", desc: "Upcoming earnings report dates.", href: "/earning-calendar" },
      { title: "Insider Activity", desc: "Executive/insider buy-sell activity based on SEC Form 4 filings.", href: "/insider" },
    ],
  },
  es: {
    title: "News",
    subtitle: "El feed de noticias de acciones, resultados e insiders de BogaStock — todo en un solo lugar.",
    cards: [
      { title: "Análisis de Acciones", desc: "Análisis diarios y semanales impulsados por IA con señales de tendencia y volumen.", href: "/news" },
      { title: "Resultados", desc: "Resultados trimestrales reportados y comparaciones con estimaciones.", href: "/earning" },
      { title: "Calendario de Resultados", desc: "Próximas fechas de publicación de resultados.", href: "/earning-calendar" },
      { title: "Actividad de Insiders", desc: "Actividad de compra-venta de ejecutivos basada en registros SEC Form 4.", href: "/insider" },
    ],
  },
  fr: {
    title: "News",
    subtitle: "Le fil d'actualité actions, résultats et initiés de BogaStock — tout au même endroit.",
    cards: [
      { title: "Analyses d'Actions", desc: "Analyses quotidiennes et hebdomadaires assistées par IA avec signaux de tendance et de volume.", href: "/news" },
      { title: "Résultats", desc: "Résultats trimestriels publiés et comparaisons avec les estimations.", href: "/earning" },
      { title: "Calendrier des Résultats", desc: "Prochaines dates de publication des résultats.", href: "/earning-calendar" },
      { title: "Activité des Initiés", desc: "Activité d'achat-vente des dirigeants basée sur les dépôts SEC Form 4.", href: "/insider" },
    ],
  },
  pt: {
    title: "News",
    subtitle: "O feed de notícias de ações, resultados e insiders da BogaStock — tudo em um só lugar.",
    cards: [
      { title: "Análises de Ações", desc: "Análises diárias e semanais com IA, com sinais de tendência e volume.", href: "/news" },
      { title: "Resultados", desc: "Resultados trimestrais divulgados e comparações com estimativas.", href: "/earning" },
      { title: "Calendário de Resultados", desc: "Próximas datas de divulgação de resultados.", href: "/earning-calendar" },
      { title: "Atividade de Insiders", desc: "Atividade de compra-venda de executivos com base em registros SEC Form 4.", href: "/insider" },
    ],
  },
  id: {
    title: "Berita",
    subtitle: "Feed berita saham, hasil keuangan, dan insider BogaStock — semuanya di satu tempat.",
    cards: [
      { title: "Analisis Saham", desc: "Analisis saham harian dan mingguan yang didukung AI dengan sinyal tren dan volume.", href: "/news" },
      { title: "Hasil Keuangan", desc: "Hasil keuangan kuartalan yang dilaporkan dan perbandingan estimasi.", href: "/earning" },
      { title: "Kalender Hasil Keuangan", desc: "Tanggal pengumuman hasil keuangan yang akan datang.", href: "/earning-calendar" },
      { title: "Aktivitas Insider", desc: "Aktivitas pembelian-penjualan eksekutif berdasarkan pengajuan SEC Form 4.", href: "/insider" },
    ],
  },
};

export default async function NewsroomPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = T[locale];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-6xl mx-auto w-full py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-slate-400">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {t.cards.map((card) => (
            <Link
              key={card.href}
              href={`/global/${locale}${card.href}`}
              className="block p-6 rounded-xl border border-[#1e2a3a] bg-[#0f172a] hover:border-[#3b82f6]/60 hover:bg-[#131c2e] transition-all"
            >
              <h2 className="text-lg font-semibold text-white mb-2">{card.title}</h2>
              <p className="text-sm text-slate-400">{card.desc}</p>
              <span className="inline-block mt-3 text-xs font-semibold text-[#3b82f6]">→</span>
            </Link>
          ))}
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
