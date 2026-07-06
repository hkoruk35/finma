import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function EsDisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} logoHref="/global/es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/global/en/disclaimer" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Legal y Cumplimiento</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. No Constituye Asesoramiento Financiero</h2>
            <p>
              BOGA AI Daily 6,000+ es un servicio informativo automatizado. El contenido proporcionado en esta plataforma,
              incluyendo pero no limitado a los análisis, puntuaciones y valoraciones de trading generados por BOGA AI
              (ALTA CONVICCIÓN, SESGO POSITIVO, etc.), es únicamente para fines informativos. NO constituye asesoramiento financiero,
              de inversión o profesional. No somos un asesor de inversiones registrado (RIA), corredor de bolsa
              ni fiduciario financiero. Consulta siempre con un profesional financiero autorizado antes de tomar
              cualquier decisión de inversión.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Divulgación de Alto Riesgo</h2>
            <p>
              El trading de acciones de EE.UU. implica un alto grado de riesgo y la posibilidad de pérdida significativa de capital.
              Nuestras puntuaciones de IA son experimentales y se basan en patrones de datos históricos que no garantizan
              resultados futuros. No ofrecemos ninguna garantía sobre la rentabilidad o el éxito de cualquier puntuación
              proporcionada. Utiliza la información bajo tu propio riesgo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Privacidad de Datos (Cumplimiento CCPA/GDPR)</h2>
            <p>
              Priorizamos la privacidad del usuario. BOGA AI Daily 6,000+ solo recopila direcciones de correo electrónico para
              fines de autenticación de cuentas a través de proveedores externos seguros. NO vendemos datos de usuarios a
              terceros. Los miembros tienen derecho a solicitar la eliminación completa de su cuenta y datos en cualquier
              momento a través de nuestra configuración o formulario de contacto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Divulgación de Publicidad y Neutralidad</h2>
            <p>
              En esta plataforma pueden mostrarse anuncios de terceros para apoyar nuestro nivel de membresía gratuita.
              BOGA AI mantiene una estricta separación entre publicidad y análisis; los anunciantes no tienen
              influencia sobre el motor de puntuación de BOGA AI, la generación de señales ni el proceso de selección de acciones.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Última actualización: Abril 2026. Al utilizar la plataforma BOGA AI Daily 6,000+, reconoces
              que has leído, comprendido y aceptado voluntariamente todos los términos descritos anteriormente.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
