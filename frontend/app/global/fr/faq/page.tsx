import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Foire Aux Questions (FAQ) - BOGASTOCK",
  description: "Trouvez les réponses aux questions les plus courantes sur BOGASTOCK, notre IA et le swing trading.",
  alternates: { canonical: "https://bogastock.com/global/fr/faq" },
};

export default function FrFAQPage() {
  const faqs = [
    {
      question: "1. Qu'est-ce que BOGASTOCK exactement et qu'est-ce que cela m'apporte ?",
      answer: "BOGASTOCK est une plateforme fintech qui utilise l'intelligence artificielle (BOGA AI) et des algorithmes mathématiques avancés pour analyser des milliers d'actions sur les marchés américains (NYSE, NASDAQ, AMEX). Notre but est de vous éviter de vous perdre au milieu de graphiques surchargés d'indicateurs complexes. Nous détectons, notons et sélectionnons pour vous les 20 à 30 meilleures actions techniquement et fondamentalement adaptées au swing trading. Nous vous aidons à prendre des décisions d'investissement basées sur des données purement rationnelles."
    },
    {
      question: "2. Donnez-vous des conseils directs d'achat ou de vente d'actions ?",
      answer: "Absolument pas. Nous ne sommes pas un cabinet de conseil en investissement ni des conseillers financiers agréés. BOGASTOCK est une plateforme logicielle dont les analyses reposent uniquement sur des algorithmes mathématiques. Notre système ne vous dira jamais \"achetez à tel prix\" ou \"vendez à tel prix\". Il se contente de lister les candidats potentiels dont la solidité technique et fondamentale est prouvée, tout en vous fournissant un rapport d'analyse par IA. La décision finale de trader, la gestion du risque et la taille de vos positions relèvent de votre entière responsabilité."
    },
    {
      question: "3. Je suis nouveau. Puis-je tester le système gratuitement et sans engagement ?",
      answer: "Oui, tout à fait ! Chaque nouveau membre bénéficie d'une période d'essai gratuit de 7 jours (Free Trial). Pendant cette période, vous aurez un accès total et transparent à toutes les opérations de swing trade actives, aux listes de surveillance (watchlists) et aux analyses graphiques, afin de tester vous-même les performances de la plateforme."
    },
    {
      question: "4. Pourquoi demandez-vous mes coordonnées bancaires lors de l'inscription ? Serais-je prélevé immédiatement ?",
      answer: "Non, aucun prélèvement n'est effectué sur votre carte pendant les 7 jours d'essai. Nous vous demandons ces informations simplement pour garantir la continuité du service si vous choisissez de rester membre après votre période d'essai. Vous pouvez annuler votre abonnement très facilement et sans frais à tout moment depuis votre tableau de bord."
    },
    {
      question: "5. Est-ce que vous conservez mes données de carte bancaire ? Mes informations sont-elles en sécurité ?",
      answer: "Votre sécurité est notre priorité absolue. Nous ne stockons et n'enregistrons aucune information de carte bancaire sur nos propres serveurs. Tous les paiements sont traités de manière entièrement cryptée et sécurisée via Stripe, l'un des prestataires de paiement les plus fiables et les plus sécurisés au monde."
    },
    {
      question: "6. Le Swing Trading, c'est quoi ? Je n'y connais absolument rien.",
      answer: "Le swing trading est une stratégie qui consiste à tirer parti des variations de prix d'une action sur une période allant de quelques jours à quelques semaines. C'est l'alternative idéale pour ceux qui n'ont pas le temps de suivre le marché minute par minute ou qui ne veulent pas bloquer leur capital sur le très long terme. BOGASTOCK est calibré précisément pour capter ces mouvements de court et moyen terme. Cependant, comme pour tout investissement sur les marchés financiers, le risque de perte en capital existe toujours."
    },
    {
      question: "7. Les actions recommandées sont-elles prêtes à être tradées immédiatement ? Comment dois-je entrer en position ?",
      answer: "Les actions qui figurent dans notre liste \"Swing Trade\" présentent déjà des configurations techniques solides. Cependant, pour maximiser vos gains potentiels et limiter les risques, nous accompagnons nos membres en leur montrant comment utiliser nos structures graphiques en unité de temps 15 minutes (15m) afin de trouver des points d'entrée ultra-précis. Ces stratégies d'entrée affinées vous aident à éviter les faux signaux."
    },
    {
      question: "8. Quelle est la différence entre la \"Watchlist\" (Liste de surveillance) et la \"Swing List\" ?",
      answer: "Watchlist : Elle regroupe les actions à fort potentiel détectées par nos algorithmes, mais qui n'ont pas encore déclenché de cassure nette (breakout) ou atteint un niveau d'entrée totalement sécurisé.\n\nSwing List : Ce sont les opportunités de la Watchlist qui ont obtenu toutes les validations techniques, de volume et de momentum nécessaires pour être intégrées dans notre plan de trading actif. Ce sont nos configurations à plus forte conviction."
    },
    {
      question: "9. Comment les graphiques interactifs et l'analyse de BOGA AI m'aident-ils ?",
      answer: "Sur notre page de détails de l'action, nous proposons des graphiques interactifs simplifiés conçus pour rester parfaitement lisibles. BOGA AI analyse ces graphiques pour tracer des plans de trading clairs : zone d'entrée, objectifs de gains et niveaux de stop-loss (limite de perte). Il vous suffit d'analyser ces suggestions pour gérer vos trades selon votre tolérance au risque et la taille de votre capital."
    },
    {
      question: "10. Le système BOGA AI peut-il faire des erreurs ? Comment s'améliore-t-il ?",
      answer: "Oui, il le peut. Il n'existe aucun système financier ni aucune intelligence artificielle infaillible dans le monde ; les marchés sont intrinsèquement incertains. Cependant, BOGA AI s'appuie sur une structure de LLM (Grand Modèle de Langage) propriétaire et sur l'apprentissage automatique (machine learning). Il analyse en continu les résultats de chaque opération (gagnante ou perdante) pour s'ajuster et s'améliorer. Notre but est de nous adapter le plus rapidement possible aux changements du marché."
    },
    {
      question: "11. Les graphiques contiennent-ils trop de lignes et d'indicateurs confus ? Vais-je avoir du mal à comprendre ?",
      answer: "Pas du tout ! La philosophie de BOGASTOCK est d'éliminer le bruit de fond et la confusion. Au lieu de vous submerger de jargon technique, nous vous proposons des graphiques épurés et des indicateurs clairs. Même si vous débutez en analyse financière, les rapports rédigés par l'IA dans un langage simple vous permettront de comprendre la situation en un clin d'œil."
    },
    {
      question: "12. Vos données sont-elles en temps réel ou différées ?",
      answer: "Nos données techniques proviennent de flux mis à jour toutes les heures, avec un léger différé standard de 15 minutes. Comme notre approche repose exclusivement sur le swing trading (mouvements sur plusieurs jours ou semaines), nous n'avons pas besoin de données à la milliseconde près. Les mises à jour horaires sont amplement suffisantes pour générer des analyses stables, sereines et fiables."
    },
    {
      question: "13. Il y a des milliers d'actions cotées en bourse. Comment savoir laquelle choisir ?",
      answer: "C'est là que BOGASTOCK fait tout le travail difficile à votre place. Notre algorithme analyse automatiquement plus de 6 000 actions chaque jour sur la NYSE, le NASDAQ et l'AMEX. Nous filtrons le marché en fonction du volume et de la liquidité pour éliminer le bruit et ne garder sous notre radar qu'une sélection moyenne de 20 à 30 actions de premier choix. Plus besoin de chercher une aiguille dans une botte de foin."
    },
    {
      question: "14. Que signifie \"Suivre la Smart Money\" (l'Argent Intelligent) ?",
      answer: "Sur les marchés, la véritable force qui fait bouger les prix provient des grands fonds institutionnels et des banques d'investissement (ce qu'on appelle la Smart Money). Notre algorithme suit de près les flux de capitaux quotidiens et les pics de volume pour détecter quand ces géants accumulent ou distribuent discrètement des actions. Suivre leurs traces nous permet de trader dans le sens de la tendance dominante."
    },
    {
      question: "15. Qu'est-ce que le \"Système de notation à cinq niveaux\" ?",
      answer: "Le moteur de notation de BOGASTOCK évalue chaque candidat selon ses indicateurs techniques et fondamentaux, puis les classe en cinq catégories claires : Forte conviction (High Conviction), Biais positif, Neutre (Attendre), Biais négatif et Performance faible. Vous visualisez ainsi instantanément la solidité mathématique qui soutient chaque configuration."
    },
    {
      question: "16. Comment la note technique des actions est-elle calculée ?",
      answer: "Notre note technique est une moyenne pondérée d'indicateurs éprouvés et calibrés spécifiquement pour le marché américain, tels que le RSI, la MACD, le volume relatif, les croisements de moyennes mobiles exponentielles (EMA), la force de tendance (ADX) et la contraction des bandes de Bollinger. Nous nous appuyons donc sur un mécanisme de confirmation multifactoriel plutôt que sur un indicateur unique."
    },
    {
      question: "17. Utilisez-vous uniquement l'analyse technique ? Les bénéfices et le bilan d'une entreprise n'ont-ils pas d'importance ?",
      answer: "Ils en ont énormément ! Notre système complète l'analyse technique par un filtre robuste d'analyses fondamentales et sectorielles. Nous passons au crible des ratios clés tels que le P/E (Cours/Bénéfice), le rendement des flux de trésorerie disponibles (FCF Yield), les marges brutes et la croissance des revenus, le tout comparé aux moyennes sectorielles. Cela nous permet de privilégier les entreprises qui ont à la fois de beaux graphiques et des fondamentaux solides."
    },
    {
      question: "18. Pourquoi BOGASTOCK se concentre-t-il uniquement sur les marchés américains ?",
      answer: "Oui, notre plateforme est axée à 100 % sur les bourses américaines (NYSE, NASDAQ, AMEX). C'est sur ces marchés que l'on trouve la plus grande liquidité, la plus grande profondeur et les structures les plus adaptées au trading systématique et algorithmique. Tous nos critères de notation, nos coefficients et nos modèles d'IA ont été spécifiquement calibrés pour cette dynamique de marché."
    },
    {
      question: "19. Y a-t-il un risque de perdre de l'argent avec ce système ?",
      answer: "Oui, absolument. Sur les marchés financiers, toute promesse de gain garanti à 100 % est mensongère. Les taux de réussite historiques et les statistiques de BOGA AI reposent sur des données passées, ce qui ne garantit en rien que chaque transaction future sera gagnante. C'est pourquoi vous devez toujours gérer votre risque de façon rigoureuse et ne jamais engager tout votre capital sur une seule position."
    },
    {
      question: "20. Suis-je obligé d'utiliser un \"Stop Loss\" (Limite de Perte) ?",
      answer: "Oui, vous l'êtes impérativement ! La règle d'or de la philosophie BOGASTOCK est la suivante : \"On n'ouvre jamais une position sans Stop Loss.\" Le marché peut se retourner de manière totalement imprévue à tout moment. Le seul moyen de protéger votre capital contre des baisses majeures est de définir précisément votre perte maximale acceptable avant même d'entrer en position, et de vous y tenir. Établissez un plan, gardez une discipline de fer et laissez vos émotions en dehors de vos décisions de trading."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="fr" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Foire Aux Questions (FAQ)
          </h1>
          <p className="text-[#64748b] text-lg">
            Tout ce que vous devez savoir sur le fonctionnement de BOGASTOCK et BOGA AI.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-6 hover:border-[#3b82f6]/50 transition-colors">
              <h3 className="text-lg font-bold text-white mb-3 leading-snug">
                {faq.question}
              </h3>
              <div className="text-[#94a3b8] text-sm md:text-base leading-relaxed space-y-4">
                {faq.answer.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer locale="fr" />
    </div>
  );
}
