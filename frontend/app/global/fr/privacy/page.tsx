import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "https://bogastock.com/global/fr/privacy", languages: {
      en: "https://bogastock.com/global/en/privacy",
      es: "https://bogastock.com/global/es/privacy",
      fr: "https://bogastock.com/global/fr/privacy",
      id: "https://bogastock.com/global/id/privacy",
      pt: "https://bogastock.com/global/pt/privacy",
      tr: "https://bogastock.com/global/tr/privacy",
      "x-default": "https://bogastock.com/global/en/privacy",
    } }
};


export default function PrivacyPageFr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Politique de Confidentialité et Normes Mondiales de Sécurité</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Notre Engagement en Matière de Sécurité des Données
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> est une plateforme automatisée <strong className="text-white">d'analyse technique et d'aide à la décision</strong>. La confidentialité des données est au cœur de notre architecture.
            </p>
            <p className="text-slate-300">
              Nous appliquons rigoureusement les principes de sécurité de Google : <strong className="text-white">Minimisation des Données</strong> et <strong className="text-white">Respect de la Vie Privée dès la Conception</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Conformité Réglementaire Mondiale (USA, UE, Amérique Latine, Asie)
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">Union Européenne (UE) :</strong> Règlement Général sur la Protection des Données (<strong className="text-white">RGPD / GDPR</strong>).</li>
              <li><strong className="text-white">États-Unis (USA) :</strong> California Consumer Privacy Act (<strong className="text-white">CCPA / CPRA</strong>).</li>
              <li><strong className="text-white">Amérique Latine :</strong> Brésil (<strong className="text-white">LGPD</strong>), Mexique (<strong className="text-white">LFPDPPP</strong>) et Argentine (<strong className="text-white">Loi 25.326</strong>).</li>
              <li><strong className="text-white">Asie-Pacifique :</strong> Corée du Sud (<strong className="text-white">PIPA</strong>), Japon (<strong className="text-white">APPI</strong>) et Singapour/Malaisie (<strong className="text-white">PDPA</strong>).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Interdiction de Vente des Données Personnelles
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com ne vend ni ne loue aucune donnée personnelle d'utilisateur à des tiers.</strong>
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Chiffrement et Droits des Utilisateurs
            </h2>
            <p className="text-slate-300">
              Nous utilisons des protocoles de chiffrement standards du secteur, notamment <strong className="text-white">TLS</strong> pour les données en transit et un chiffrement basé sur <strong className="text-white">AES</strong> pour les données au repos. Les utilisateurs bénéficient du <strong className="text-white">Droit à l'Oubli</strong> (suppression complète des données).
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Publicité, Cookies et Google AdSense
            </h2>
            <p className="mb-4 text-slate-300">
              BogaStock.com utilise <strong className="text-white">Google AdSense</strong> pour afficher des publicités sur ce site. En tant que fournisseur tiers, Google utilise des cookies pour diffuser des annonces basées sur les visites antérieures d&apos;un utilisateur sur ce site ou d&apos;autres sites Internet. L&apos;utilisation par Google de cookies publicitaires permet à Google et à ses partenaires de diffuser des annonces à nos utilisateurs en fonction de leurs visites sur BogaStock.com et/ou d&apos;autres sites.
            </p>
            <p className="text-slate-300">
              Les utilisateurs peuvent refuser la publicité personnalisée en consultant les{" "}
              <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">Paramètres des annonces Google</a>
              {" "}ou{" "}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">www.aboutads.info</a>.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Déclaration Mondiale</h2>
            <p className="text-xs text-slate-400">
              En utilisant BogaStock.com, vous acceptez la présente politique de confidentialité et les normes internationales.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Dernière mise à jour : 4 août 2026 | BogaStock.com Gestion de la Confidentialité
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
