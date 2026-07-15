import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Sobre a BOGASTOCK - Blue One Global Analysis - Daily 6,000+ | Análise do Mercado de Ações dos EUA com IA",
  description: "BOGASTOCK - Blue One Global Analysis - Daily 6,000+ analisa diariamente mais de 6.000 ações e ETFs de destaque dos EUA, identifica os melhores candidatos e entrega análise financeira diária com IA sobre as oportunidades de maior convicção no mercado americano.",
  alternates: {
    canonical: "https://bogastock.com/global/pt/about",
    languages: {
      "en-US": "https://bogastock.com/global/en/about",
      "es-ES": "https://bogastock.com/global/es/about",
      "fr-FR": "https://bogastock.com/global/fr/about",
      "pt-PT": "https://bogastock.com/global/pt/about",
      "tr-TR": "https://bogastock.com/global/tr/about",
    },
  },
  openGraph: {
    title: "Sobre a BOGASTOCK - Blue One Global Analysis - Daily 6,000+ | Análise do Mercado de Ações dos EUA com IA",
    description: "BOGASTOCK - Blue One Global Analysis - Daily 6,000+ analisa diariamente mais de 6.000 ações e ETFs de destaque dos EUA, identifica os melhores candidatos e entrega análise financeira diária com IA sobre as oportunidades de maior convicção no mercado americano.",
    url: "https://bogastock.com/global/pt/about",
  },
};

export default function PtAboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <div className="flex justify-end mb-6">
          <Link href="/global/en/about" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Inteligência do Mercado de Ações dos EUA</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            Análise Financeira Diária.<br />
            <span className="text-[#3b82f6]">Projetada para os Mercados dos EUA.</span>
          </h1>
          <p className="text-xl text-white max-w-2xl mx-auto leading-relaxed">
            BOGASTOCK - Blue One Global Analysis - Daily 6,000+ é um sistema proprietário de seleção e pontuação de ações em múltiplas etapas que transforma todo o universo de ações americanas em uma lista reduzida de oportunidades de alta probabilidade — todos os dias de negociação.
          </p>
        </div>

        {/* 3-Stage Process */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">Como Funciona o Sistema BOGASTOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6 text-2xl font-black">1</div>
              <h3 className="text-lg font-bold text-white mb-3">Varredura Diária do Universo</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Todos os dias, o algoritmo da BOGASTOCK percorre <strong className="text-white">mais de 6.000 ações e ETFs de destaque dos EUA</strong> em todas as principais bolsas — NYSE, NASDAQ e AMEX — aplicando filtros de liquidez, volatilidade e estrutura para isolar os candidatos mais negociáveis.
              </p>
            </div>

            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6 text-2xl font-black">2</div>
              <h3 className="text-lg font-bold text-white mb-3">Lista de Acompanhamento Diária de +6.000</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                A partir da varredura diária, o sistema seleciona <strong className="text-white">mais de 6.000 ações e ETFs de alta prioridade</strong> para acompanhamento diário. Esses candidatos são reavaliados todas as manhãs às 09:00 horário de Nova York com dados de mercado atualizados, leituras técnicas e métricas fundamentais.
              </p>
            </div>

            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6 text-2xl font-black">3</div>
              <h3 className="text-lg font-bold text-white mb-3">Candidatos de Maior Convicção — Pontuados Individualmente</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                O motor de pontuação da BOGASTOCK classifica cada candidato diário e seleciona as configurações de maior convicção. Cada uma recebe uma análise única gerada por IA que cobre técnicos, fundamentos e a justificativa da pontuação — não um modelo genérico, mas um relatório específico para cada ação.
              </p>
            </div>
          </div>
        </div>

        {/* Scoring System */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">O Sistema de Pontuação BOGASTOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Motor Técnico Multi-Fator</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                A Pontuação Mestra da BOGASTOCK é calculada a partir de uma combinação ponderada de indicadores técnicos — RSI, MACD, volume relativo, cruzamentos múltiplos de EMA, força de tendência ADX e intensidade de compressão das Bandas de Bollinger — projetada especificamente para estruturas de momentum na renda variável dos EUA.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Sobreposição Fundamental e Setorial</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Cada pontuação é cruzada com dados fundamentais: relação P/L frente à mediana setorial, rendimento de FCF, margens brutas e momentum de crescimento de receita. O contexto de desempenho setorial garante que as pontuações sejam sempre relativas — não absolutas — às condições atuais do mercado.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Comentário de IA Proprietário</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Cada ação pré-selecionada recebe um relatório de análise em linguagem simples gerado pelo motor BOGASTOCK. O relatório explica <em>por que</em> uma pontuação específica foi atribuída — referenciando os próprios dados da ação, não genéricos — para que você entenda a justificativa por trás de cada avaliação.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Cinco Níveis de Pontuação</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                As pontuações da BOGASTOCK são classificadas em cinco níveis profissionais: <strong className="text-white">Alta Convicção</strong>, <strong className="text-white">Viés Positivo</strong>, <strong className="text-white">Neutro</strong>, <strong className="text-white">Viés Negativo</strong> e <strong className="text-white">Baixo Desempenho</strong> — proporcionando clareza de nível institucional sem ambiguidade.
              </p>
            </div>
          </div>
        </div>

        {/* Focus Statement */}
        <div className="glass-card p-10 text-center mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] rounded-t-2xl"></div>
          <h2 className="text-2xl font-bold text-white mb-4">100% Focado nos Mercados de Ações dos EUA</h2>
          <p className="text-white max-w-2xl mx-auto leading-relaxed mb-6">
            BOGASTOCK - Blue One Global Analysis - Daily 6,000+ é projetado especificamente para o mercado de ações dos EUA. Cada algoritmo, cada peso e cada categoria de pontuação é calibrado em relação à NYSE, NASDAQ e à estrutura do mercado americano — não é um modelo global genérico adaptado para os EUA.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-bold uppercase tracking-widest">
            {["NYSE", "NASDAQ", "AMEX", "S&P 500", "NASDAQ 100", "Russell 2000"].map(ex => (
              <span key={ex} className="px-3 py-1.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded-full border border-[#3b82f6]/20">{ex}</span>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Nossa Missão</h2>
          <p className="text-white max-w-2xl mx-auto italic leading-relaxed">
            "Tornamos o poder analítico dos fundos institucionais e profissionais acessível a cada investidor. Através de nossa tecnologia avançada de seleção e pontuação de mercado, identificar as oportunidades certas no mercado de ações dos EUA deixa de ser uma tarefa complexa — passa a ser uma rotina diária."
          </p>
        </div>

      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
