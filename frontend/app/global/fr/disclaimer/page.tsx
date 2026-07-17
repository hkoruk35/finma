import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function FrDisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Mentions Légales, Limites de Responsabilité et Déclaration de Conformité Réglementaire</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">1. Exclusion de responsabilité concernant le conseil financier (Ceci ne constitue pas un conseil en investissement)</h2>
            <p className="mb-4">
              BOGASTOCK.com (Blue One Global Analysis) est une plateforme automatisée d'analyse financière, de recherche et d'éducation utilisant des modèles de données quantitatifs, des algorithmes propriétaires et l'intelligence artificielle. Tout le contenu, les outils, les métriques, les scores et les classifications générés par notre moteur d'intelligence artificielle (y compris, mais sans s'y limiter, les mentions telles que « HAUTE CONVICTION », « BIAIS POSITIF », « TENDANCE HAUSSIÈRE », etc.) sont fournis uniquement à des fins d'information générale et d'éducation.
            </p>
            <p className="mb-4">
              <strong>Absence de relation fiduciaire :</strong> En aucun cas les informations, analyses ou signaux fournis sur cette plateforme ne constituent un conseil en investissement, un conseil financier, juridique ou fiscal. BOGASTOCK.com n'est pas enregistrée en tant que conseiller en investissement, société de courtage ou fiduciaire financière sous les cadres réglementaires des juridictions francophones desservies. Spécifiquement :
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>France :</strong> Nous ne sommes pas un Conseiller en Investissements Financiers (CIF) ou un Prestataire de Services d'Investissement (PSI) agréé ou enregistré auprès de l'Autorité des Marchés Financiers (AMF) ou de l'ACPR. Aucun conseil personnalisé en investissement n'est fourni.</li>
              <li><strong>Canada (Québec) :</strong> Nous ne sommes pas enregistrés en tant que conseiller, courtier ou représentant auprès de l'Autorité des marchés financiers (AMF Québec) ou des autres commissions provinciales des valeurs mobilières (comme la CVMO). Nous n'exerçons aucune activité de conseil en valeurs.</li>
              <li><strong>Belgique :</strong> Nous ne sommes pas enregistrés auprès de l'Autorité des services et marchés financiers (FSMA) en tant qu'intermédiaire financier ou conseiller en investissement.</li>
              <li><strong>Suisse :</strong> Nous ne fournissons pas de services financiers réglementés au sens de la Loi sur les services financiers (LSFin) et ne sommes pas surveillés par l'Autorité fédérale de surveillance des marchés financiers (FINMA).</li>
              <li><strong>Luxembourg :</strong> Nous ne sommes pas agréés par la Commission de Surveillance du Secteur Financier (CSSF) pour fournir des conseils en investissement.</li>
              <li><strong>Afrique de l'Ouest (Côte d'Ivoire, Sénégal) :</strong> Nous ne sommes pas agréés par l'Autorité des Marchés Financiers de l'UMOA (AMF-UMOA) en tant que SGI ou conseiller en investissement.</li>
            </ul>
            <p>
              Vous ne devez pas vous baser sur les informations de BOGASTOCK.com pour prendre des décisions financières. L'utilisateur est seul responsable de mener ses propres recherches indépendantes et de consulter un professionnel de la finance certifié et dûment agréé dans sa juridiction avant tout investissement.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">2. Avertissement sur les risques élevés et exclusion globale de responsabilité</h2>
            <p className="mb-4">
              La négociation de valeurs mobilières, d'actions, d'options et d'autres instruments financiers sur les marchés de capitaux mondiaux — y compris, mais sans s'y limiter, Euronext (Paris, Bruxelles), la Bourse de Toronto (TSX), la Bourse suisse (SIX) et les marchés américains (NYSE, NASDAQ) — comporte un niveau de risque extrêmement élevé. La volatilité de ces marchés peut entraîner la perte rapide et totale du capital investi.
            </p>
            <p className="mb-4">
              <strong>Les performances passées ne garantissent pas les résultats futurs :</strong> Les algorithmes, indicateurs et scores d'IA présentés sur cette plateforme sont expérimentaux, spéculatifs et dérivés de modèles de données historiques. Les performances statistiques passées ne préjugent pas des résultats futurs ni des conditions réelles du marché. Nous n'offrons aucune garantie (expresse ou implicite) quant à la rentabilité, l'exactitude, l'exhaustivité ou la fiabilité de nos données.
            </p>
            <p>
              <strong>Acceptation des risques par l'investisseur :</strong> En utilisant cette plateforme, vous reconnaissez que toute décision d'investissement ou transaction exécutée sur la base des analyses de BOGASTOCK.com est effectuée à vos risques et périls et sous votre seule discrétion. Par la présente, vous dégagez de toute responsabilité BOGASTOCK.com, ses sociétés mères, ses fondateurs, ses employés et ses sociétés affiliées pour toute perte financière, dommage ou coût (direct, indirect, accessoire ou consécutif) résultant de l'utilisation de ce service.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">3. Confidentialité des données et conformité aux réglementations mondiales (RGPD, Loi 25, LPRPDE, LPD)</h2>
            <p className="mb-4">
              BOGASTOCK.com s'engage fermement à protéger les données de ses utilisateurs en stricte conformité avec les réglementations mondiales sur la protection de la vie privée, notamment le Règlement Général sur la Protection des Données de l'Union européenne (RGPD), la Loi sur la protection des renseignements personnels et les documents électroniques du Canada (LPRPDE), la Loi modernisant des dispositions législatives en matière de protection des renseignements personnels du Québec (Loi 25), la Loi fédérale sur la protection des données en Suisse (LPD) et les lois équivalentes dans l'espace francophone africain.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Collecte des données :</strong> Nous collectons uniquement les données minimales essentielles (telles que les adresses e-mail) exclusivement à des fins d'authentification sécurisée des utilisateurs, de vérification des comptes et de gestion des abonnements par l'intermédiaire de fournisseurs d'identité tiers de confiance.</li>
              <li><strong>Interdiction de vente des données :</strong> BOGASTOCK.com ne vend pas, ne loue pas, ne transfère pas et ne commercialise pas vos données personnelles auprès de courtiers en données (data brokers) ou de tiers annonceurs.</li>
              <li><strong>Droits des utilisateurs :</strong> Les utilisateurs conservent la propriété absolue de leurs données. Vous disposez d'un droit d'accès, de rectification, de suppression (« Droit à l'oubli »), d'opposition, de limitation du traitement et de portabilité de vos données personnelles à tout moment via les paramètres de votre compte ou en contactant notre équipe d'assistance.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">4. Publicité, indépendance et objectivité</h2>
            <p>
              Afin de maintenir sa viabilité opérationnelle et d'offrir un niveau d'accès gratuit, BOGASTOCK.com peut afficher des publicités de tiers. Nous maintenons une séparation stricte et absolue entre nos réseaux publicitaires et nos modèles quantitatifs de notation. Les annonceurs, sponsors ou partenaires commerciaux tiers n'ont aucune influence, intervention ou contrôle sur le moteur de notation d'IA de BOGASTOCK.com, la génération de signaux ou les algorithmes de sélection des titres. Tous les résultats analytiques sont générés exclusivement selon des paramètres mathématiques exécutés de manière programmatique et objective.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">Accord de l'investisseur</h2>
            <p>
              En accédant, en vous abonnant ou en utilisant BOGASTOCK.com (Blue One Global Analysis), vous reconnaissez expressément avoir lu, compris et accepté volontairement d'être lié par l'ensemble des conditions juridiques, des exclusions de responsabilité juridictionnelles, des renonciations de responsabilité et des politiques de confidentialité détaillées ci-dessus.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Date d'entrée en vigueur : 1er mai 2026<br/>
              Juridictions couvertes : France, Canada (Québec inclus), Belgique, Suisse, Luxembourg, Côte d'Ivoire, Sénégal et marchés financiers mondiaux francophones.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
