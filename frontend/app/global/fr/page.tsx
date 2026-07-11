import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import GlobalReachBanner from "@/components/global/GlobalReachBanner";

export const metadata: Metadata = {
  title: "BOGA AI — Analyse Boursière Alimentée par l'IA",
  description: "Accédez au suivi Top 100, aux candidats swing trade et à l'analyse technique de BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/fr" },
};

export default function GlobalFrPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} globalLocale="fr" />
      <GlobalReachBanner lang="fr" />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            BOGA AI
          </h1>
          <p className="text-lg text-[#8b949e] mb-12">
            Plateforme de suivi boursier en temps réel avec analyse technique et signaux de trading.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/global/fr/login"
              className="px-8 py-3 bg-[#3b82f6] text-white font-bold rounded-lg hover:bg-[#2563eb] transition-colors"
            >
              Se Connecter
            </Link>
            <Link
              href="/global/fr/register"
              className="px-8 py-3 border border-[#3b82f6] text-[#3b82f6] font-bold rounded-lg hover:bg-[#3b82f6]/10 transition-colors"
            >
              Créer un Compte
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 border border-[#30363d] rounded-lg">
              <h3 className="text-white font-bold mb-3">Top 100 Tracker</h3>
              <p className="text-[#8b949e] text-sm">
                Suivi en temps réel de 100 actions avec actualisations horaires et signaux techniques.
              </p>
            </div>
            <div className="p-6 border border-[#30363d] rounded-lg">
              <h3 className="text-white font-bold mb-3">Swing Trading</h3>
              <p className="text-[#8b949e] text-sm">
                Candidats de swing trade quotidiens sélectionnés par des critères algorithimques.
              </p>
            </div>
            <div className="p-6 border border-[#30363d] rounded-lg">
              <h3 className="text-white font-bold mb-3">Analyse Technique</h3>
              <p className="text-[#8b949e] text-sm">
                Indicateurs EMA, RSI, motifs de chandelles et analyses détaillées pour chaque action.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
