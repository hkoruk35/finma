import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function EsPrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Política de Privacidad</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <p>Última actualización: Abril 2026</p>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">1. Información que Recopilamos</h2>
            <p>
              Recopilamos información personal mínima para proporcionar nuestros servicios.
              Esto incluye tu dirección de correo electrónico cuando te registras en una cuenta,
              y datos técnicos como direcciones IP y cookies del navegador para mantener
              tu sesión y analizar el rendimiento del sitio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">2. Cómo Usamos los Datos</h2>
            <p>
              Tus datos se utilizan para:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
               <li>Gestionar tu cuenta de miembro y la configuración de tu lista de seguimiento.</li>
               <li>Enviar resúmenes diarios del mercado o alertas críticas (si has optado por recibirlos).</li>
               <li>Mejorar nuestros algoritmos de puntuación de IA basándonos en patrones de uso agregados.</li>
               <li>Mostrar publicidad financiera relevante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">3. Compartición de Datos</h2>
            <p>
              No vendemos tus datos personales a terceros.
              Los datos agregados y anonimizados pueden compartirse con nuestros socios
              publicitarios para facilitar la entrega de anuncios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">4. Seguridad</h2>
            <p>
              Utilizamos cifrado estándar del sector para proteger tu cuenta.
              Sin embargo, ningún método de almacenamiento o transmisión electrónica es 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">5. Tus Derechos</h2>
            <p>
              Puedes solicitar ver, corregir o eliminar tus datos personales
              en cualquier momento contactándonos en contact@bogastock.com.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
