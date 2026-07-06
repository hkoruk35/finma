import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

export const metadata: Metadata = {
  title: "BOGA AI — Analyse Approfondie",
  description: "Demandez à BOGA AI une analyse boursière approfondie et pilotée par les données : techniques, prévisions, activité des initiés, actualités et consensus des analystes.",
  alternates: { canonical: "https://bogastock.com/global/fr/ai" },
};

export default function FrAIPage() {
  return <AIContainer lang="fr" locale="fr" />;
}
