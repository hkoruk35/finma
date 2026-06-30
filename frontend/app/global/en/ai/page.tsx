import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

export const metadata: Metadata = {
  title: "BOGA AI — Deep Analysis",
  description: "Ask BOGA AI for deep, data-driven stock analysis: technicals, forecast, insider activity, news and analyst consensus.",
  alternates: { canonical: "https://bogastock.com/global/en/ai" },
};

export default function EnAIPage() {
  return <AIContainer lang="en" />;
}
