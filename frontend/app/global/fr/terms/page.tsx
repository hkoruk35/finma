import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Conditions d'Utilisation et Accord Utilisateur | BogaStock.com",
  description: "Conditions d'utilisation de la plateforme d'analyse technique et d'aide à la décision BogaStock.com et conformité réglementaire UE.",
  alternates: {
    canonical: "https://bogastock.com/global/fr/terms",
    languages: {
      "en-US": "https://bogastock.com/global/en/terms",
      "tr-TR": "https://bogastock.com/global/tr/terms",
      "es-ES": "https://bogastock.com/global/es/terms",
      "fr-FR": "https://bogastock.com/global/fr/terms",
      "pt-PT": "https://bogastock.com/global/pt/terms",
    },
  },
  openGraph: {
    url: "https://bogastock.com/global/fr/terms",
  },
};

export default function TermsPageFr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Conditions d'Utilisation et Accord Utilisateur</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Acceptation des Conditions et Déclaration d'Entreprise
            </h2>
            <p className="mb-4 text-slate-300">
              En accédant ou en créant un compte sur <strong className="text-white">BogaStock.com</strong>, vous acceptez d'être lié par les présentes Conditions d'Utilisation.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> est une plateforme automatisée <strong className="text-white">d'analyse technique et d'aide à la décision</strong> alimentée par des modèles quantitatifs et l'intelligence artificielle.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Portée du Service et Pas un Conseil en Investissement
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> balaye les marchés financiers mondiaux à l'aide d'algorithmes pour détecter des opportunités techniques et fournir des données analytiques d'aide à la décision.
            </p>
            <p className="text-slate-300">
              Rien sur BogaStock.com ne constitue <strong className="text-white">un conseil en investissement, une gestion de portefeuille ou une recommandation financière</strong>. BogaStock.com n'est pas un conseiller en investissement enregistré (RIA) ni un courtier.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Marchés Mondiaux et Conformité aux Lois de l'UE (ESMA, MiFID II, MAR)
            </h2>
            <p className="mb-4 text-slate-300">
              Notre plateforme couvre les marchés mondiaux : <strong className="text-white">États-Unis (NYSE, NASDAQ, S&P 500)</strong>, <strong className="text-white">Europe (DAX, FTSE 100, CAC40, STOXX50)</strong>, <strong className="text-white">Asie (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> et <strong className="text-white">Amérique Latine (S&P Latam 40, IBOVESPA)</strong>, ainsi que le Forex, les Matières Premières et les Cryptomonnaies.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> fonctionne en stricte conformité avec les réglementations de l'UE, notamment les directives de l'<strong className="text-white">ESMA</strong>, <strong className="text-white">MiFID II</strong> et le règlement <strong className="text-white">MAR (Abus de Marché n° 596/2014)</strong>.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Sécurité du Compte et Propriété Intellectuelle
            </h2>
            <p className="text-slate-300">
              Les comptes d'utilisateurs sont personnels et intransférables. L'extraction automatisée de données (scraping), la copie ou la redistribution commerciale des algorithmes de BogaStock.com sans autorisation écrite sont strictement interdites.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Protection des Données (RGPD / GDPR et CCPA)
            </h2>
            <p className="text-slate-300">
              Nous traitons les données en toute conformité avec le Règlement Général sur la Protection des Données de l'UE (<strong className="text-white">RGPD / GDPR</strong>) et le <strong className="text-white">CCPA</strong>. BogaStock.com ne vend jamais de données personnelles à des tiers.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Entrée en Vigueur Légale</h2>
            <p className="text-xs text-slate-400">
              En continuant d'utiliser BogaStock.com, vous acceptez les présentes conditions et exigences réglementaires.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Dernière mise à jour : 4 août 2026 | BogaStock.com Plateforme d'Analyse Technique et d'Aide à la Décision
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
