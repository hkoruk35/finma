import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso Legal",
  alternates: {
    canonical: "https://bogastock.com/global/pt/disclaimer",
    languages: {
    en: "https://bogastock.com/global/en/disclaimer",
    es: "https://bogastock.com/global/es/disclaimer",
    fr: "https://bogastock.com/global/fr/disclaimer",
    id: "https://bogastock.com/global/id/disclaimer",
    pt: "https://bogastock.com/global/pt/disclaimer",
    tr: "https://bogastock.com/global/tr/disclaimer",
    "x-default": "https://bogastock.com/global/en/disclaimer",
    },
  },
};


export default function DisclaimerPagePt() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Avisos Legais, Conformidade Regulatória e Isenção de Responsabilidade</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Plataforma de Análise Técnica e Suporte à Decisão (Não é Aconselhamento de Investimento)
            </h2>
            <p className="mb-4 text-slate-300">
              O <strong className="text-white">BogaStock.com</strong> é uma plataforma automatizada de <strong className="text-white">análise técnica e suporte à tomada de decisão</strong> alimentada por modelos quantitativos e inteligência artificial. Nosso sistema varre os mercados financeiros globais para identificar oportunidades técnicas e fornecer dados analíticos de apoio.
            </p>
            <p className="text-slate-300">
              Todo o conteúdo, gráficos, pontuações de IA e indicadores oferecidos no BogaStock.com têm fins estritamente informativos e educacionais. O BogaStock.com não é um Consultor de Investimentos Registrado (RIA) nem uma corretora, e não fornece aconselhamento financeiro personalizado ou gestão de carteira. Sempre consulte um profissional financeiro licenciado antes de tomar decisões de investimento.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Cobertura de Mercados Globais e Aviso de Risco
            </h2>
            <p className="mb-4 text-slate-300">
              Negociar nos mercados de capitais globais — incluindo <strong className="text-white">EUA (NYSE, NASDAQ, S&P 500, Dow, Russell 2000)</strong>, <strong className="text-white">Mercados Europeus (DAX, FTSE 100, CAC40, IBEX35, STOXX50)</strong>, <strong className="text-white">Mercados Asiáticos (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> e <strong className="text-white">Mercados da América Latina (S&P Latam 40, S&P Latam BMI, IBOVESPA, IGCX, IBXX)</strong>, além de Câmbio (Forex), Commodities e Criptomoedas — envolve alto nível de volatilidade e risco de perda de capital.
            </p>
            <p className="text-slate-300">
              O desempenho passado e os modelos algorítmicos não garantem resultados futuros. Todas as decisões de investimento tomadas com base nas informações do BogaStock.com são de responsabilidade exclusiva do usuário.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Leis da União Europeia (UE) e Conformidade Regulatória
            </h2>
            <p className="mb-4 text-slate-300">
              O <strong className="text-white">BogaStock.com</strong> toma como referência as diretrizes financeiras da União Europeia (UE), incluindo normas da <strong className="text-white">ESMA (Autoridade Europeia dos Valores Mobiliares e dos Mercados)</strong>, a diretiva <strong className="text-white">MiFID II</strong> e o regulamento <strong className="text-white">MAR (Regulamento sobre Abuso de Mercado da UE No 596/2014)</strong>.
            </p>
            <p className="text-slate-300">
              Nossa plataforma não realiza manipulação de mercado, uso de informação privilegiada ou consultoria não autorizada. Todas as varreduras algorítmicas são executadas com base em parâmetros matemáticos objetivos.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Privacidade de Dados (GDPR / RGPD e CCPA)
            </h2>
            <p className="text-slate-300">
              Comprometemo-nos a proteger a privacidade dos dados em conformidade com a legislação aplicável, incluindo o Regulamento Geral sobre a Proteção de Dados da UE (<strong className="text-white">GDPR / RGPD</strong>) e a <strong className="text-white">CCPA</strong>. Não vendemos nem alugamos dados pessoais a terceiros.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Independência e Objetividade
            </h2>
            <p className="text-slate-300">
              Anúncios ou parceiros de terceiros exibidos no <strong className="text-white">BogaStock.com</strong> não têm qualquer influência ou controle sobre nossos algoritmos de IA ou resultados de análise técnica.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Declaração do Usuário</h2>
            <p className="text-xs text-slate-400">
              Ao utilizar o BogaStock.com, você reconhece que leu e concordou com todos os termos legais e condições de conformidade europeias e internacionais descritas acima.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Última atualização: 4 de agosto de 2026 | BogaStock.com Plataforma de Análise Técnica e Suporte à Decisão
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
