import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function FrPrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Politique de Confidentialité</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <p>Dernière mise à jour : Avril 2026</p>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">1. Informations que nous Collectons</h2>
            <p>
              Nous collectons des informations personnelles minimales pour fournir nos services.
              Cela comprend votre adresse e-mail lors de votre inscription, ainsi que des données
              techniques telles que les adresses IP et les cookies du navigateur pour maintenir votre
              session et analyser les performances du site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">2. Comment nous Utilisons les Données</h2>
            <p>
              Vos données sont utilisées pour :
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
               <li>Gérer votre compte membre et vos paramètres de liste de surveillance.</li>
               <li>Envoyer des digests de marché quotidiens ou des alertes critiques (si activé).</li>
               <li>Améliorer nos algorithmes de scoring d'IA selon les modèles d'utilisation agrégés.</li>
               <li>Afficher les publicités financières pertinentes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">3. Partage des Données</h2>
            <p>
              Nous ne vendons pas vos données personnelles à des tiers.
              Des données agrégées et anonymisées peuvent être partagées avec nos partenaires
              publicitaires pour faciliter la livraison des annonces.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">4. Sécurité</h2>
            <p>
              Nous utilisons le chiffrement standard de l'industrie pour protéger votre compte.
              Cependant, aucune méthode de stockage ou de transmission électronique n'est 100% sécurisée.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">5. Vos Droits</h2>
            <p>
              Vous pouvez demander à voir, corriger ou supprimer vos données personnelles
              à tout moment en nous contactant à contact@bogastock.com.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
