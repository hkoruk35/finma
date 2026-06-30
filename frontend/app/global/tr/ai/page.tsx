import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

export const metadata: Metadata = {
  title: "BOGA AI — Derin Analiz",
  description: "BOGA AI'dan veri odaklı derin hisse analizi: teknik göstergeler, forecast, insider hareketleri, haberler ve analist konsensüsü.",
  alternates: { canonical: "https://bogastock.com/global/tr/ai" },
};

export default function TrAIPage() {
  return <AIContainer lang="tr" locale="tr" />;
}
