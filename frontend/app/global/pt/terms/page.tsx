import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: {
    canonical: "https://bogastock.com/global/pt/terms",
    languages: {
      "en-US": "https://bogastock.com/global/en/terms",
      "tr-TR": "https://bogastock.com/global/tr/terms",
      "es-ES": "https://bogastock.com/global/es/terms",
      "fr-FR": "https://bogastock.com/global/fr/terms",
      "pt-PT": "https://bogastock.com/global/pt/terms",
    },
  },
  openGraph: {
    url: "https://bogastock.com/global/pt/terms",
  },
};

export default function TermsPagePt() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Termos de Serviço e Acordo do Usuário</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Aceitação dos Termos e Declaração Corporativa
            </h2>
            <p className="mb-4 text-slate-300">
              Ao acessar ou criar uma conta no <strong className="text-white">BogaStock.com</strong>, você concorda em cumprir estes Termos de Serviço e Acordo do Usuário.
            </p>
            <p className="text-slate-300">
              O <strong className="text-white">BogaStock.com</strong> é uma plataforma automatizada de <strong className="text-white">análise técnica e suporte à tomada de decisão</strong> alimentada por modelos quantitativos e inteligência artificial.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Escopo do Serviço e Isenção de Aconselhamento de Investimento
            </h2>
            <p className="mb-4 text-slate-300">
              O <strong className="text-white">BogaStock.com</strong> varre os mercados financeiros globais usando algoritmos para identificar oportunidades técnicas e fornecer dados de suporte analítico.
            </p>
            <p className="text-slate-300">
              Nenhum conteúdo no BogaStock.com constitui <strong className="text-white">aconselhamento de investimento, gestão de carteiras ou recomendação financeira</strong>. O BogaStock.com não é um Consultor de Investimentos Registrado (RIA) nem uma corretora.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Mercados Globais e Conformidade com Leis da UE (ESMA, MiFID II, MAR)
            </h2>
            <p className="mb-4 text-slate-300">
              Nossa plataforma cobre mercados globais: <strong className="text-white">EUA (NYSE, NASDAQ, S&P 500)</strong>, <strong className="text-white">Europa (DAX, FTSE 100, CAC40, STOXX50)</strong>, <strong className="text-white">Ásia (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> e <strong className="text-white">América Latina (S&P Latam 40, IBOVESPA)</strong>, além de Câmbio, Commodities e Criptomoedas.
            </p>
            <p className="text-slate-300">
              O <strong className="text-white">BogaStock.com</strong> opera em estrita conformidade com as diretrizes financeiras da União Europeia (UE), incluindo normas da <strong className="text-white">ESMA</strong>, <strong className="text-white">MiFID II</strong> e o regulamento <strong className="text-white">MAR (Abuso de Mercado No 596/2014)</strong>.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Segurança da Conta e Propriedade Intelectual
            </h2>
            <p className="text-slate-300">
              As contas de usuário são pessoais e intransferíveis. A raspagem automatizada de dados (scraping), cópia ou redistribuição comercial dos algoritmos do BogaStock.com sem autorização prévia por escrito é estritamente proibida.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Privacidade de Dados (GDPR / RGPD e CCPA)
            </h2>
            <p className="text-slate-300">
              Processamos dados de acordo com o Regulamento Geral sobre a Proteção de Dados da UE (<strong className="text-white">GDPR / RGPD</strong>) e a <strong className="text-white">CCPA</strong>. O BogaStock.com nunca vende dados pessoais a terceiros.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Vigência Legal</h2>
            <p className="text-xs text-slate-400">
              Ao continuar a usar o BogaStock.com, você concorda com estes termos e requisitos regulatórios aplicáveis.
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
