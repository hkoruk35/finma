import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export default function DisclaimerPageFr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Mentions Légales, Conformité Réglementaire et Clause de Non-Responsabilité</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Plateforme d'Analyse Technique et d'Aide à la Décision (Pas un Conseil en Investissement)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> est une plateforme automatisée <strong className="text-white">d'analyse technique et d’aide à la décision</strong> alimentée par des modèles quantitatifs et l'intelligence artificielle. Notre système balaye les marchés financiers mondiaux pour détecter des opportunités techniques et fournir des données analytiques d'aide à la décision.
            </p>
            <p className="text-slate-300">
              Tous les contenus, graphiques, scores IA et indicateurs sur BogaStock.com sont fournis à des fins purement informatives et éducatives. BogaStock.com n'est ni un conseiller en investissement enregistré (RIA) ni un courtier, et ne fournit aucun conseil financier personnalisé ni gestion de portefeuille. Consultez toujours un professionnel de la finance agréé avant de prendre des décisions d'investissement.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Couverture des Marchés Mondiaux et Avertissement sur les Risques
            </h2>
            <p className="mb-4 text-slate-300">
              Négocier sur les marchés financiers internationaux — y compris aux <strong className="text-white">États-Unis (NYSE, NASDAQ, S&P 500, Dow, Russell 2000)</strong>, sur les <strong className="text-white">Marchés Européens (DAX, FTSE 100, CAC40, IBEX35, STOXX50)</strong>, les <strong className="text-white">Marchés Asiatiques (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> et les <strong className="text-white">Marchés d’Amérique Latine (S&P Latam 40, S&P Latam BMI, IBOVESPA, IGCX, IBXX)</strong>, ainsi que le Forex, les Matières Premières et les Cryptomonnaies — comporte un niveau élevé de volatilité et de risque de perte en capital.
            </p>
            <p className="text-slate-300">
              Les performances passées et les modèles algorithmiques ne garantissent pas les résultats futurs. Toutes les décisions prises à partir des données de BogaStock.com relèvent de la seule responsabilité de l'utilisateur.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Lois de l'Union Européenne (UE) et Conformité Réglementaire
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> fonctionne en stricte conformité avec les réglementations financières de l'Union Européenne (UE), notamment les directives de l'<strong className="text-white">ESMA (Autorité Européenne des Marchés Financiers)</strong>, la directive <strong className="text-white">MiFID II</strong> et le règlement <strong className="text-white">MAR (Règlement UE Abus de Marché n° 596/2014)</strong>.
            </p>
            <p className="text-slate-300">
              Notre plateforme ne pratique aucune manipulation de marché, délit d'initié ou conseil non autorisé. Tous les balayages algorithmiques sont exécutés selon des critères mathématiques objectifs.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Protection des Données (RGPD / GDPR et CCPA)
            </h2>
            <p className="text-slate-300">
              La confidentialité des utilisateurs est garantie par <strong className="text-white">BogaStock.com</strong> conformément au Règlement Général sur la Protection des Données (<strong className="text-white">RGPD / GDPR</strong>) et au <strong className="text-white">CCPA</strong>. Nous ne vendons ni ne louons de données personnelles à des tiers.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Indépendance et Objectivité
            </h2>
            <p className="text-slate-300">
              Les publicités ou partenariats affichés sur <strong className="text-white">BogaStock.com</strong> n'ont aucun contrôle ni influence sur nos algorithmes d'IA ou sur les résultats d'analyse technique.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Engagement de l'Utilisateur</h2>
            <p className="text-xs text-slate-400">
              En utilisant BogaStock.com, vous reconnaissez avoir lu et accepté l'ensemble des mentions légales et des conditions de conformité européennes et internationales énoncées ci-dessus.
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
