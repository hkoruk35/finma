import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "https://bogastock.com/global/fr/about" }
};


export default function AboutPageFr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Notre Histoire</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            D'une Idée de Véhicule Autonome<br />
            <span className="text-[#3b82f6]">au BogaStock d'Aujourd'hui.</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            BogaStock n'est pas né du jour au lendemain. Il est le fruit de plusieurs années d'expérience en traitement de données, accumulées par une petite équipe californienne qui travaillait au départ sur les voitures autonomes.
          </p>
        </div>

        {/* 2018 - Origin */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#3b82f6]">2018</span>
            <h2 className="text-xl font-bold text-white">Un Début en Californie</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            L'histoire de BogaStock commence en réalité avec les véhicules autonomes, pas avec la finance. Fondée en Californie en 2018, AFK Data Sistemleri (AFK DaSYS) a consacré ses premières années à concevoir des systèmes de traitement de données et d'aide à la décision pour les voitures autonomes. Ce savoir-faire alimente aujourd'hui des simulations Smart City en temps réel dans plus de 1 000 villes réparties dans 48 États américains, depuis 2025.
          </p>
        </div>

        {/* 2021 - BogaStock born */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#8b5cf6]">2021</span>
            <h2 className="text-xl font-bold text-white">La Route Croise la Finance</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            En 2021, l'équipe d'AFK DaSYS a décidé d'orienter cette même discipline de traitement de données — donner du sens à d'énormes volumes d'information et les transformer en décisions en temps réel — vers un tout autre défi : les marchés financiers. C'est ainsi qu'est née BogaStock.com, avec un objectif simple : rendre le suivi de milliers d'actions américaines moins technique et plus accessible à tous.
          </p>
        </div>

        {/* Continuous learning */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
          <h2 className="text-xl font-bold text-white mb-4">Un Système qui N'arrête Jamais d'Apprendre</h2>
          <p className="text-white/70 leading-relaxed">
            L'IA de BogaStock n'est plus la même qu'au premier jour, et elle continuera d'évoluer. Chaque nouveau modèle d'analyse ou de trading déployé passe par son propre cycle de réentraînement — plus la plateforme est utilisée, plus elle gagne en expérience et en précision au fil du temps. Cette progression se poursuit aux côtés d'{" "}
            <a href="https://www.afknexro.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">AFK Nexro AI</a>
            , un système d'IA partenaire spécialisé dans les Smart Cities et les véhicules autonomes, dans le cadre d'une culture de R&D partagée.
          </p>
        </div>

        {/* Today */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">BogaStock Aujourd'hui</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">70+</div>
              <p className="text-white/70 text-sm leading-relaxed">pays desservis, avec un système qui fonctionne 24h/24.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">6 000+</div>
              <p className="text-white/70 text-sm leading-relaxed">actions et ETF américains analysés chaque jour.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">5 Langues</div>
              <p className="text-white/70 text-sm leading-relaxed">sur notre site, propulsé par nos propres bases de données et centres de données.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">30+ Langues</div>
              <p className="text-white/70 text-sm leading-relaxed">via Boga Copilot — une conversation naturelle, adaptée à un usage quotidien.</p>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-medium text-white mb-4">Ce en Quoi Nous Croyons</h2>
          <p className="text-white/80 max-w-2xl mx-auto italic leading-relaxed">
            « Dans un monde de plus en plus piloté par des algorithmes, bien traiter les données ne représente que la moitié du travail — les rendre compréhensibles compte tout autant. Chez BogaStock, notre objectif est de transformer des données de marché complexes en un chemin clair que chacun peut suivre, pour que vous puissiez décider en toute confiance. »
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
