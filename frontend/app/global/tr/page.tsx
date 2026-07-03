import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ScreenshotBanner, JpmPreview } from "@/components/global/LandingBannerTr";

export const metadata: Metadata = {
  title: "BOGA AI — Blue One Global Analysis",
  description: "Yapay zeka destekli gerçek zamanlı hisse analizi. EMA/RSI sinyalleriyle Top 100 Tracker. Swing Trade Adayları. Saatlik güncelleme.",
  alternates: { canonical: "https://bogastock.com/global/tr" },
};

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Swing Trade Adayları",
    desc: "Her gün tüm kurulumlar ve senaryolar değerlendiriliyor, en iyi adaylar yapay zeka tarafından seçiliyor.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Top 100 Haftalık Takip",
    desc: "BOGA AI tarafından belirli kriterlerle saatlik güncellenen aktif takip listesi — 100 seçkin ABD hissesi.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
      </svg>
    ),
    title: "2026 Trend Hisseleri",
    desc: "Çip sektöründen Biyokimyaya kadar en önde gelen şirketlerin tema bazlı takibi ve sinyal analizi.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Kendini Geliştiren Finansal Analiz",
    desc: "Hiçbir yerde bulamayacağınız günlük kendini geliştiren sistemi ile Finansal Analiz, Swing Trade ve yatırımlarınız için tam otonom destek.",
  },
];

export default function TrLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} globalLocale="tr" />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">Canlı — Saatlik Güncelleme</span>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <Image
              src="/finmawave.png"
              alt="BOGA AI"
              width={64}
              height={64}
              className="rounded-2xl shadow-2xl shadow-blue-500/20"
            />
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              BOGA <span className="text-[#3b82f6]">AI</span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-4">
            <span className="text-white/80 font-semibold">Blue One Global Analysis</span> — ABD borsaları için tamamen finans üzerine çalışan yapay zeka tarafından seçilen, analiz edilen ve gerçek verilerle saatlik günlük hisse takibi yapan akıllı tam otonom sistem.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Link
              href="/global/tr/kayit"
              className="px-8 py-3.5 bg-[#3b82f6] text-white rounded-2xl font-black text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]"
            >
              <span className="block uppercase tracking-[0.15em]">Fırsatı Kaçırma — Üye Ol</span>
              <span className="block text-[10px] font-normal normal-case tracking-normal mt-0.5 text-white/80">
                İlk 3 ay 19 USD/ay · Sonraki aylar 39 USD/ay
              </span>
            </Link>
            <Link
              href="/global/tr/giris"
              className="px-8 py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-white/10 hover:text-white transition-all"
            >
              Giriş Yap
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/30">Üyeliğinizi istediğiniz zaman iptal edebilirsiniz</p>
        </section>

        {/* App Screenshots Banner */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <ScreenshotBanner />
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-black text-white tracking-tighter text-center mb-10">
            BOGA AI ile neler elde edersin
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 hover:border-[#3b82f6]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center mb-4 group-hover:bg-[#3b82f6]/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-black text-white mb-2">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* JPM Report Preview */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-[#3b82f6] text-xs font-black uppercase tracking-[0.2em] mb-1">Ücretsiz Rapor Örneği</div>
                <h3 className="text-white font-black text-lg">JPMorgan — Piyasa Analiz Raporu</h3>
                <p className="text-white/40 text-xs mt-1">Platformumuzun ürettiği rapor formatının gerçek bir örneği — tamamen ücretsiz indir.</p>
              </div>
              <a
                href="/jpm/jpm02072026.pdf"
                download="JPM_BOGA_AI_Rapor.pdf"
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[#3b82f6] text-white rounded-xl font-bold text-sm hover:bg-[#2563eb] transition-colors shadow-lg shadow-blue-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF İndir
              </a>
            </div>
            <JpmPreview />
          </div>
        </section>

        {/* CTA bottom */}
        <section className="max-w-5xl mx-auto px-4 pb-20 text-center">
          <div className="bg-gradient-to-br from-[#3b82f6]/10 via-[#0d1117] to-[#0a0e17] border border-[#3b82f6]/20 rounded-3xl px-8 py-12">
            <h2 className="text-3xl font-black text-white tracking-tighter mb-3">Bugün takibe başla</h2>
            <p className="text-white/40 text-sm mb-2 max-w-md mx-auto">
              İlk 3 ay sadece <span className="text-white font-bold">19 USD/ay</span> · Sonraki aylar <span className="text-white font-bold">39 USD/ay</span>
            </p>
            <p className="text-white/25 text-xs mb-8">İstediğiniz zaman iptal edebilirsiniz.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/global/tr/kayit"
                className="px-8 py-3.5 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all"
              >
                Fırsatı Kaçırma — Üye Ol
              </Link>
              <Link
                href="/global/tr/giris"
                className="px-8 py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-white/10 hover:text-white transition-all"
              >
                Giriş Yap
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
