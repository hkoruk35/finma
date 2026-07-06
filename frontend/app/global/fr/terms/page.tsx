import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function FrTermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} logoHref="/global/fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/global/en/terms" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Conditions d'Utilisation</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptation des Conditions</h2>
            <p>
              En accédant à BOGA AI Daily 6,000+, vous acceptez de respecter et d'être lié par
              ces Conditions d'Utilisation. Si vous n'êtes pas d'accord, veuillez ne pas utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Comptes Utilisateur</h2>
            <p>
              Vous êtes responsable du maintien de la confidentialité de votre mot de passe.
              Les comptes sont à usage individuel uniquement et ne peuvent pas être partagés.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Restrictions d'Utilisation</h2>
            <p>
              Vous acceptez de ne pas extraire, collecter automatiquement ou redistribuer
              les signaux, scores ou résumés d'IA de BOGA AI sans autorisation écrite express.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Modifications du Service</h2>
            <p>
              Nous nous réservons le droit de modifier ou d'arrêter tout ou partie du service
              à tout moment sans préavis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Résiliation</h2>
            <p>
              Nous pouvons suspendre ou résilier votre compte si nous soupçonnons une activité
              frauduleuse ou une violation de ces conditions.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
