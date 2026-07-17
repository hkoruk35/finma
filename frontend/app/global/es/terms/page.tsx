import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function EsTermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Términos de Servicio</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-white mb-3">1. Aceptación de los Términos</h2>
            <p>
              Al acceder a BOGA AI Daily 6,000+, aceptas cumplir y quedar vinculado por
              estos Términos de Servicio. Si no estás de acuerdo, por favor no utilices el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">2. Cuentas de Usuario</h2>
            <p>
              Eres responsable de mantener la confidencialidad de la contraseña de tu cuenta.
              Las cuentas son para uso individual y no pueden ser compartidas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">3. Restricciones de Uso</h2>
            <p>
              Aceptas no realizar scraping, recolección automatizada ni redistribución
              de señales, puntuaciones o resúmenes de IA de BOGA AI sin permiso escrito expreso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">4. Modificaciones del Servicio</h2>
            <p>
              Nos reservamos el derecho de modificar o interrumpir cualquier parte del servicio
              en cualquier momento sin previo aviso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">5. Terminación</h2>
            <p>
              Podemos suspender o cancelar tu cuenta si sospechamos actividad fraudulenta
              o una violación de estos términos.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
