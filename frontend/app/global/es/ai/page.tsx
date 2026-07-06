import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

export const metadata: Metadata = {
  title: "BOGA AI — Análisis Profundo",
  description: "Pregunta a BOGA AI para obtener un análisis bursátil profundo basado en datos: técnicos, pronóstico, actividad de insiders, noticias y consenso de analistas.",
  alternates: { canonical: "https://bogastock.com/global/es/ai" },
};

export default function EsAIPage() {
  return <AIContainer lang="es" locale="es" />;
}
