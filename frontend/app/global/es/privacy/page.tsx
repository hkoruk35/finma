import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "https://bogastock.com/global/es/privacy" }
};


export default function PrivacyPageEs() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Política de Privacidad y Estándares Globales de Seguridad</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Nuestro Compromiso con la Seguridad de Datos
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> es una plataforma automatizada de <strong className="text-white">análisis técnico y soporte de decisiones</strong>. La privacidad y seguridad de los datos de nuestros usuarios son fundamentales en nuestra arquitectura.
            </p>
            <p className="text-slate-300">
              Operamos estrictamente bajo los Principios de Seguridad de Google: <strong className="text-white">Minimización de Datos</strong> y <strong className="text-white">Privacidad por Diseño</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Cumplimiento Regulatorio Global (EE. UU., UE, América Latina, Asia)
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">Unión Europea (UE):</strong> Reglamento General de Protección de Datos (<strong className="text-white">RGPD / GDPR</strong>).</li>
              <li><strong className="text-white">Estados Unidos (EE. UU.):</strong> Ley de Privacidad del Consumidor de California (<strong className="text-white">CCPA / CPRA</strong>).</li>
              <li><strong className="text-white">América Latina:</strong> Brasil (<strong className="text-white">LGPD</strong>), México (<strong className="text-white">LFPDPPP</strong>) y Argentina (<strong className="text-white">Ley 25.326</strong>).</li>
              <li><strong className="text-white">Asia-Pacífico:</strong> Corea del Sur (<strong className="text-white">PIPA</strong>), Japón (<strong className="text-white">APPI</strong>) y Singapur/Malasia (<strong className="text-white">PDPA</strong>).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Prohibición de Venta de Datos Personales
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com nunca vende ni alquila datos personales de los usuarios a terceros ni a corredores de datos.</strong>
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Cifrado y Derechos del Usuario
            </h2>
            <p className="text-slate-300">
              Todas las transmisiones están protegidas mediante cifrado <strong className="text-white">TLS 1.3 / SSL</strong> y almacenamiento <strong className="text-white">AES-256</strong>. Los usuarios conservan el derecho de acceso, portabilidad y eliminación total de sus datos (<strong className="text-white">Derecho al Olvido</strong>).
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Publicidad, Cookies y Google AdSense
            </h2>
            <p className="mb-4 text-slate-300">
              BogaStock.com utiliza <strong className="text-white">Google AdSense</strong> para mostrar anuncios en este sitio web. Como proveedor externo, Google utiliza cookies para publicar anuncios basados en las visitas previas de un usuario a este sitio web u otros sitios en Internet. El uso de cookies publicitarias por parte de Google permite que Google y sus socios publiquen anuncios a nuestros usuarios en función de sus visitas a BogaStock.com y/u otros sitios.
            </p>
            <p className="text-slate-300">
              Los usuarios pueden optar por no recibir publicidad personalizada visitando{" "}
              <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">la Configuración de anuncios de Google</a>
              {" "}o{" "}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">www.aboutads.info</a>.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Declaración Global</h2>
            <p className="text-xs text-slate-400">
              Al utilizar BogaStock.com, acepta esta política de privacidad y los estándares internacionales de seguridad.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Última actualización: 4 de agosto de 2026 | BogaStock.com Gestión de Privacidad
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
