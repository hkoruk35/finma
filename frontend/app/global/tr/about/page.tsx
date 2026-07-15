import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGASTOCK Hakkında - Blue One Global Analysis - Günlük 6.000+ | AI Destekli ABD Hisse Senedi Analizi",
  description: "BOGASTOCK - Blue One Global Analysis, her gün 6.000'den fazla seçkin ABD hisse senedi ve ETF'i tarar, en yüksek potansiyele sahip adayları belirler ve ABD piyasasındaki en yüksek inanç düzeyine sahip fırsatlar için günlük AI destekli finansal analiz sunar.",
  alternates: {
    canonical: "https://bogastock.com/global/tr/about",
    languages: {
      "en-US": "https://bogastock.com/global/en/about",
      "es-ES": "https://bogastock.com/global/es/about",
      "fr-FR": "https://bogastock.com/global/fr/about",
      "pt-PT": "https://bogastock.com/global/pt/about",
      "tr-TR": "https://bogastock.com/global/tr/about",
    },
  },
  openGraph: {
    title: "BOGASTOCK Hakkında - Blue One Global Analysis - Günlük 6.000+ | AI Destekli ABD Hisse Senedi Analizi",
    description: "BOGASTOCK - Blue One Global Analysis, her gün 6.000'den fazla seçkin ABD hisse senedi ve ETF'i tarar, en yüksek potansiyele sahip adayları belirler ve ABD piyasasındaki en yüksek inanç düzeyine sahip fırsatlar için günlük AI destekli finansal analiz sunar.",
    url: "https://bogastock.com/global/tr/about",
  },
};

export default function AboutPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <div className="flex justify-end mb-6">
          <Link href="/global/en/about" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">ABD Hisse Senedi Piyasası İstihbaratı</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            Günlük Finansal Analiz.<br />
            <span className="text-[#3b82f6]">ABD Piyasaları İçin İnşa Edildi.</span>
          </h1>
          <p className="text-xl text-white max-w-2xl mx-auto leading-relaxed">
            BOGASTOCK - Blue One Global Analysis - Günlük 6.000+ hisse, tüm ABD hisse senedi evrenini her işlem gününde yüksek olasılıklı fırsatların odaklanmış bir kısa listesine dönüştüren özel, çok aşamalı bir hisse tarama ve puanlama sistemidir.
          </p>
        </div>

        {/* 3-Stage Process */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">BOGASTOCK Sistemi Nasıl Çalışır</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Stage 1 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6 text-2xl font-black">1</div>
              <h3 className="text-lg font-bold text-white mb-3">Günlük Evren Taraması</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                BOGASTOCK algoritması her gün NYSE, NASDAQ ve AMEX dahil tüm büyük borsalardaki <strong className="text-white">6.000'den fazla seçkin ABD hisse senedi ve ETFyi</strong> tarar; likidite, volatilite ve yapısal filtreler uygulayarak en işlem yapılabilir adayları belirler.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6 text-2xl font-black">2</div>
              <h3 className="text-lg font-bold text-white mb-3">Günlük Top 6.000+ İzleme Listesi</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Günlük taramadan sistem, günlük izleme için <strong className="text-white">6.000'den fazla yüksek öncelikli seçkin hisse senedi ve ETFyi</strong> seçer. Bu adaylar her sabah NY saatiyle 09:00'da güncel piyasa verileri, teknik göstergeler ve temel metriklerle yeniden değerlendirilir.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6 text-2xl font-black">3</div>
              <h3 className="text-lg font-bold text-white mb-3">En Yüksek İnanç Düzeyine Sahip Adaylar — Bireysel Olarak Puanlanır</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                BOGASTOCK puanlama motoru her günlük adayı sıralar ve en yüksek inanç düzeyine sahip kurulumları seçer. Her biri teknik, temel ve puan gerekçesini kapsayan, şablon değil hisseye özel bir AI analiz raporu alır.
              </p>
            </div>
          </div>
        </div>

        {/* Scoring System */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">BOGASTOCK Puanlama Sistemi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Çok Faktörlü Teknik Motor</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                BOGASTOCK Ana Puanı; RSI, MACD, bağıl hacim, EMA çapraz katları, ADX trend gücü ve Bollinger Band sıkışma yoğunluğu gibi teknik göstergelerin ağırlıklı bir karışımından hesaplanır — özellikle ABD hisse senedi momentum yapıları için geliştirilmiştir.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Temel ve Sektör Katmanı</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Her puan; F/K oranı sektör medyanına kıyasla, FCF verimi, brüt kâr marjları ve gelir büyüme momentumu gibi temel verilerle çapraz kontrol edilir. Sektör performans bağlamı, puanların güncel piyasa koşullarına göre her zaman bağıl — mutlak değil — olmasını sağlar.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Özel AI Yorumu</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Kısa listeye giren her hisse, BOGASTOCK motoru tarafından üretilen sade bir dilde analiz raporu alır. Rapor, belirli bir puanın <em>neden</em> verildiğini — genel ifadeler değil, hissenin kendi verilerine atıfla — açıklar; böylece her derecelendirmenin arkasındaki mantığı anlarsınız.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Beş Kademeli Puan Derecelendirmesi</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                BOGASTOCK puanları beş profesyonel kademeye ayrılır: <strong className="text-white">Yüksek İnanç</strong>, <strong className="text-white">Pozitif Eğilim</strong>, <strong className="text-white">Nötr Bekle</strong>, <strong className="text-white">Negatif Eğilim</strong> ve <strong className="text-white">Düşük Performans</strong> — belirsizlik olmadan kurumsal düzeyde netlik sunar.
              </p>
            </div>
          </div>
        </div>

        {/* Focus Statement */}
        <div className="glass-card p-10 text-center mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] rounded-t-2xl"></div>
          <h2 className="text-2xl font-bold text-white mb-4">%100 ABD Hisse Senedi Piyasalarına Odaklı</h2>
          <p className="text-white max-w-2xl mx-auto leading-relaxed mb-6">
            BOGASTOCK - Blue One Global Analysis - Günlük 6.000+ hisse, ABD hisse senedi piyasası için özel olarak inşa edilmiştir. Her algoritma, her ağırlık ve her puan kategorisi NYSE, NASDAQ ve ABD piyasa yapısına göre kalibre edilmiştir — ABD'ye uyarlanmış genel bir küresel model değil.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-bold uppercase tracking-widest">
            {["NYSE", "NASDAQ", "AMEX", "S&P 500", "NASDAQ 100", "Russell 2000"].map(ex => (
              <span key={ex} className="px-3 py-1.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded-full border border-[#3b82f6]/20">{ex}</span>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Misyonumuz</h2>
          <p className="text-white max-w-2xl mx-auto italic leading-relaxed">
            "Büyük fonların ve profesyonellerin arkasındaki analitik gücü, her seviyeden yatırımcı için erişilebilir kılıyoruz. Gelişmiş piyasa tarama ve puanlama teknolojimizle, ABD borsalarında doğru yatırımı bulmayı karmaşık bir süreç olmaktan çıkarıp günlük bir rutin haline getiriyoruz."
          </p>
        </div>

      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
