import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

export const metadata: Metadata = {
  title: "BOGA AI — Análise Profunda",
  description: "Pergunte à BOGA AI para obter uma análise de ações profunda baseada em dados: técnicos, previsão, atividade de insiders, notícias e consenso de analistas.",
  alternates: { canonical: "https://bogastock.com/global/pt/ai" },
};

export default function PtAIPage() {
  return <AIContainer lang="pt" locale="pt" />;
}
