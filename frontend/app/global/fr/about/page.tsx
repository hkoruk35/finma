import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "À Propos de BOGASTOCK - Blue One Global Analysis | Analyse Boursière Alimentée par l'IA",
  description: "BOGASTOCK - Blue One Global Analysis analyse quotidiennement plus de 6 000 actions et ETF américains, identifie les meilleurs candidats et offre une interactive charts quotidienne alimentée par l'IA.",
  alternates: {
    canonical: "https://bogastock.com/global/fr/about",
    languages: {
      "en-US": "https://bogastock.com/global/en/about",
      "es-ES": "https://bogastock.com/global/es/about",
      "fr-FR": "https://bogastock.com/global/fr/about",
      "pt-PT": "https://bogastock.com/global/pt/about",
      "tr-TR": "https://bogastock.com/global/tr/about",
    },
  },
  openGraph: {
    title: "À Propos de BOGASTOCK - Blue One Global Analysis | Analyse Boursière Alimentée par l'IA",
    description: "BOGASTOCK - Blue One Global Analysis analyse quotidiennement plus de 6 000 actions et ETF américains, identifie les meilleurs candidats et offre une interactive charts quotidienne alimentée par l'IA.",
    url: "https://bogastock.com/global/fr/about",
  },
};

export default function FrAboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <div className="flex justify-end mb-6">
          <Link href="/global/en/about" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Intelligence du Marché Boursier Américain</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            Interactive Charts Quotidienne.<br />
            <span className="text-[#3b82f6]">Conçue pour les Marchés Américains.</span>
          </h1>
          <p className="text-xl text-white max-w-2xl mx-auto leading-relaxed">
            BOGASTOCK - Blue One Global Analysis - Daily 6,000+ stocks est un système propriétaire de screening et scoring boursier multi-étapes qui transforme l'univers entier des actions américaines en une liste ciblée d'opportunités à forte probabilité - chaque jour de trading.
          </p>
        </div>

        {/* 3-Stage Process */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">Comment Fonctionne le Système BOGASTOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Stage 1 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6 text-2xl font-black">1</div>
              <h3 className="text-lg font-bold text-white mb-3">Scan Quotidien de l'Univers</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Chaque jour, l'algorithme BOGASTOCK parcourt <strong className="text-white">plus de 6 000 actions et ETF américains de premier plan</strong> dans tous les échanges principaux (NYSE, NASDAQ, AMEX) en appliquant des filtres de liquidité, volatilité et structure pour isoler les candidats les plus négociables.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6 text-2xl font-black">2</div>
              <h3 className="text-lg font-bold text-white mb-3">Liste de Surveillance Quotidienne Top 6 000+</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                À partir du scan quotidien, le système sélectionne <strong className="text-white">plus de 6 000 actions et ETF prioritaires</strong> pour la surveillance quotidienne. Ces candidats sont réévalués chaque matin à 09h00 heure NY avec des données fraîches, des lectures techniques et des métriques fondamentales.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6 text-2xl font-black">3</div>
              <h3 className="text-lg font-bold text-white mb-3">Candidats à Plus Haute Conviction — Scoring Individuel</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Le moteur de scoring BOGASTOCK classe chaque candidat quotidien et sélectionne les configurations à plus haute conviction. Chacune reçoit une analyse générée par l'IA, couvrant les techniques, les fondamentaux et la logique du score - pas un modèle générique, mais un résumé spécifique à chaque action.
              </p>
            </div>
          </div>
        </div>

        {/* Scoring System */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">Le Système de Scoring BOGASTOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Moteur Technique Multifactoriel</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Le Score Maître BOGASTOCK est calculé à partir d'une combinaison pondérée d'indicateurs techniques - RSI, MACD, volume relatif, multiples de croisement EMA, force de tendance ADX et intensité de la bande de Bollinger - conçus spécifiquement pour les structures de momentum des actions américaines.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Superposition Fondamentale et Sectorielle</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Chaque score est recoupé avec des données fondamentales : ratio P/E par rapport à la médiane sectorielle, rendement FCF, marges brutes et momentum de croissance des revenus. Le contexte de performance sectorielle garantit que les scores sont toujours relatifs - non absolus - aux conditions actuelles du marché.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Commentaires Propriétaires d'IA</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Chaque action sélectionnée reçoit un bref d'analyse en langage clair généré par le moteur BOGASTOCK. Le bref explique <em>pourquoi</em> un score spécifique a été attribué - en référençant les données propres de l'action, pas des généralités - afin que vous compreniez la logique derrière chaque notation.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Notations de Score à Cinq Niveaux</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Les scores BOGASTOCK sont classés en cinq niveaux professionnels : <strong className="text-white">Haute Conviction</strong>, <strong className="text-white">Biais Positif</strong>, <strong className="text-white">Neutralité</strong>, <strong className="text-white">Biais Négatif</strong> et <strong className="text-white">Sous-performance</strong> - ce qui vous donne une clarté de calibre institutionnel sans ambiguïté.
              </p>
            </div>
          </div>
        </div>

        {/* Focus Statement */}
        <div className="glass-card p-10 text-center mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] rounded-t-2xl"></div>
          <h2 className="text-2xl font-bold text-white mb-4">100% Concentré sur les Marchés Boursiers Américains</h2>
          <p className="text-white max-w-2xl mx-auto leading-relaxed mb-6">
            BOGASTOCK - Blue One Global Analysis - Daily 6,000+ stocks est conçu spécifiquement pour le marché boursier américain. Chaque algorithme, chaque pondération et chaque catégorie de score est calibré par rapport à la structure du marché NYSE, NASDAQ et américain - pas un modèle global générique adapté aux États-Unis.
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
          <h2 className="text-2xl font-bold text-white mb-4">Notre Mission</h2>
          <p className="text-white max-w-2xl mx-auto italic leading-relaxed">
            « Nous rendons la puissance analytique des fonds institutionnels et des professionnels accessible à chaque investisseur. Grâce à notre technologie avancée de screening et de scoring de marché, identifier les bonnes opportunités sur le marché boursier américain n'est plus une tâche complexe - c'est une routine quotidienne. »
          </p>
        </div>

      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
