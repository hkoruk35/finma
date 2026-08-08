import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
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
    title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
    url: "https://bogastock.com/global/pt/about",
  },
};

export default function AboutPagePt() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Nossa História</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            De uma Ideia de Veículos Autônomos<br />
            <span className="text-[#3b82f6]">à BogaStock de Hoje.</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            A BogaStock não surgiu da noite para o dia. Ela nasceu de anos de experiência em processamento de dados, acumulados por uma pequena equipe na Califórnia que começou trabalhando com carros autônomos.
          </p>
        </div>

        {/* 2018 - Origin */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#3b82f6]">2018</span>
            <h2 className="text-xl font-bold text-white">Um Começo na Califórnia</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            A história da BogaStock começa, na verdade, com veículos autônomos, não com finanças. Fundada na Califórnia em 2018, a AFK Data Sistemas (AFK DaSYS) dedicou seus primeiros anos a construir sistemas de processamento de dados e apoio à decisão para carros autônomos. Esse conhecimento hoje sustenta simulações de Smart City em tempo real em mais de 1.000 cidades espalhadas por 48 estados americanos, desde 2025.
          </p>
        </div>

        {/* 2021 - BogaStock born */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#8b5cf6]">2021</span>
            <h2 className="text-xl font-bold text-white">O Caminho Cruza com as Finanças</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            Em 2021, a equipe da AFK DaSYS decidiu direcionar essa mesma disciplina de processamento de dados — dar sentido a grandes volumes de informação e transformá-los em decisões em tempo real — para um desafio completamente diferente: os mercados financeiros. Foi assim que a BogaStock.com nasceu, com um objetivo simples: fazer com que acompanhar milhares de ações americanas deixasse de ser algo técnico e se tornasse algo que qualquer pessoa pudesse entender.
          </p>
        </div>

        {/* Continuous learning */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
          <h2 className="text-xl font-bold text-white mb-4">Um Sistema que Nunca Para de Aprender</h2>
          <p className="text-white/70 leading-relaxed">
            A IA da BogaStock não é a mesma desde o primeiro dia, e não vai parar de evoluir. Cada novo modelo de análise ou operação lançado passa pelo seu próprio ciclo de retreinamento — então, quanto mais a plataforma é usada, mais experiência ela ganha e mais precisa ela se torna com o tempo. Esse avanço continua ao lado da{" "}
            <a href="https://www.afknexro.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">AFK Nexro AI</a>
            , um sistema de IA parceiro focado em Smart City e veículos autônomos, dentro de uma cultura compartilhada de pesquisa e desenvolvimento.
          </p>
        </div>

        {/* Today */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">A BogaStock Hoje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">70+</div>
              <p className="text-white/70 text-sm leading-relaxed">países atendidos, com um sistema que funciona 24 horas por dia.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">6.000+</div>
              <p className="text-white/70 text-sm leading-relaxed">ações e ETFs americanos escaneados e avaliados todos os dias.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">5 Idiomas</div>
              <p className="text-white/70 text-sm leading-relaxed">em nosso site, funcionando com nossos próprios bancos de dados e data centers.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">30+ Idiomas</div>
              <p className="text-white/70 text-sm leading-relaxed">com o Boga Copilot — conversa natural, adaptada ao uso do dia a dia.</p>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-medium text-white mb-4">No Que Acreditamos</h2>
          <p className="text-white/80 max-w-2xl mx-auto italic leading-relaxed">
            "Em um mundo cada vez mais guiado por algoritmos, processar os dados corretamente é só metade do trabalho — torná-los compreensíveis importa igualmente. Na BogaStock, nosso objetivo é transformar dados de mercado complexos em um caminho claro que qualquer pessoa possa seguir, para que você tome suas próprias decisões com confiança."
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
