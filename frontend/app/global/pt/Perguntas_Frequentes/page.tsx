import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Perguntas Frequentes (FAQ) - BOGASTOCK",
  description: "Dúvidas comuns sobre como usar a BOGASTOCK, nosso motor de inteligência artificial e estratégias de swing trade.",
  alternates: { canonical: "https://bogastock.com/global/pt/Perguntas_Frequentes" },
};

export default function FAQPage() {
  const faqs = [
    {
      question: "1. O que é exatamente a BOGASTOCK e como ela pode me ajudar?",
      answer: "A BOGASTOCK é uma plataforma de tecnologia financeira que usa inteligência artificial (a BOGA AI) e algoritmos matemáticos avançados para escanear milhares de ações nas bolsas americanas (NYSE, NASDAQ e AMEX). Nosso objetivo é poupar você do excesso de informação e daquela poluição visual cheia de indicadores complexos. Nós identificamos e pontuamos as 20 a 30 melhores ações com base em análises técnicas e fundamentalistas, entregando uma lista de monitoramento clara e focada em swing trade. Ajudamos você a tomar decisões de investimento baseadas em dados puramente racionais."
    },
    {
      question: "2. Vocês fazem recomendação direta de compra e venda de ações?",
      answer: "De jeito nenhum. Não somos uma empresa de consultoria financeira ou de análise de investimentos (CNPI). A BOGASTOCK é uma plataforma de software que gera análises baseadas 100% em algoritmos matemáticos. O nosso sistema não vai te dizer \"compre no preço X ou venda no preço Y\". Nós apenas listamos as ações com maior força técnica e fundamentalista e entregamos o relatório gerado pela nossa inteligência artificial. A decisão final de operar, o gerenciamento de risco e o tamanho da sua posição são de sua total responsabilidade."
    },
    {
      question: "3. Sou um membro novo. Posso testar o sistema de graça antes de pagar?",
      answer: "Com certeza! Todos os novos membros ganham 7 dias de teste gratuito (Free Trial). Durante esse período, você terá acesso total e transparente a todas as operações ativas de swing trade, às listas de monitoramento (watchlists) e às análises gráficas para avaliar o desempenho da nossa plataforma na prática."
    },
    {
      question: "4. Por que vocês pedem os dados do cartão no cadastro? Serei cobrado imediatamente?",
      answer: "Não, nenhuma cobrança será feita no seu cartão durante os 7 dias de teste. Pedimos esses dados apenas para garantir que, caso você decida continuar usando nossos serviços após o período de teste, seu acesso não seja interrompido. Você pode cancelar sua assinatura facilmente pelo painel de controle a qualquer momento, sem custo nenhum."
    },
    {
      question: "5. Meus dados de cartão de crédito ficam salvos com vocês? É seguro?",
      answer: "A segurança dos seus dados é nossa prioridade máxima. Nós não salvamos e nem registramos nenhuma informação do seu cartão de crédito em nossos servidores. Todo o processamento de pagamento é feito de forma criptografada e 100% segura através do Stripe, uma das infraestruturas de pagamento mais robustas e confiáveis do mundo."
    },
    {
      question: "6. O que é Swing Trade? Eu nunca operei antes.",
      answer: "O swing trade é uma estratégia de operação que busca lucrar com as oscilações de preço de ações em um prazo que costuma durar de alguns dias a poucas semanas. É o modelo ideal para quem não tem tempo de acompanhar o mercado minuto a minuto ou não quer deixar o dinheiro preso no longíssimo prazo. A BOGASTOCK foi calibrada exatamente para capturar esses movimentos de curto e médio prazo. No entanto, lembre-se: como em qualquer modalidade de renda variável, sempre existem riscos de perda de capital."
    },
    {
      question: "7. As ações sugeridas já estão prontas para operar? Como devo entrar no trade?",
      answer: "As ações na nossa lista ativa de \"Swing Trade\" já apresentam uma estrutura técnica muito forte. Porém, para buscar maior rentabilidade com menor risco, sugerimos que nossos membros utilizem o nosso modelo gráfico de 15 minutos (15m) para identificar gatilhos e padrões de entrada mais precisos. Essas estratégias de refinamento ajudam a diminuir as chances de entrar em sinais falsos e protegem o seu bolso."
    },
    {
      question: "8. Qual é a diferença entre a \"Lista de Monitoramento\" (Watchlist) e a \"Lista de Swing\"?",
      answer: "Lista de Monitoramento (Watchlist): São aquelas ações que entraram no radar dos nossos algoritmos por terem alto potencial, mas que ainda não atingiram o ponto ideal de rompimento ou uma zona de entrada segura.\n\nLista de Swing: São as ações que saíram da lista de monitoramento após receberem todas as confirmações de volume e sinais técnicos necessários, tornando-se as operações de maior convicção para o nosso plano ativo."
    },
    {
      question: "9. Como o Gráfico Interativo e a análise da BOGA AI me ajudam no dia a dia?",
      answer: "Na tela de detalhes da ação, oferecemos um gráfico interativo simplificado desenvolvido por nós para evitar poluição visual. A BOGA AI analisa os padrões desse gráfico e gera planos de operação objetivos, mostrando a zona de entrada, os alvos de lucro e o ponto de stop loss (limite de perda). Você analisa essas projeções e decide como gerenciar a sua operação de acordo com seu próprio perfil de risco."
    },
    {
      question: "10. A inteligência artificial BOGA AI pode errar? Como ela evolui?",
      answer: "Sim, ela pode errar. Não existe nenhum sistema financeiro ou inteligência artificial infalível no mundo, pois o mercado é dinâmico e cheio de incertezas. No entanto, a BOGA AI conta com uma infraestrutura de LLM (Grande Modelo de Linguagem) proprietária e aprendizado de máquina. Ela analisa constantemente os resultados de cada operação (ganhos e perdas) para se autoajustar. Nosso objetivo é fazer com que o sistema se adapte o mais rápido possível às mudanças de humor do mercado."
    },
    {
      question: "11. Os gráficos têm muitas linhas e indicadores confusos? Vou ter dificuldade para entender?",
      answer: "Não! A filosofia da BOGASTOCK é eliminar o ruído e a confusão. Em vez de entupir a tela com jargões técnicos difíceis, entregamos gráficos limpos e métricas diretas ao ponto. Mesmo que seu nível de conhecimento financeiro seja iniciante, os relatórios escritos pela inteligência artificial em linguagem simples vão te ajudar a entender o cenário sem complicações."
    },
    {
      question: "12. Os dados da plataforma são em tempo real ou atrasados?",
      answer: "Nossos dados técnicos vêm de fontes que atualizam o mercado de hora em hora, com um atraso padrão de 15 minutos. Como nosso foco total é o swing trade (operações de dias ou semanas), não há necessidade de dados em milissegundos ou tempo real instantâneo. A atualização de hora em hora é mais do que suficiente para gerar análises sólidas, seguras e sem estresse."
    },
    {
      question: "13. Existem milhares de ações na bolsa americana. Como vou saber qual escolher?",
      answer: "Esse é um dos maiores superpoderes da BOGASTOCK. Nosso algoritmo varre automaticamente mais de 6.000 ações todos os dias na NYSE, NASDAQ e AMEX. Filtramos tudo por critérios rígidos de liquidez e volume para eliminar as distrações e manter sob nossa atenção apenas uma média de 20 a 30 ações de altíssima qualidade. Assim, você não precisa perder tempo procurando uma agulha no palheiro."
    },
    {
      question: "14. O que significa \"Rastrear o Smart Money\" (Dinheiro Inteligente)?",
      answer: "No mercado financeiro, quem realmente move os preços de forma expressiva são os grandes fundos institucionais e os bancos de investimento (o chamado Smart Money). Nosso algoritmo acompanha os fluxos diários de capital e picos de volume para identificar quando esses gigantes estão montando ou desmontando posições de forma silenciosa. Seguir a pegada deles aumenta muito as nossas chances de operar a favor da tendência certa."
    },
    {
      question: "15. O que é a \"Classificação de Pontuação em Cinco Níveis\"?",
      answer: "O motor de pontuação da BOGASTOCK analisa cada ação de acordo com seus dados técnicos e fundamentalistas, dividindo-as em cinco categorias claras: Alta Convicção (High Conviction), Tendência Positiva, Neutro (Aguardar), Tendência Negativa e Baixo Desempenho. Dessa forma, você visualiza na hora o nível de embasamento matemático por trás de cada papel, sem espaço para achismos."
    },
    {
      question: "16. Como é calculada a pontuação técnica das ações?",
      answer: "Nossa pontuação técnica é uma média ponderada de vários indicadores consagrados e calibrados especificamente para o mercado americano, como RSI (IFR), MACD, Volume Relativo, cruzamentos de médias móveis exponenciais (EMA), força de tendência (ADX) e estreitamento de Bandas de Bollinger. Ou seja, não dependemos de um indicador isolado, mas sim de um forte consenso multifatorial."
    },
    {
      question: "17. Vocês usam apenas análise técnica? O lucro e o balanço da empresa não importam?",
      answer: "Importam muito! Nosso sistema combina a análise técnica com um filtro robusto de \"Dados Fundamentalistas e Setoriais\". Analisamos indicadores como a relação P/L (Preço/Lucro), rendimento de fluxo de caixa livre (FCF Yield), margens de lucro bruto e o ritmo de crescimento da receita, sempre comparando a empresa com a média do seu setor de atuação. Assim, priorizamos empresas que têm gráficos bonitos e fundamentos saudáveis."
    },
    {
      question: "18. A BOGASTOCK foca apenas no mercado americano? Por quê?",
      answer: "Sim, nosso foco é 100% nas bolsas dos Estados Unidos (NYSE, NASDAQ e AMEX). Escolhemos o mercado americano por ser o mais líquido, profundo e maduro do mundo para operações algorítmicas. Todas as nossas métricas, pesos de pontuação e modelos de inteligência artificial foram calibrados exclusivamente para funcionar sob a dinâmica desse mercado."
    },
    {
      question: "19. Existe a chance de eu perder dinheiro operando com o sistema?",
      answer: "Sim, existe. No mercado de renda variável, qualquer promessa de 100% de acerto é mentira. As taxas de sucesso históricas e as estatísticas da BOGA AI são baseadas em dados passados, o que não garante que todas as operações futuras serão lucrativas. Por isso, é fundamental limitar seus riscos em cada operação e nunca comprometer todo o seu capital de uma vez só."
    },
    {
      question: "20. Sou obrigado a usar o \"Stop Loss\" (Limite de Perda)?",
      answer: "Sim, você é! A regra número um da filosofia da BOGASTOCK é: \"Nunca abra uma operação sem definir um Stop Loss.\" O mercado pode mudar de direção de forma repentina por conta de notícias ou eventos inesperados. A única forma de proteger o seu patrimônio contra grandes quedas é saber exatamente quanto aceita perder antes mesmo de entrar no trade, respeitando o limite programado. Tenha um plano de jogo, mantenha a disciplina e tire a emoção do seu operacional."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="pt" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Perguntas Frequentes (FAQ)
          </h1>
          <p className="text-[#64748b] text-lg">
            Tire suas principais dúvidas sobre como a BOGASTOCK pode ajudar em seus investimentos.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-6 hover:border-[#3b82f6]/50 transition-colors">
              <h3 className="text-lg font-bold text-white mb-3 leading-snug">
                {faq.question}
              </h3>
              <div className="text-[#94a3b8] text-sm md:text-base leading-relaxed space-y-4">
                {faq.answer.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer locale="pt" />
    </div>
  );
}
