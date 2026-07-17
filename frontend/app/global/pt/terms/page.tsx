import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function PtTermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Termos de Serviço</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-white mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar a BOGA AI Daily 6,000+, você concorda em cumprir e ficar vinculado a
              estes Termos de Serviço. Se não concordar, por favor não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">2. Contas de Usuário</h2>
            <p>
              Você é responsável por manter a confidencialidade da senha da sua conta.
              As contas são para uso individual e não podem ser compartilhadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">3. Restrições de Uso</h2>
            <p>
              Você concorda em não realizar scraping, coleta automatizada nem redistribuição
              de sinais, pontuações ou resumos de IA da BOGA AI sem permissão expressa por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">4. Modificações do Serviço</h2>
            <p>
              Reservamo-nos o direito de modificar ou interromper qualquer parte do serviço
              a qualquer momento sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">5. Encerramento</h2>
            <p>
              Podemos suspender ou cancelar sua conta se suspeitarmos de atividade fraudulenta
              ou violação destes termos.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
