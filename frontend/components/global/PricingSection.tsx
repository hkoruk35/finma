import Link from "next/link";

type Locale = "en" | "tr" | "es" | "fr" | "pt" | "id";

interface PricingContent {
  badge: string;
  title: string;
  subtitle: string;
  firstMonthLabel: string;
  thenLabel: string;
  perMonth: string;
  features: string[];
  ctaText: string;
  ctaNote: string;
}

const CONTENT: Record<Locale, PricingContent> = {
  tr: {
    badge: "LANSMAN FÄ°YATI",
    title: "Basit, Åžeffaf FiyatlandÄ±rma",
    subtitle: "Ä°lk ayÄ±n indirimli, istediÄŸin zaman iptal et.",
    firstMonthLabel: "Ä°lk ay",
    thenLabel: "sonraki aylar",
    perMonth: "/ay",
    features: [
      "SÃ¼rekli gÃ¼ncellenen Trend Hisseleri adaylarÄ± â€” %90 Ã¼zeri baÅŸarÄ± oranÄ±",
      "GeliÅŸmiÅŸ iÅŸlem bilgileri (giriÅŸ/hedef/stop, risk-getiri oranÄ±)",
      "Uzun dÃ¶nem yatÄ±rÄ±mlÄ±k hisse analizleri",
      "Top100'de trend olan hisselerin analizleri",
      "GeliÅŸmiÅŸ interaktif Grafik sistemi",
      "Net ve gÃ¼rÃ¼ltÃ¼sÃ¼z indikatÃ¶r sistemleri ve net stratejiler",
      "6.000'den fazla hissenin anÄ±nda analizi",
      "7/24 BOGA AI tarafÄ±ndan sÃ¼rekli eÄŸitilen kiÅŸiye Ã¶zel Finansal Asistan",
    ],
    ctaText: "Hemen BaÅŸla",
    ctaNote: "Kredi kartÄ± gerekli Â· Ã–deme kayÄ±t anÄ±nda alÄ±nÄ±r Â· Ä°stediÄŸin zaman iptal et",
  },
  en: {
    badge: "LAUNCH PRICING",
    title: "Simple, Transparent Pricing",
    subtitle: "First month discounted, cancel anytime.",
    firstMonthLabel: "First month",
    thenLabel: "following months",
    perMonth: "/mo",
    features: [
      "Continuously updated Trending Stocks candidates â€” 90%+ success rate",
      "Advanced trade intelligence (entry/target/stop, risk-reward ratio)",
      "Long-term investment stock analyses",
      "Trending stock analyses from the Top 100",
      "Advanced interactive charting system",
      "Clean, noise-free indicator systems and clear strategies",
      "Instant analysis of 6,000+ stocks",
      "A personal Financial Assistant, continuously trained by BOGA AI, available 24/7",
    ],
    ctaText: "Get Started Today",
    ctaNote: "Card required Â· Billed immediately at signup Â· Cancel anytime",
  },
  es: {
    badge: "PRECIO DE LANZAMIENTO",
    title: "Precios Simples y Transparentes",
    subtitle: "Primer mes con descuento, cancela cuando quieras.",
    firstMonthLabel: "Primer mes",
    thenLabel: "meses siguientes",
    perMonth: "/mes",
    features: [
      "Candidatos de Acciones en Tendencia actualizados constantemente â€” tasa de Ã©xito superior al 90%",
      "InformaciÃ³n avanzada de operaciones (entrada/objetivo/stop, ratio riesgo-beneficio)",
      "AnÃ¡lisis de acciones para inversiÃ³n a largo plazo",
      "AnÃ¡lisis de las acciones en tendencia del Top 100",
      "Sistema de grÃ¡ficos interactivo avanzado",
      "Sistemas de indicadores claros y sin ruido, con estrategias precisas",
      "AnÃ¡lisis instantÃ¡neo de mÃ¡s de 6.000 acciones",
      "Un Asistente Financiero personal, entrenado continuamente por BOGA AI, disponible 24/7",
    ],
    ctaText: "Comienza Hoy",
    ctaNote: "Tarjeta requerida Â· Se cobra de inmediato al registrarte Â· Cancela cuando quieras",
  },
  fr: {
    badge: "PRIX DE LANCEMENT",
    title: "Tarification Simple et Transparente",
    subtitle: "Premier mois Ã  prix rÃ©duit, annulez Ã  tout moment.",
    firstMonthLabel: "Premier mois",
    thenLabel: "mois suivants",
    perMonth: "/mois",
    features: [
      "Candidats Actions Tendance mis Ã  jour en continu â€” taux de rÃ©ussite supÃ©rieur Ã  90 %",
      "Informations avancÃ©es sur les transactions (entrÃ©e/objectif/stop, ratio risque-rendement)",
      "Analyses d'actions pour l'investissement Ã  long terme",
      "Analyses des actions tendance du Top 100",
      "SystÃ¨me de graphiques interactifs avancÃ©",
      "SystÃ¨mes d'indicateurs clairs et sans bruit, avec des stratÃ©gies nettes",
      "Analyse instantanÃ©e de plus de 6 000 actions",
      "Un Assistant Financier personnel, formÃ© en continu par BOGA AI, disponible 24h/24 et 7j/7",
    ],
    ctaText: "Commencer Maintenant",
    ctaNote: "Carte requise Â· FacturÃ© immÃ©diatement Ã  l'inscription Â· Annulez Ã  tout moment",
  },
  pt: {
    badge: "PREÃ‡O DE LANÃ‡AMENTO",
    title: "PreÃ§os Simples e Transparentes",
    subtitle: "Primeiro mÃªs com desconto, cancele quando quiser.",
    firstMonthLabel: "Primeiro mÃªs",
    thenLabel: "meses seguintes",
    perMonth: "/mÃªs",
    features: [
      "Candidatos de AÃ§Ãµes em TendÃªncia atualizados continuamente â€” taxa de sucesso superior a 90%",
      "InformaÃ§Ãµes avanÃ§adas de negociaÃ§Ã£o (entrada/alvo/stop, relaÃ§Ã£o risco-retorno)",
      "AnÃ¡lises de aÃ§Ãµes para investimento de longo prazo",
      "AnÃ¡lises das aÃ§Ãµes em tendÃªncia do Top 100",
      "Sistema de grÃ¡ficos interativo avanÃ§ado",
      "Sistemas de indicadores limpos e sem ruÃ­do, com estratÃ©gias claras",
      "AnÃ¡lise instantÃ¢nea de mais de 6.000 aÃ§Ãµes",
      "Um Assistente Financeiro pessoal, treinado continuamente pela BOGA AI, disponÃ­vel 24/7",
    ],
    ctaText: "Comece Agora",
    ctaNote: "CartÃ£o necessÃ¡rio Â· CobranÃ§a imediata no cadastro Â· Cancele quando quiser",
  },
  id: {
    badge: "HARGA PELUNCURAN",
    title: "Harga Sederhana dan Transparan",
    subtitle: "Bulan pertama diskon, batalkan kapan saja.",
    firstMonthLabel: "Bulan pertama",
    thenLabel: "bulan berikutnya",
    perMonth: "/bln",
    features: [
      "Kandidat Saham Tren yang terus diperbarui — tingkat keberhasilan di atas 90%",
      "Informasi perdagangan lanjutan (entry/target/stop, rasio risiko-imbalan)",
      "Analisis saham untuk investasi jangka panjang",
      "Analisis saham tren dari Top 100",
      "Sistem grafik interaktif tingkat lanjut",
      "Sistem indikator yang bersih tanpa gangguan dengan strategi yang jelas",
      "Analisis instan untuk lebih dari 6.000 saham",
      "Asisten Keuangan pribadi, dilatih terus-menerus oleh BOGA AI, tersedia 24/7",
    ],
    ctaText: "Mulai Sekarang",
    ctaNote: "Kartu diperlukan Â· Ditagih langsung saat mendaftar Â· Batalkan kapan saja",
  },
};

const CheckIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export default function PricingSection({ locale, ctaHref }: { locale: Locale; ctaHref: string }) {
  const c = CONTENT[locale] ?? CONTENT.en;

  return (
    <section id="pricing" className="max-w-5xl mx-auto px-4 pb-20 scroll-mt-20">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-full px-4 py-1.5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#22c55e]">{c.badge}</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-medium text-white tracking-tighter mb-2">{c.title}</h2>
        <p className="text-sm text-white/40">{c.subtitle}</p>
      </div>

      <div className="max-w-xl mx-auto bg-gradient-to-b from-[#0d1117] to-[#0a0e17] border border-[#3b82f6]/30 rounded-3xl p-6 md:p-10 shadow-[0_0_60px_rgba(59,130,246,0.08)]">
        {/* Price Blocks */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-2xl px-3 py-4 text-center">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#22c55e]/70 mb-1">{c.firstMonthLabel}</div>
            <div className="text-xl md:text-2xl font-medium text-[#22c55e]">
              $9<span className="text-xs font-medium text-[#22c55e]/70">{c.perMonth}</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-4 text-center">
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1 capitalize">{c.thenLabel}</div>
            <div className="text-xl md:text-2xl font-medium text-white">
              $39<span className="text-xs font-medium text-white/40">{c.perMonth}</span>
            </div>
          </div>
        </div>

        {/* Feature List */}
        <ul className="space-y-3 mb-8">
          {c.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckIcon />
              <span className="text-sm text-white/70 leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href={ctaHref}
          className="block w-full text-center px-8 py-4 bg-[#3b82f6] text-white rounded-2xl font-medium uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]"
        >
          {c.ctaText}
        </Link>
        <p className="text-center text-[11px] text-white/30 mt-3">{c.ctaNote}</p>
      </div>
    </section>
  );
}

