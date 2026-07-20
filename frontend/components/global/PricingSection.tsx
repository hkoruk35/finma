import Link from "next/link";

type Locale = "en" | "tr" | "es" | "fr" | "pt";

interface PricingContent {
  badge: string;
  title: string;
  subtitle: string;
  freeTrialLabel: string;
  freeTrialDays: string;
  firstMonthLabel: string;
  thenLabel: string;
  perMonth: string;
  features: string[];
  ctaText: string;
  ctaNote: string;
}

const CONTENT: Record<Locale, PricingContent> = {
  tr: {
    badge: "LANSMAN FİYATI",
    title: "Basit, Şeffaf Fiyatlandırma",
    subtitle: "Bugün ücretsiz başla, istediğin zaman iptal et.",
    freeTrialLabel: "İlk 7 gün",
    freeTrialDays: "Ücretsiz",
    firstMonthLabel: "İlk ay",
    thenLabel: "sonraki aylar",
    perMonth: "/ay",
    features: [
      "Sürekli güncellenen Swing Trade adayları — %90 üzeri başarı oranı",
      "Gelişmiş işlem bilgileri (giriş/hedef/stop, risk-getiri oranı)",
      "Uzun dönem yatırımlık hisse analizleri",
      "Top100'de trend olan hisselerin analizleri",
      "Gelişmiş interaktif Grafik sistemi",
      "Net ve gürültüsüz indikatör sistemleri ve net stratejiler",
      "6.000'den fazla hissenin anında analizi",
      "7/24 BOGA AI tarafından sürekli eğitilen kişiye özel Finansal Asistan",
    ],
    ctaText: "Bugün Ücretsiz Başla",
    ctaNote: "Kredi kartı gerekli · İlk 7 gün boyunca ücret alınmaz · İstediğin zaman iptal et",
  },
  en: {
    badge: "LAUNCH PRICING",
    title: "Simple, Transparent Pricing",
    subtitle: "Start free today, cancel anytime.",
    freeTrialLabel: "First 7 days",
    freeTrialDays: "Free",
    firstMonthLabel: "First month",
    thenLabel: "following months",
    perMonth: "/mo",
    features: [
      "Continuously updated Swing Trade candidates — 90%+ success rate",
      "Advanced trade intelligence (entry/target/stop, risk-reward ratio)",
      "Long-term investment stock analyses",
      "Trending stock analyses from the Top 100",
      "Advanced interactive charting system",
      "Clean, noise-free indicator systems and clear strategies",
      "Instant analysis of 6,000+ stocks",
      "A personal Financial Assistant, continuously trained by BOGA AI, available 24/7",
    ],
    ctaText: "Start Free Today",
    ctaNote: "Card required · Not charged during the first 7 days · Cancel anytime",
  },
  es: {
    badge: "PRECIO DE LANZAMIENTO",
    title: "Precios Simples y Transparentes",
    subtitle: "Empieza gratis hoy, cancela cuando quieras.",
    freeTrialLabel: "Primeros 7 días",
    freeTrialDays: "Gratis",
    firstMonthLabel: "Primer mes",
    thenLabel: "meses siguientes",
    perMonth: "/mes",
    features: [
      "Candidatos de Swing Trade actualizados constantemente — tasa de éxito superior al 90%",
      "Información avanzada de operaciones (entrada/objetivo/stop, ratio riesgo-beneficio)",
      "Análisis de acciones para inversión a largo plazo",
      "Análisis de las acciones en tendencia del Top 100",
      "Sistema de gráficos interactivo avanzado",
      "Sistemas de indicadores claros y sin ruido, con estrategias precisas",
      "Análisis instantáneo de más de 6.000 acciones",
      "Un Asistente Financiero personal, entrenado continuamente por BOGA AI, disponible 24/7",
    ],
    ctaText: "Empieza Gratis Hoy",
    ctaNote: "Tarjeta requerida · No se cobra durante los primeros 7 días · Cancela cuando quieras",
  },
  fr: {
    badge: "PRIX DE LANCEMENT",
    title: "Tarification Simple et Transparente",
    subtitle: "Commencez gratuitement aujourd'hui, annulez à tout moment.",
    freeTrialLabel: "7 premiers jours",
    freeTrialDays: "Gratuit",
    firstMonthLabel: "Premier mois",
    thenLabel: "mois suivants",
    perMonth: "/mois",
    features: [
      "Candidats Swing Trade mis à jour en continu — taux de réussite supérieur à 90 %",
      "Informations avancées sur les transactions (entrée/objectif/stop, ratio risque-rendement)",
      "Analyses d'actions pour l'investissement à long terme",
      "Analyses des actions tendance du Top 100",
      "Système de graphiques interactifs avancé",
      "Systèmes d'indicateurs clairs et sans bruit, avec des stratégies nettes",
      "Analyse instantanée de plus de 6 000 actions",
      "Un Assistant Financier personnel, formé en continu par BOGA AI, disponible 24h/24 et 7j/7",
    ],
    ctaText: "Commencer Gratuitement",
    ctaNote: "Carte requise · Non facturé pendant les 7 premiers jours · Annulez à tout moment",
  },
  pt: {
    badge: "PREÇO DE LANÇAMENTO",
    title: "Preços Simples e Transparentes",
    subtitle: "Comece grátis hoje, cancele quando quiser.",
    freeTrialLabel: "Primeiros 7 dias",
    freeTrialDays: "Grátis",
    firstMonthLabel: "Primeiro mês",
    thenLabel: "meses seguintes",
    perMonth: "/mês",
    features: [
      "Candidatos de Swing Trade atualizados continuamente — taxa de sucesso superior a 90%",
      "Informações avançadas de negociação (entrada/alvo/stop, relação risco-retorno)",
      "Análises de ações para investimento de longo prazo",
      "Análises das ações em tendência do Top 100",
      "Sistema de gráficos interativo avançado",
      "Sistemas de indicadores limpos e sem ruído, com estratégias claras",
      "Análise instantânea de mais de 6.000 ações",
      "Um Assistente Financeiro pessoal, treinado continuamente pela BOGA AI, disponível 24/7",
    ],
    ctaText: "Comece Grátis Hoje",
    ctaNote: "Cartão necessário · Sem cobrança nos primeiros 7 dias · Cancele quando quiser",
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
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#22c55e]">{c.badge}</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter mb-2">{c.title}</h2>
        <p className="text-sm text-white/40">{c.subtitle}</p>
      </div>

      <div className="max-w-xl mx-auto bg-gradient-to-b from-[#0d1117] to-[#0a0e17] border border-[#3b82f6]/30 rounded-3xl p-6 md:p-10 shadow-[0_0_60px_rgba(59,130,246,0.08)]">
        {/* Price Blocks */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-2xl px-3 py-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e]/70 mb-1">{c.freeTrialLabel}</div>
            <div className="text-xl md:text-2xl font-black text-[#22c55e]">{c.freeTrialDays}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">{c.firstMonthLabel}</div>
            <div className="text-xl md:text-2xl font-black text-white">
              $9<span className="text-xs font-semibold text-white/40">{c.perMonth}</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1 capitalize">{c.thenLabel}</div>
            <div className="text-xl md:text-2xl font-black text-white">
              $39<span className="text-xs font-semibold text-white/40">{c.perMonth}</span>
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
          className="block w-full text-center px-8 py-4 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]"
        >
          {c.ctaText}
        </Link>
        <p className="text-center text-[11px] text-white/30 mt-3">{c.ctaNote}</p>
      </div>
    </section>
  );
}
