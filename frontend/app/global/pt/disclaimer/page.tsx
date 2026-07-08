import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function PtDisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} logoHref="/global/pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/global/en/disclaimer" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Aviso Legal e Conformidade</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Não Constitui Aconselhamento Financeiro</h2>
            <p>
              BOGA AI Daily 6,000+ é um serviço informativo automatizado. O conteúdo fornecido nesta plataforma,
              incluindo mas não se limitando às análises, pontuações e classificações de negociação geradas pela BOGA AI
              (ALTA CONVICÇÃO, VIÉS POSITIVO, etc.), é apenas para fins informativos. NÃO constitui aconselhamento financeiro,
              de investimento ou profissional. Não somos um consultor de investimentos registrado (RIA), corretora
              nem fiduciário financeiro. Consulte sempre um profissional financeiro licenciado antes de tomar
              qualquer decisão de investimento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Divulgação de Alto Risco</h2>
            <p>
              A negociação de ações dos EUA envolve um alto grau de risco e a possibilidade de perda significativa de capital.
              Nossas pontuações de IA são experimentais e baseadas em padrões de dados históricos que não garantem
              resultados futuros. Não oferecemos nenhuma garantia sobre a rentabilidade ou o sucesso de qualquer pontuação
              fornecida. Use as informações por sua conta e risco.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Privacidade de Dados (Conformidade CCPA/GDPR)</h2>
            <p>
              Priorizamos a privacidade do usuário. BOGA AI Daily 6,000+ coleta apenas endereços de e-mail para
              fins de autenticação de contas por meio de provedores externos seguros. NÃO vendemos dados de usuários a
              terceiros. Os membros têm o direito de solicitar a exclusão completa de sua conta e dados a qualquer
              momento por meio de nossas configurações ou formulário de contato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Divulgação de Publicidade e Neutralidade</h2>
            <p>
              Anúncios de terceiros podem ser exibidos nesta plataforma para apoiar nosso nível de assinatura gratuita.
              A BOGA AI mantém uma separação rigorosa entre publicidade e análise; os anunciantes não têm
              influência sobre o motor de pontuação da BOGA AI, a geração de sinais nem o processo de seleção de ações.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Última atualização: Abril de 2026. Ao utilizar a plataforma BOGA AI Daily 6,000+, você reconhece
              que leu, compreendeu e aceitou voluntariamente todos os termos descritos acima.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
