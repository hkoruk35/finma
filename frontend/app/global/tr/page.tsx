import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { ScreenshotBanner, JpmPreview } from "@/components/global/LandingBannerTr";
import { getLandingConfigFromDB } from "@/lib/landingConfig";
import { ICON_MAP } from "@/components/global/LandingIcons";
import GlobalReachBanner from "@/components/global/GlobalReachBanner";
import ChartCarouselTr from "@/components/global/ChartCarouselTr";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BOGASTOCK — Blue One Global Analysis",
  description: "Yapay zeka destekli gerçek zamanlı hisse analizi. EMA/RSI sinyalleriyle Swing Trade Adayları. Saatlik güncelleme.",
  alternates: { canonical: "https://bogastock.com/global/tr" },
};

export default async function TrLandingPage() {
  const cfg = await getLandingConfigFromDB("tr");
  if (!cfg) return null;

  const { hero, cta_primary, cta_secondary, cta_note, features, jpm, bottom_cta } = cfg;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <GlobalReachBanner lang="tr" />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">{hero.badge}</span>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <Image src="/finmawave.png" alt="BOGASTOCK" width={64} height={64} className="rounded-2xl shadow-2xl shadow-blue-500/20" />
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              BOGA<span className="text-[#3b82f6]">STOCK</span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-4">
            <span className="text-white/80 font-semibold">{hero.description_bold}</span> — {hero.description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Link href={cta_primary.href} className="px-8 py-3.5 bg-[#3b82f6] text-white rounded-2xl font-black text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]">
              <span className="block uppercase tracking-[0.15em]">{cta_primary.text}</span>
              {cta_primary.subtext && <span className="block text-[10px] font-normal normal-case tracking-normal mt-0.5 text-white/80">{cta_primary.subtext}</span>}
            </Link>
            <Link href={cta_secondary.href} className="px-8 py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-white/10 hover:text-white transition-all">
              {cta_secondary.text}
            </Link>
          </div>
          {cta_note && <p className="mt-4 text-xs text-white/30">{cta_note}</p>}
        </section>

        {/* Screenshot Banner */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <ScreenshotBanner lang="tr" />
        </section>

        {/* Chart Carousel */}
        <section className="max-w-5xl mx-auto px-4 pb-10">
          <ChartCarouselTr />
        </section>

        {/* Features */}
        {features.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 pb-20">
            <h2 className="text-2xl font-black text-white tracking-tighter text-center mb-10">BOGASTOCK ile neler elde edersin</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((f) => {
                const Icon = ICON_MAP[f.icon] ?? ICON_MAP["bolt"];
                return (
                  <div key={f.title} className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 hover:border-[#3b82f6]/30 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center mb-4 group-hover:bg-[#3b82f6]/20 transition-colors">
                      <Icon />
                    </div>
                    <h3 className="text-sm font-black text-white mb-2">{f.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* JPM Report Preview */}
        {jpm.enabled && (
          <section className="max-w-5xl mx-auto px-4 pb-20">
            <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="text-[#3b82f6] text-xs font-black uppercase tracking-[0.2em] mb-1">{jpm.badge}</div>
                  <h3 className="text-white font-black text-lg">{jpm.title}</h3>
                  <p className="text-white/40 text-xs mt-1">{jpm.description}</p>
                </div>
                {jpm.pdf && (
                  <a href={jpm.pdf} download className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[#3b82f6] text-white rounded-xl font-bold text-sm hover:bg-[#2563eb] transition-colors shadow-lg shadow-blue-500/20">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {jpm.pdf_label}
                  </a>
                )}
              </div>
              <JpmPreview lang="tr" />
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <section className="max-w-5xl mx-auto px-4 pb-20 text-center">
          <div className="bg-gradient-to-br from-[#3b82f6]/10 via-[#0d1117] to-[#0a0e17] border border-[#3b82f6]/20 rounded-3xl px-8 py-12">
            <h2 className="text-3xl font-black text-white tracking-tighter mb-3">{bottom_cta.title}</h2>
            <p className="text-white/40 text-sm mb-2 max-w-md mx-auto" dangerouslySetInnerHTML={{ __html: bottom_cta.description }} />
            {bottom_cta.note && <p className="text-white/25 text-xs mb-8">{bottom_cta.note}</p>}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={cta_primary.href} className="px-8 py-3.5 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all">
                {cta_primary.text}
              </Link>
              <Link href={cta_secondary.href} className="px-8 py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-white/10 hover:text-white transition-all">
                {cta_secondary.text}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
