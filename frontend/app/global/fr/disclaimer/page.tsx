import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function FrDisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} logoHref="/global/fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/global/en/disclaimer" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Mentions Légales et Conformité</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Pas de Conseils Financiers</h2>
            <p>
              BOGA AI Daily 6,000+ est un service informatisé automatisé. Le contenu fourni sur cette plateforme,
              y compris mais non limité aux analyses générées par BOGA AI, aux scores et aux évaluations commerciales
              (HAUTE CONVICTION, BIAIS POSITIF, etc.), est fourni à titre informatif uniquement. Il ne constitue PAS un conseil
              financier, d'investissement ou professionnel. Nous ne sommes pas un conseiller en placement agréé,
              un courtier ou un fiduciaire financier. Consultez toujours un professionnel financier agréé avant de prendre
              toute décision d'investissement.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Divulgation du Risque Élevé</h2>
            <p>
              La négociation d'actions américaines implique un degré élevé de risque et la possibilité d'une perte importante du capital.
              Nos scores d'IA sont expérimentaux et basés sur les modèles de données historiques qui ne garantissent pas
              les résultats futurs. Nous ne fournissons aucune garantie concernant la rentabilité ou le succès de tout score
              fourni. Utilisez les informations à vos propres risques.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Confidentialité des Données (Conformité CCPA/RGPD)</h2>
            <p>
              Nous accordons la priorité à la confidentialité des utilisateurs. BOGA AI Daily 6,000+ ne collecte que les adresses e-mail
              pour les besoins d'authentification des comptes via des fournisseurs tiers sécurisés. Nous ne vendons pas
              les données des utilisateurs à des tiers. Les membres ont le droit de demander la suppression complète du compte et des données
              à tout moment via nos paramètres ou formulaire de contact.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Divulgation Publicitaire et de Neutralité</h2>
            <p>
              Des publicités tierces peuvent être affichées sur cette plateforme pour soutenir notre niveau d'adhésion gratuit.
              BOGA AI maintient une séparation stricte entre la publicité et l'analyse ; les annonceurs n'ont pas
              d'influence sur le moteur de scoring BOGA AI, la génération de signaux ou le processus de sélection des actions.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Dernière mise à jour : Avril 2026. En utilisant la plateforme BOGA AI Daily 6,000+, vous reconnaissez
              que vous avez lu, compris et accepté volontairement tous les termes énoncés ci-dessus.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
