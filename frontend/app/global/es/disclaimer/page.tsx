import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function EsDisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Avisos Legales, Exención de Responsabilidad y Declaración de Cumplimiento Normativo</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">1. Exención de Responsabilidad sobre Asesoramiento Financiero (No Constituye Asesoramiento de Inversión)</h2>
            <p className="mb-4">
              BOGASTOCK.com (Blue One Global Analysis) es una plataforma automatizada de análisis financiero, investigación y educación que utiliza modelos de datos cuantitativos, algoritmos propietarios e inteligencia artificial. Todo el contenido, herramientas, métricas, puntuaciones y clasificaciones generadas por nuestro motor de inteligencia artificial (incluyendo, pero no limitado a, calificaciones como "ALTA CONVICCIÓN", "SESGO POSITIVO", "TENDENCIA ALCISTA", etc.) se proporcionan únicamente con fines informativos generales y educativos.
            </p>
            <p className="mb-4">
              <strong>Ausencia de Relación Fiduciaria:</strong> Bajo ninguna circunstancia la información, análisis o señales proporcionadas en esta plataforma constituyen un asesoramiento financiero, de inversión, legal o fiscal. BOGASTOCK.com no está registrada como asesora de inversión, sociedad de valores o fiduciaria financiera bajo ningún marco regulatorio de las jurisdicciones hispanohablantes a las que prestamos servicio. Específicamente:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>España:</strong> No somos una empresa de servicios de inversión (ESI) ni estamos registrados o autorizados por la Comisión Nacional del Mercado de Valores (CNMV) de conformidad con la Ley de los Mercados de Valores y de los Servicios de Inversión. No se presta asesoramiento personalizado en materia de inversión.</li>
              <li><strong>México:</strong> No somos un asesor en inversiones registrado, casa de bolsa o entidad financiera regulada ni autorizada por la Comisión Nacional Bancaria y de Valores (CNBV) de conformidad con la Ley del Mercado de Valores.</li>
              <li><strong>Colombia:</strong> No somos un intermediario de valores ni asesor financiero registrado ante la Superintendencia Financiera de Colombia (SFC).</li>
              <li><strong>Argentina:</strong> No operamos como agente de liquidación y compensación (ALyC) ni como agente de asesoramiento global de inversión registrado ante la Comisión Nacional de Valores (CNV).</li>
              <li><strong>Chile:</strong> No somos un corredor de bolsa ni agente de valores registrado ante la Comisión para el Mercado Financiero (CMF).</li>
              <li><strong>Perú:</strong> No estamos regulados ni registrados como agentes de intermediación ante la Superintendencia del Mercado de Valores (SMV).</li>
            </ul>
            <p>
              Usted no debe basarse en la información de BOGASTOCK.com para tomar decisiones financieras. El usuario es el único responsable de realizar su propia investigación independiente y de consultar con un asesor financiero certificado y debidamente autorizado en su respectiva jurisdicción antes de realizar cualquier inversión.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">2. Advertencia de Alto Riesgo y Exención Integral de Responsabilidad</h2>
            <p className="mb-4">
              La negociación de valores, acciones, opciones y otros instrumentos financieros en los mercados de capitales globales—incluyendo pero no limitado a las bolsas de España (Bolsas y Mercados Españoles - BME), México (Bolsa Mexicana de Valores - BMV), Colombia (BVC), Argentina (BYMA), Chile (Bolsa de Santiago), Perú (BVL) y los mercados de Estados Unidos (NYSE, NASDAQ)—conlleva un nivel de riesgo extremadamente alto. La volatilidad de estos mercados puede resultar en la pérdida rápida y total del capital invertido.
            </p>
            <p className="mb-4">
              <strong>Rendimientos Pasados No Garantizan Resultados Futuros:</strong> Los algoritmos, indicadores y puntuaciones de IA que se muestran en esta plataforma son experimentales, de carácter especulativo y se derivan de modelos de datos históricos. El rendimiento estadístico pasado no es indicativo de resultados futuros ni de las condiciones reales del mercado. No ofrecemos declaraciones, garantías ni compromisos (expresos o implícitos) sobre la rentabilidad, precisión, integridad o fiabilidad de nuestros datos.
            </p>
            <p>
              <strong>Asunción de Riesgo por el Inversor:</strong> Al utilizar esta plataforma, usted reconoce que cualquier decisión de inversión o transacción que ejecute basándose en los análisis de BOGASTOCK.com se realiza bajo su propio y exclusivo riesgo y discreción. Por la presente, usted exime de toda responsabilidad, libera y mantiene indemne a BOGASTOCK.com, a sus empresas matrices, fundadores, empleados y afiliados de cualquier pérdida financiera, daño o costo (directo, indirecto, incidental o consecuencial) que resulte del uso de este servicio.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">3. Privacidad de Datos y Cumplimiento de Normativas Globales (RGPD, LFPDPPP, LOPDGDD, Ley 1581)</h2>
            <p className="mb-4">
              BOGASTOCK.com está plenamente comprometida con la protección de los datos de sus usuarios en estricto cumplimiento con las normativas globales de privacidad, incluyendo el Reglamento General de Protección de Datos de la Unión Europea (RGPD), la Ley Orgánica de Protección de Datos Personales y Garantía de los Derechos Digitales de España (LOPDGDD), la Ley Federal de Protección de Datos Personales en Posesión de los Particulares de México (LFPDPPP), la Ley 1581 de Protección de Datos Personales de Colombia, y las regulaciones locales equivalentes en materia de privacidad en Argentina, Chile y Perú.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Recopilación de Datos:</strong> Recopilamos únicamente datos mínimos esenciales (como direcciones de correo electrónico) exclusivamente con el propósito de autenticación segura del usuario, verificación de la cuenta y gestión de suscripciones a través de proveedores de identidad de terceros de total confianza.</li>
              <li><strong>Prohibición de Venta de Datos:</strong> BOGASTOCK.com no vende, alquila, transfiere ni comercializa sus datos personales con corredores de datos (data brokers) o anunciantes terceros.</li>
              <li><strong>Derechos ARCO y de Acceso:</strong> Los usuarios mantienen la propiedad absoluta de sus datos. Usted tiene derecho a ejercer sus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición), solicitar la eliminación ("Derecho al Olvido"), modificación o portabilidad de su información personal en cualquier momento a través de la configuración de su cuenta o poniéndose en contacto con nuestro equipo de soporte.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">4. Publicidad, Independencia y Objetividad</h2>
            <p>
              Para mantener la viabilidad operativa y ofrecer un nivel de acceso gratuito, BOGASTOCK.com puede mostrar anuncios publicitarios de terceros. Mantenemos una separación estricta y absoluta entre nuestras redes publicitarias y nuestros modelos cuantitativos de puntuación. Los anunciantes, patrocinadores o socios comerciales externos no tienen ninguna influencia, intervención o control sobre el motor de puntuación de IA de BOGASTOCK.com, la generación de señales o los algoritmos de selección de valores. Todos los resultados analíticos se generan exclusivamente mediante parámetros matemáticos ejecutados de forma programática y objetiva.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">Acuerdo del Inversor</h2>
            <p>
              Al acceder, suscribirse o utilizar BOGASTOCK.com (Blue One Global Analysis), usted reconoce explícitamente que ha leído, comprendido y aceptado voluntariamente quedar vinculado por todas las condiciones legales, exenciones de responsabilidad jurisdiccionales, renuncias de responsabilidad y políticas de privacidad detalladas anteriormente.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Fecha de Entrada en Vigor: 1 de mayo de 2026<br/>
              Jurisdicciones Cubiertas: España, México, Colombia, Argentina, Chile, Perú y Mercados Financieros Globales de Habla Hispana.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
