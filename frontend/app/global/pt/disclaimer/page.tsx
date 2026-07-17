import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function PtDisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Avisos Legais, Exclusão de Responsabilidade e Declaração de Conformidade Regulatória</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">1. Isenção de Responsabilidade sobre Aconselhamento Financeiro (Não Constitui Recomendação de Investimento)</h2>
            <p className="mb-4">
              A BOGASTOCK.com (Blue One Global Analysis) é uma plataforma automatizada de análise financeira, pesquisa e educação que utiliza modelos de dados quantitativos, algoritmos proprietários e inteligência artificial. Todo o conteúdo, ferramentas, métricas, pontuações e classificações geradas pelo nosso motor de inteligência artificial (incluindo, mas não limitado a, classificações como "ALTA CONVICCIÓN", "VIÉS POSITIVO", "TENDÊNCIA DE ALTA", etc.) são fornecidos exclusivamente para fins informativos gerais e educacionais.
            </p>
            <p className="mb-4">
              <strong>Ausência de Relação Fiduciária:</strong> Sob nenhuma circunstância a informação, análise ou sinais fornecidos nesta plataforma constituem aconselhamento financeiro, de investimento, jurídico ou fiscal. A BOGASTOCK.com não está registada como consultora de investimento, sociedade de valores ou fiduciária financeira sob qualquer quadro regulamentar das jurisdições de língua portuguesa às quais prestamos serviços. Especificamente:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Brasil:</strong> Não somos uma consultoria de valores mobiliários, analista de investimentos ou carteira administrada autorizada ou credenciada pela Comissão de Valores Mobiliários (CVM), nos termos da Resolução CVM nº 19 ou demais normas aplicáveis. Não é fornecido aconselhamento individualizado ou direcionado.</li>
              <li><strong>Portugal:</strong> Não somos um intermediário financeiro, consultor para o investimento ou entidade autorizada pela Comissão do Mercado de Valores Mobiliários (CMVM), nos termos do Código dos Valores Mobiliários. Não se realiza qualquer atividade de intermediação financeira ou consultoria autónoma.</li>
              <li><strong>Angola:</strong> Não somos um agente de intermediação ou consultor de investimentos registado junto da Comissão do Mercado de Capitais (CMC).</li>
              <li><strong>Moçambique:</strong> Não estamos registados nem autorizados a exercer atividades de consultoria financeira junto da Superintendência do Mercado de Valores Mobiliários (SIMEV) ou do Banco de Moçambique.</li>
              <li><strong>Cabo Verde:</strong> Não somos uma instituição financeira ou entidade autorizada pela Auditoria Geral do Mercado de Valores Mobiliários (AGMVM).</li>
            </ul>
            <p>
              O utilizador não deve basear-se nas informações da BOGASTOCK.com para tomar decisões financeiras. O utilizador é o único responsável por realizar a sua própria investigação independente e por consultar um orientador financeiro certificado e devidamente autorizado na sua respetiva jurisdição antes de realizar qualquer investimento.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">2. Advertência de Alto Risco e Exclusão Integral de Responsabilidade</h2>
            <p className="mb-4">
              A negociação de valores mobiliários, ações, opções e outros instrumentos financeiros nos mercados de capitais globais—incluindo, mas não limitado a, as bolsas do Brasil (B3 - Brasil, Bolsa, Balcão), Portugal (Euronext Lisbon) e os mercados dos Estados Unidos (NYSE, NASDAQ)—envolve um nível de risco extremamente elevado. A volatilidade destes mercados pode resultar na perda rápida e total do capital investido.
            </p>
            <p className="mb-4">
              <strong>Resultados Passados Não Garantem Resultados Futuros:</strong> Os algoritmos, indicadores e pontuações de IA apresentados nesta plataforma são experimentais, de caráter especulativo e derivados de modelos de dados históricos. O desempenho estatístico passado não é indicativo de resultados futuros nem das condições reais do mercado. Não oferecemos declarações, garantias ou compromissos (expressos ou implícitos) sobre a rentabilidade, precisão, integridade ou fiabilidade dos nossos dados.
            </p>
            <p>
              <strong>Assunção de Risco pelo Investidor:</strong> Ao utilizar esta plataforma, o utilizador reconhece que qualquer decisão de investimento ou transação executada com base nas análises da BOGASTOCK.com é realizada sob o seu próprio e exclusivo risco e discrição. Pela presente, o utilizador isenta de toda a responsabilidade, liberta e mantém indene a BOGASTOCK.com, as suas empresas-mãe, fundadores, funcionários e afiliadas de qualquer perda financeira, dano ou custo (direto, indireto, incidental ou consequencial) resultante do uso deste serviço.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">3. Privacidade de Dados e Conformidade com Normas Globais (LGPD, RGPD, LPDP)</h2>
            <p className="mb-4">
              A BOGASTOCK.com está plenamente empenhada na proteção dos dados dos seus utilizadores, em estrito cumprimento das regulamentações globais de privacidade, incluindo a Lei Geral de Proteção de Dados Pessoais do Brasil (LGPD, Lei nº 13.709/2018), o Regulamento Geral sobre a Proteção de Dados da União Europeia (RGPD), a Lei de Proteção de Dados Pessoais de Portugal (LPDP, Lei nº 58/2019) e as respetivas leis de proteção de dados aplicáveis em Angola, Moçambique e demais países de língua portuguesa.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Recolha de Dados:</strong> Recolhemos apenas dados mínimos essenciais (como endereços de e-mail) exclusivamente para fins de autenticação segura do utilizador, verificação de conta e gestão de subscrições através de provedores de identidade de terceiros altamente fidedignos.</li>
              <li><strong>Proibição de Venda de Dados:</strong> A BOGASTOCK.com não vende, aluga, transfere nem comercializa os seus dados pessoais com corretores de dados (data brokers) ou terceiros anunciantes.</li>
              <li><strong>Direitos dos Titulares de Dados:</strong> Os utilizadores mantêm a propriedade absoluta dos seus dados. O utilizador tem o direito de exercer os seus direitos de acesso, retificação, eliminação ("Direito ao Esquecimento"), oposição, limitação do tratamento e portabilidade das suas informações pessoais a qualquer momento através das definições da sua conta ou contactando a nossa equipa de suporte.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">4. Publicidade, Independência e Objetividade</h2>
            <p>
              Para manter a viabilidade operacional e disponibilizar um nível de acesso gratuito, a BOGASTOCK.com pode exibir anúncios publicitários de terceiros. Mantemos uma separação rigorosa e absoluta entre as nossas redes publicitárias e os nossos modelos quantitativos de pontuação. Os anunciantes, patrocinadores ou parceiros comerciais externos não têm qualquer influência, intervenção ou controlo sobre o motor de pontuação de IA da BOGASTOCK.com, a geração de sinais ou os algoritmos de seleção de valores mobiliários. Todos os resultados analíticos são gerados exclusivamente mediante parâmetros matemáticos executados de forma programática e objetiva.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">Acordo do Investidor</h2>
            <p>
              Ao aceder, subscrever ou utilizar a BOGASTOCK.com (Blue One Global Analysis), o utilizador reconhece explicitamente que leu, compreendeu e aceitou voluntariamente ficar vinculado por todas as condições legais, exclusões de responsabilidade jurisdicionais, renúncias de responsabilidade e políticas de privacidade detalhadas acima.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Data de Entrada em Vigor: 1 de maio de 2026<br/>
              Jurisdições Cobertas: Brasil, Portugal, Angola, Moçambique, Cabo Verde e Mercados Financeiros Globais de Língua Portuguesa.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
