import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { getAboutConfig } from "@/lib/aboutConfig";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "https://bogastock.com/global/en/about" }
};


export default async function AboutPage() {
  const config = await getAboutConfig("en");

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0d1117] items-center justify-center text-white">
        Config not found for en.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">{config.hero.subtitle}</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            <span dangerouslySetInnerHTML={{ __html: config.hero.title_html }} />
            <span className="text-[#3b82f6]">{config.hero.title_highlight}</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed mb-6">
            {config.hero.description}
          </p>
          {config.hero.image_url && (
            <div className="w-full relative h-64 md:h-96 rounded-lg overflow-hidden border border-gray-800">
              <img src={config.hero.image_url} alt="Hero" className="object-cover w-full h-full" />
            </div>
          )}
        </div>

        {/* Sections */}
        {config.sections.map((sec, idx) => (
          <div key={idx} className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${sec.gradient}`}></div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-white">{sec.title}</h2>
            </div>
            <p className="text-white/70 leading-relaxed mb-4">
              {sec.description}
            </p>
            {sec.image_url && (
              <div className="w-full relative h-48 md:h-64 rounded-lg overflow-hidden border border-gray-800 mt-6">
                <img src={sec.image_url} alt={sec.title} className="object-cover w-full h-full" />
              </div>
            )}
          </div>
        ))}

        {/* Today Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">{config.stats.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {config.stats.items.map((stat, idx) => (
              <div key={idx} className="glass-card p-6">
                <div className="text-3xl font-black text-[#3b82f6] mb-2">{stat.number}</div>
                <p className="text-white/70 text-sm leading-relaxed">{stat.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-medium text-white mb-4">{config.mission.title}</h2>
          <p className="text-white/80 max-w-2xl mx-auto italic leading-relaxed mb-6">
            {config.mission.description}
          </p>
          {config.mission.image_url && (
            <div className="w-full relative h-48 md:h-64 rounded-lg overflow-hidden border border-gray-800 mt-6">
              <img src={config.mission.image_url} alt="Mission" className="object-cover w-full h-full" />
            </div>
          )}
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
