import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Política de Privacidade e Segurança de Dados | BogaStock.com",
  description: "Política de privacidade do BogaStock.com, padrões de segurança do Google e conformidade com GDPR (UE), CCPA (EUA), LGPD (Brasil), PIPA/PDPA (Ásia).",
  alternates: {
    canonical: "https://bogastock.com/global/pt/privacy",
    languages: {
      "en-US": "https://bogastock.com/global/en/privacy",
      "tr-TR": "https://bogastock.com/global/tr/privacy",
      "es-ES": "https://bogastock.com/global/es/privacy",
      "fr-FR": "https://bogastock.com/global/fr/privacy",
      "pt-PT": "https://bogastock.com/global/pt/privacy",
    },
  },
  openGraph: {
    url: "https://bogastock.com/global/pt/privacy",
  },
};

export default function PrivacyPagePt() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Política de Privacidade e Padrões Globais de Segurança</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Nosso Compromisso com a Segurança dos Dados
            </h2>
            <p className="mb-4 text-slate-300">
              O <strong className="text-white">BogaStock.com</strong> é uma plataforma automatizada de <strong className="text-white">análise técnica e suporte à tomada de decisão</strong>. A privacidade e a segurança dos dados dos nossos usuários são essenciais na nossa arquitetura.
            </p>
            <p className="text-slate-300">
              Operamos estritamente sob os Princípios de Segurança do Google: <strong className="text-white">Minimização de Dados</strong> e <strong className="text-white">Privacidade por Design</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Conformidade Regulatória Global (EUA, UE, América Latina, Ásia)
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">União Europeia (UE):</strong> Regulamento Geral sobre a Proteção de Dados (<strong className="text-white">GDPR / RGPD</strong>).</li>
              <li><strong className="text-white">Estados Unidos (EUA):</strong> California Consumer Privacy Act (<strong className="text-white">CCPA / CPRA</strong>).</li>
              <li><strong className="text-white">América Latina:</strong> Brasil (<strong className="text-white">LGPD - Lei Geral de Proteção de Dados</strong>), México (<strong className="text-white">LFPDPPP</strong>) e Argentina (<strong className="text-white">Lei 25.326</strong>).</li>
              <li><strong className="text-white">Ásia-Pacífico:</strong> Coreia do Sul (<strong className="text-white">PIPA</strong>), Japão (<strong className="text-white">APPI</strong>) e Singapura/Malásia (<strong className="text-white">PDPA</strong>).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Proibição de Venda de Dados Pessoais
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">O BogaStock.com nunca vende ou aluga dados pessoais dos usuários a terceiros ou corretores de dados.</strong>
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Criptografia e Direitos do Usuário
            </h2>
            <p className="text-slate-300">
              Todas as transmissões são protegidas por criptografia <strong className="text-white">TLS 1.3 / SSL</strong> e armazenamento <strong className="text-white">AES-256</strong>. Os usuários mantêm o direito de acesso, portabilidade e exclusão total dos dados (<strong className="text-white">Direito ao Esquecimento</strong>).
            </p>
          </section>

          {/* Section 5 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Declaração Global</h2>
            <p className="text-xs text-slate-400">
              Ao utilizar o BogaStock.com, você aceita esta política de privacidade e os padrões internacionais de segurança.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Última atualização: 4 de agosto de 2026 | BogaStock.com Gestão de Privacidade
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
