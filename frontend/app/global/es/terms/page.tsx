import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "https://bogastock.com/global/es/terms", languages: {
      en: "https://bogastock.com/global/en/terms",
      es: "https://bogastock.com/global/es/terms",
      fr: "https://bogastock.com/global/fr/terms",
      id: "https://bogastock.com/global/id/terms",
      pt: "https://bogastock.com/global/pt/terms",
      tr: "https://bogastock.com/global/tr/terms",
      "x-default": "https://bogastock.com/global/en/terms",
    } }
};


export default function TermsPageEs() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Términos del Servicio y Acuerdo de Usuario</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Aceptación de los Términos y Declaración Corporativa
            </h2>
            <p className="mb-4 text-slate-300">
              Al acceder o crear una cuenta en <strong className="text-white">BogaStock.com</strong>, acepta cumplir con estos Términos del Servicio y Acuerdo de Usuario.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> es una plataforma automatizada de <strong className="text-white">análisis técnico y soporte para la toma de decisiones</strong> impulsada por modelos cuantitativos e inteligencia artificial.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Alcance del Servicio y Exención de Asesoramiento de Inversión
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> escanea los mercados financieros globales utilizando algoritmos para identificar oportunidades técnicas y proporcionar datos de soporte analítico.
            </p>
            <p className="text-slate-300">
              Ningún contenido en BogaStock.com constituye <strong className="text-white">asesoramiento de inversión, gestión de carteras ni recomendación financiera</strong>. BogaStock.com no es un Asesor de Inversiones Registrado (RIA) ni corredor de bolsa.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Mercados Globales y Cumplimiento Regulatorio de la UE (ESMA, MiFID II, MAR)
            </h2>
            <p className="mb-4 text-slate-300">
              Nuestra plataforma cubre los mercados globales: <strong className="text-white">EE. UU. (NYSE, NASDAQ, S&P 500)</strong>, <strong className="text-white">Europa (DAX, FTSE 100, CAC40, STOXX50)</strong>, <strong className="text-white">Asia (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> y <strong className="text-white">América Latina (S&P Latam 40, IBOVESPA)</strong>, junto con Divisas, Materias Primas y Criptomonedas.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> opera de conformidad con las normativas financieras de la Unión Europea (UE), incluidas las directrices de la <strong className="text-white">ESMA</strong>, <strong className="text-white">MiFID II</strong> y el reglamento <strong className="text-white">MAR (Abuso de Mercado No 596/2014)</strong>.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Seguridad de la Cuenta y Propiedad Intelectual
            </h2>
            <p className="text-slate-300">
              Las cuentas de usuario son personales e intransferibles. Queda estrictamente prohibida la extracción automatizada de datos (scraping), copia o redistribución comercial de los algoritmos de BogaStock.com sin autorización por escrito.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Privacidad de Datos (RGPD / GDPR y CCPA)
            </h2>
            <p className="text-slate-300">
              Procesamos los datos de conformidad con el Reglamento General de Protección de Datos de la UE (<strong className="text-white">RGPD / GDPR</strong>) y la <strong className="text-white">CCPA</strong>. BogaStock.com nunca vende datos personales a terceros.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Vigencia Legal</h2>
            <p className="text-xs text-slate-400">
              Al continuar utilizando BogaStock.com, usted acepta estos términos y las condiciones normativas aplicables.
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
