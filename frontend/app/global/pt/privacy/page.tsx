import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function PtPrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} logoHref="/global/pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/global/en/privacy" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Política de Privacidade</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <p>Última atualização: Abril de 2026</p>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Informações que Coletamos</h2>
            <p>
              Coletamos informações pessoais mínimas para fornecer nossos serviços.
              Isso inclui seu endereço de e-mail ao se cadastrar em uma conta,
              e dados técnicos como endereços IP e cookies do navegador para manter
              sua sessão e analisar o desempenho do site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Como Usamos os Dados</h2>
            <p>
              Seus dados são utilizados para:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
               <li>Gerenciar sua conta de membro e as configurações da sua lista de acompanhamento.</li>
               <li>Enviar resumos diários do mercado ou alertas críticos (caso você tenha optado por recebê-los).</li>
               <li>Melhorar nossos algoritmos de pontuação de IA com base em padrões de uso agregados.</li>
               <li>Exibir publicidade financeira relevante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Compartilhamento de Dados</h2>
            <p>
              Não vendemos seus dados pessoais a terceiros.
              Dados agregados e anonimizados podem ser compartilhados com nossos parceiros
              publicitários para facilitar a entrega de anúncios.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Segurança</h2>
            <p>
              Utilizamos criptografia padrão do setor para proteger sua conta.
              No entanto, nenhum método de armazenamento ou transmissão eletrônica é 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Seus Direitos</h2>
            <p>
              Você pode solicitar a visualização, correção ou exclusão de seus dados pessoais
              a qualquer momento entrando em contato conosco em contact@bogastock.com.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
