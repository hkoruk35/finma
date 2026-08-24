import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "https://bogastock.com/global/pt/privacy", languages: {
      en: "https://bogastock.com/global/en/privacy",
      es: "https://bogastock.com/global/es/privacy",
      fr: "https://bogastock.com/global/fr/privacy",
      id: "https://bogastock.com/global/id/privacy",
      pt: "https://bogastock.com/global/pt/privacy",
      tr: "https://bogastock.com/global/tr/privacy",
      "x-default": "https://bogastock.com/global/en/privacy",
    } }
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
              Utilizamos protocolos de criptografia padrão do setor, incluindo <strong className="text-white">TLS</strong> para dados em trânsito e criptografia baseada em <strong className="text-white">AES</strong> para dados em repouso. Os usuários mantêm o direito de acesso, portabilidade e exclusão total dos dados (<strong className="text-white">Direito ao Esquecimento</strong>).
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Publicidade, Cookies e Google AdSense
            </h2>
            <p className="mb-4 text-slate-300">
              O BogaStock.com utiliza o <strong className="text-white">Google AdSense</strong> para exibir anúncios neste site. Como fornecedor terceirizado, o Google utiliza cookies para veicular anúncios com base nas visitas anteriores do usuário a este site ou a outros sites na Internet. O uso de cookies de publicidade pelo Google permite que o Google e seus parceiros veiculem anúncios aos nossos usuários com base em suas visitas ao BogaStock.com e/ou a outros sites.
            </p>
            <p className="text-slate-300">
              Os usuários podem optar por não receber publicidade personalizada visitando as{" "}
              <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">Configurações de anúncios do Google</a>
              {" "}ou{" "}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">www.aboutads.info</a>.
            </p>
          </section>

          {/* Section 6 */}
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
