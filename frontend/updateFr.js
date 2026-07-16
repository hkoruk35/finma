const fs = require('fs');
const path = './landing-config.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

if (!data.fr) {
  data.fr = JSON.parse(JSON.stringify(data.en));
}

data.fr.hero.badge = "En Direct — Mises à jour horaires";
data.fr.hero.description = "Analyse et sélection d'actions en temps réel. Sélectionnées, analysées et suivies chaque heure par un système intelligent autonome.";
data.fr.cta_primary.text = "Essai Gratuit de 7 Jours";
data.fr.cta_primary.subtext = "Carte requise • Non facturé pendant l'essai";
data.fr.cta_secondary.text = "Se Connecter";

data.fr.screenshots[0].label = "Accueil — Résumé en Direct";
data.fr.screenshots[0].desc = "Résumé horaire Swing et Tendance avec bannière de performance";
data.fr.screenshots[0].src = "/screenshots/fr4.png"; // based on user images, we will copy them and rename properly to fr1..fr4, wait let me just use fr1..fr4 exactly as they are. User has fr4 as home, fr1 as swing candidates, fr2 as watchlist, fr3 as performance. I will map them directly.

data.fr.screenshots[0].src = "/screenshots/fr1.png";
data.fr.screenshots[1].src = "/screenshots/fr2.png";
data.fr.screenshots[2].src = "/screenshots/fr3.png";
data.fr.screenshots[3].src = "/screenshots/fr4.png";

data.fr.features[0].title = "Candidats Swing Trade";
data.fr.features[0].desc = "Chaque configuration est évaluée quotidiennement — l'IA choisit les meilleurs candidats pour vous.";

data.fr.features[1].title = "Des Décisions Plus Claires";
data.fr.features[1].desc = "Vous prendrez des décisions plus facilement avec moins d'actions, en vous concentrant uniquement sur les meilleures opportunités choisies par BOGASTOCK.";

data.fr.features[2].title = "Actions Tendances 2026";
data.fr.features[2].desc = "Suivi thématique des entreprises leaders, des puces à la biotechnologie, avec analyse des signaux.";

data.fr.jpm.badge = "Exemple de Rapport Gratuit";
data.fr.jpm.title = "Format PDF de la Fiche Technique de BOGASTOCK";
data.fr.jpm.description = "Un exemple réel du format de rapport que notre plateforme produit — entièrement gratuit à télécharger.";
data.fr.jpm.pdf_label = "Télécharger l'Exemple";

data.fr.bottom_cta.title = "Commencez gratuitement aujourd'hui";
data.fr.bottom_cta.description = "Rejoignez le groupe de traders utilisant <strong>BOGASTOCK</strong> pour des résultats cohérents et basés sur les données.";
data.fr.bottom_cta.note = "7 jours gratuits • Annulation à tout moment";

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log("Created/Updated FR config");
