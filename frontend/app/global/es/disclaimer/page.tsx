import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export default function DisclaimerPageEs() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Avisos Legales, Cumplimiento Normativo y Exención de Responsabilidad</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Plataforma de Análisis Técnico y Soporte de Decisiones (No es Asesoramiento de Inversión)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> es una plataforma automatizada de <strong className="text-white">análisis técnico y soporte para la toma de decisiones</strong> impulsada por modelos cuantitativos e inteligencia artificial. Nuestro sistema escanea los mercados financieros globales para detectar oportunidades técnicas y proporcionar datos analíticos de apoyo.
            </p>
            <p className="text-slate-300">
              Todo el contenido, gráficos, puntuaciones de IA e indicadores ofrecidos en BogaStock.com tienen fines estrictamente informativos y educativos. BogaStock.com no es un Asesor de Inversiones Registrado (RIA) ni corredor de bolsa, ni proporciona asesoramiento financiero personalizado o gestión de carteras. Consulte siempre a un asesor financiero autorizado antes de tomar decisiones de inversión.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Cobertura de Mercados Globales y Advertencia de Riesgo
            </h2>
            <p className="mb-4 text-slate-300">
              Operar en los mercados bursátiles internacionales — incluidos <strong className="text-white">EE. UU. (NYSE, NASDAQ, S&P 500, Dow, Russell 2000)</strong>, <strong className="text-white">Mercados Europeos (DAX, FTSE 100, CAC40, IBEX35, STOXX50)</strong>, <strong className="text-white">Mercados Asiáticos (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> y <strong className="text-white">Mercados de América Latina (S&P Latam 40, S&P Latam BMI, IBOVESPA, IGCX, IBXX)</strong>, así como Divisas (Forex), Materias Primas y Criptomonedas — implica un alto nivel de volatilidad y riesgo de pérdida de capital.
            </p>
            <p className="text-slate-300">
              El rendimiento pasado y los modelos algorítmicos no garantizan resultados futuros. Todas las decisiones comerciales tomadas con base en la información de BogaStock.com son responsabilidad exclusiva del usuario.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Leyes de la Unión Europea (UE) y Cumplimiento Normativo
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> opera de conformidad con las normativas financieras de la Unión Europea (UE), incluidas las directrices de la <strong className="text-white">ESMA (Autoridad Europea de Valores y Mercados)</strong>, la directiva <strong className="text-white">MiFID II</strong> y el reglamento <strong className="text-white">MAR (Reglamento sobre el Abuso de Mercado de la UE No 596/2014)</strong>.
            </p>
            <p className="text-slate-300">
              Nuestra plataforma no realiza manipulación de mercado, uso de información privilegiada ni asesoramiento no autorizado. Todos los escaneos algorítmicos se ejecutan según parámetros objetivos y programáticos.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Privacidad de Datos (RGPD / GDPR y CCPA)
            </h2>
            <p className="text-slate-300">
              Garantizamos la privacidad de los datos de acuerdo con el Reglamento General de Protección de Datos de la UE (<strong className="text-white">RGPD / GDPR</strong>) y la <strong className="text-white">CCPA</strong>. No vendemos ni alquilamos datos personales a terceros.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Independencia y Objetividad
            </h2>
            <p className="text-slate-300">
              Los anuncios o patrocinadores de terceros en <strong className="text-white">BogaStock.com</strong> no tienen ninguna influencia sobre nuestros algoritmos de IA ni sobre los resultados de análisis técnico.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Declaración del Usuario</h2>
            <p className="text-xs text-slate-400">
              Al utilizar BogaStock.com, usted acepta que ha leído y comprendido todos los avisos legales y condiciones normativas europeas e internacionales descritas anteriormente.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Última actualización: 4 de agosto de 2026 | BogaStock.com Plataforma de Análisis Técnico y Soporte de Decisiones
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
