import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { getSssConfig } from "@/lib/sssConfig";

export const metadata: Metadata = {
  title: "FAQ",
  alternates: { canonical: "https://bogastock.com/global/pt/Perguntas_Frequentes" }
};

export default async function FAQPage() {
  const config = await getSssConfig("pt");

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0e17] items-center justify-center text-white">
        Config not found for pt.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="pt" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            {config.title}
          </h1>
          <p className="text-[#64748b] text-lg">
            {config.description}
          </p>
        </div>

        <div className="space-y-6">
          {config.faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-6 hover:border-[#3b82f6]/50 transition-colors">
              <h3 className="text-lg font-medium text-white mb-3 leading-snug">
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

      <Footer locale="pt" />
    </div>
  );
}
