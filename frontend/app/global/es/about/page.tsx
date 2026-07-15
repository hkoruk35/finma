import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Acerca de BOGASTOCK - Blue One Global Analysis - Daily 6,000+ | Análisis del Mercado de Acciones de EE.UU. con IA",
  description: "BOGASTOCK - Blue One Global Analysis - Daily 6,000+ analiza diariamente más de 6,000 acciones y ETFs premier de EE.UU., identifica los mejores candidatos y entrega análisis financiero diario impulsado por IA sobre las oportunidades de mayor convicción en el mercado estadounidense.",
  alternates: {
    canonical: "https://bogastock.com/global/es/about",
    languages: {
      "en-US": "https://bogastock.com/global/en/about",
      "es-ES": "https://bogastock.com/global/es/about",
      "fr-FR": "https://bogastock.com/global/fr/about",
      "pt-PT": "https://bogastock.com/global/pt/about",
      "tr-TR": "https://bogastock.com/global/tr/about",
    },
  },
  openGraph: {
    title: "Acerca de BOGASTOCK - Blue One Global Analysis - Daily 6,000+ | Análisis del Mercado de Acciones de EE.UU. con IA",
    description: "BOGASTOCK - Blue One Global Analysis - Daily 6,000+ analiza diariamente más de 6,000 acciones y ETFs premier de EE.UU., identifica los mejores candidatos y entrega análisis financiero diario impulsado por IA sobre las oportunidades de mayor convicción en el mercado estadounidense.",
    url: "https://bogastock.com/global/es/about",
  },
};

export default function EsAboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <div className="flex justify-end mb-6">
          <Link href="/global/en/about" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Inteligencia del Mercado de Acciones de EE.UU.</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            Análisis Financiero Diario.<br />
            <span className="text-[#3b82f6]">Diseñado para los Mercados de EE.UU.</span>
          </h1>
          <p className="text-xl text-white max-w-2xl mx-auto leading-relaxed">
            BOGASTOCK - Blue One Global Analysis - Daily 6,000+ es un sistema propietario de selección y puntuación de acciones en múltiples etapas que convierte todo el universo bursátil estadounidense en una lista reducida de oportunidades de alta probabilidad — cada día de trading.
          </p>
        </div>

        {/* 3-Stage Process */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">Cómo Funciona el Sistema BOGASTOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6 text-2xl font-black">1</div>
              <h3 className="text-lg font-bold text-white mb-3">Escaneo Diario del Universo</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Cada día, el algoritmo de BOGASTOCK recorre <strong className="text-white">más de 6,000 acciones y ETFs premier de EE.UU.</strong> en todas las bolsas principales — NYSE, NASDAQ y AMEX — aplicando filtros de liquidez, volatilidad y estructura para aislar los candidatos más negociables.
              </p>
            </div>

            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6 text-2xl font-black">2</div>
              <h3 className="text-lg font-bold text-white mb-3">Lista de Seguimiento Diaria de +6,000</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Del escaneo diario, el sistema selecciona <strong className="text-white">más de 6,000 acciones y ETFs de alta prioridad</strong> para seguimiento diario. Estos candidatos se reevalúan cada mañana a las 09:00 hora de NY con datos de mercado frescos, lecturas técnicas y métricas fundamentales.
              </p>
            </div>

            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6 text-2xl font-black">3</div>
              <h3 className="text-lg font-bold text-white mb-3">Candidatos de Mayor Convicción — Puntuados Individualmente</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                El motor de puntuación de BOGASTOCK clasifica cada candidato diario y selecciona los setups de mayor convicción. Cada uno recibe un análisis único generado por IA que cubre técnicos, fundamentales y la justificación de la puntuación — no una plantilla, sino un informe específico para cada acción.
              </p>
            </div>
          </div>
        </div>

        {/* Scoring System */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">El Sistema de Puntuación BOGASTOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Motor Técnico Multi-Factor</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                La Puntuación Maestra de BOGASTOCK se calcula a partir de una combinación ponderada de indicadores técnicos — RSI, MACD, volumen relativo, cruces de EMA múltiples, fortaleza de tendencia ADX e intensidad de compresión de Bandas de Bollinger — diseñada específicamente para estructuras de impulso en renta variable estadounidense.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Superposición Fundamental y Sectorial</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Cada puntuación se cruza con datos fundamentales: ratio P/E frente a la mediana sectorial, rendimiento FCF, márgenes brutos y momentum de crecimiento de ingresos. El contexto de rendimiento sectorial garantiza que las puntuaciones sean siempre relativas — no absolutas — a las condiciones actuales del mercado.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Comentario IA Propietario</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Cada acción preseleccionada recibe un informe de análisis en lenguaje sencillo generado por el motor BOGASTOCK. El informe explica <em>por qué</em> se asignó una puntuación específica — haciendo referencia a los propios datos de la acción, no a genéricos — para que entiendas la justificación detrás de cada valoración.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Cinco Niveles de Puntuación</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Las puntuaciones de BOGASTOCK se clasifican en cinco niveles profesionales: <strong className="text-white">Alta Convicción</strong>, <strong className="text-white">Sesgo Positivo</strong>, <strong className="text-white">Neutral</strong>, <strong className="text-white">Sesgo Negativo</strong> y <strong className="text-white">Bajo Rendimiento</strong> — proporcionando claridad de grado institucional sin ambigüedad.
              </p>
            </div>
          </div>
        </div>

        {/* Focus Statement */}
        <div className="glass-card p-10 text-center mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] rounded-t-2xl"></div>
          <h2 className="text-2xl font-bold text-white mb-4">100% Enfocado en los Mercados de Renta Variable de EE.UU.</h2>
          <p className="text-white max-w-2xl mx-auto leading-relaxed mb-6">
            BOGASTOCK - Blue One Global Analysis - Daily 6,000+ está diseñado específicamente para el mercado de acciones de EE.UU. Cada algoritmo, cada peso y cada categoría de puntuación está calibrada frente a NYSE, NASDAQ y la estructura del mercado estadounidense — no es un modelo global genérico adaptado para EE.UU.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-bold uppercase tracking-widest">
            {["NYSE", "NASDAQ", "AMEX", "S&P 500", "NASDAQ 100", "Russell 2000"].map(ex => (
              <span key={ex} className="px-3 py-1.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded-full border border-[#3b82f6]/20">{ex}</span>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Nuestra Misión</h2>
          <p className="text-white max-w-2xl mx-auto italic leading-relaxed">
            "Hacemos que el poder analítico de los fondos institucionales y los profesionales sea accesible para cada inversor. A través de nuestra tecnología avanzada de selección y puntuación de mercado, identificar las oportunidades correctas en el mercado de acciones de EE.UU. ya no es una tarea compleja — es una rutina diaria."
          </p>
        </div>

      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
