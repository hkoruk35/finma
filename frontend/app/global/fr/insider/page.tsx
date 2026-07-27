import { Metadata } from "next";
import { getTopInsiderBuyers } from "@/lib/insider-data";
import { copy, Locale } from "@/lib/i18n/copy";
import InsiderTransactionGrid from "@/components/public/InsiderTransactionGrid";

export const metadata: Metadata = {
  title: "Activité de Transactions de Mandataires Sociaux | BOGASTOCK",
  description: "Dépôts du Formulaire 4 de la SEC - Suivi des transactions de mandataires sociaux.",
};

export const revalidate = 3600;

export default async function InsiderPage() {
  const locale: Locale = "fr";
  const t = copy[locale];
  const insiderT = t.insider || {};

  const topBuyers = await getTopInsiderBuyers(30, 50);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{insiderT.title || "Activité de Transactions de Mandataires Sociaux"}</h1>
          <p className="text-slate-400 text-lg">{insiderT.subtitle || "Dépôts du Formulaire 4 de la SEC - 90 Derniers Jours"}</p>
          <p className="text-slate-500 text-sm mt-4">
            Suivez les transactions des cadres et mandataires sociaux. Les données sont mises à jour quotidiennement depuis SEC EDGAR.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {topBuyers.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
            <p className="text-slate-400">{insiderT.noData || "Aucune transaction trouvée"}</p>
          </div>
        ) : (
          <InsiderTransactionGrid data={topBuyers} locale={locale} />
        )}
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 border-t border-slate-800/50">
        <div className="space-y-2">
          <p>
            <strong>Source des Données :</strong> {insiderT.dataSource || "Dépôts du Formulaire 4 de la SEC EDGAR"}
          </p>
          <p>
            <strong>Fréquence de Mise à Jour :</strong> Quotidienne, traitée après la fermeture du marché.
          </p>
          <p>
            <strong>Seuil Minimum :</strong> Seules les transactions avec 1.000+ actions sont affichées.
          </p>
          <p>
            <strong>Clause de Non-Responsabilité :</strong> Ces informations sont fournies à titre éducatif uniquement. Ce n'est pas un conseil en investissement.
          </p>
        </div>
      </div>
    </main>
  );
}
