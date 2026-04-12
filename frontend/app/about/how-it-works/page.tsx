import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "AI Score Nasıl Hesaplanır? | BOGA AI Analiz Metodolojisi",
  description: "BOGA AI Score'un arkasındaki algoritmayı keşfedin. Momentum, volatilite, temel veriler ve yapay zeka analizinin nasıl birleşerek profesyonel borsa sinyalleri oluşturduğunu öğrenin.",
  alternates: {
    canonical: "https://bogastock.com/about/how-it-works",
  },
  openGraph: {
    title: "AI Score Nasıl Hesaplanır? | BOGA AI Analiz Metodolojisi",
    description: "BOGA AI Score'un arkasındaki algoritmayı keşfedin. Teknik ve temel verilerin nasıl işlendiğini öğrenin.",
    url: "https://bogastock.com/about/how-it-works",
  },
};

export default function HowItWorksPage() {
  const dataSets = [
    {
      title: "Momentum & Trend Gücü",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      description: "RSI, MACD ve EMA (20, 50, 200) ortalamalarını kullanarak hissenin trend yönünü ve gücünü ölçüyoruz. ADX göstergesi ile trendin kalıcılığını analiz ediyoruz.",
      color: "from-blue-500 to-cyan-400"
    },
    {
      title: "Volatilite & Risk Analizi",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      description: "Bollinger Bantları (Squeeze tespiti) ve ATR (Average True Range) verileriyle hissenin patlama potansiyelini ve risk seviyesini belirliyoruz.",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Hacim & Para Akışı",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: "RVOL (Görece Hacim) ve OBV (On-Balance Volume) kullanarak kurumsal para girişlerini ve 'akıllı para' hareketlerini takip ediyoruz.",
      color: "from-orange-500 to-yellow-400"
    },
    {
      title: "Temel Veriler & Sektör",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      description: "P/E (F/K) rasyosu, brüt kar marjı ve gelir büyümesi gibi verileri sektör ortalamalarıyla kıyaslayarak hissenin iskontosunu ölçüyoruz.",
      color: "from-green-500 to-emerald-400"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#64748b]">
          <Link href="/about" className="hover:text-[#3b82f6] transition-colors">Hakkımızda</Link>
          <span>/</span>
          <span className="text-white">AI Score Analizi</span>
        </nav>

        {/* Hero Section */}
        <div className="mb-16">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
            BOGA AI Score <span className="text-[#3b82f6]">Nasıl Hesaplanıyor?</span>
          </h1>
          <p className="text-lg text-[#94a3b8] leading-relaxed">
            BOGA AI, her işlem günü sabah 09:00'da (NY saatiyle) ABD borsalarındaki binlerce veriyi işleyerek her hisse için 0 ile 100 arasında bir puan üretir. Bu puan, karmaşık formüllerin ötesinde; teknik, temel ve duyumsal verilerin matematiksel bir sentezidir.
          </p>
        </div>

        {/* Score Components Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {dataSets.map((set, idx) => (
            <div key={idx} className="glass-card p-8 group hover:border-[#3b82f6]/30 transition-all">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${set.color} flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-500/10`}>
                {set.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{set.title}</h3>
              <p className="text-[#64748b] text-sm leading-relaxed">
                {set.description}
              </p>
            </div>
          ))}
        </div>

        {/* Weighted System Section */}
        <section className="mb-16 glass-card p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6]/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <h2 className="text-2xl font-bold text-white mb-6">Ağırlıklı Puanlama Modeli</h2>
          <div className="space-y-8">
            <p className="text-[#94a3b8] leading-relaxed">
              BOGA Master Score tek bir veriden oluşmaz. Günlük sinyallerin doğruluğunu artırmak için dinamik bir ağırlıklandırma kullanıyoruz:
            </p>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Teknik Analiz (Momentum & Trend)</span>
                  <span className="text-sm font-black text-[#3b82f6]">35%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#3b82f6]" style={{ width: '35%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Temel Analiz & Rasyolar</span>
                  <span className="text-sm font-black text-[#8b5cf6]">25%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#8b5cf6]" style={{ width: '25%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Hacim & Kurumsal Para Akışı</span>
                  <span className="text-sm font-black text-[#f59e0b]">20%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#f59e0b]" style={{ width: '20%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Sektör Performansı & Duyarlılık</span>
                  <span className="text-sm font-black text-[#22c55e]">20%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#22c55e]" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Interpretation */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Yapay Zeka Yorumu Nasıl Oluşuyor?</h2>
          <div className="prose prose-invert max-w-none text-[#94a3b8] leading-relaxed space-y-4">
            <p>
              Hesaplanan veriler ve puanlar, BOGA'nın özel olarak eğitilmiş finansal dil modellerine (Gemini AI) aktarılır. Yapay zeka, sadece rakamları değil; bu rakamların o hisse için ne anlama geldiğini analiz eder.
            </p>
            <p>
              Örneğin, RSI değeri 70 olan bir hisse her zaman "aşırı alım" değildir. Eğer sektörel bir ralli varsa ve hacim destekliyorsa, AI bunu bir "güçlü trend" olarak yorumlar. Bu bağlam kurma yeteneği, BOGA AI Score'u diğer basit algoritmalardan ayıran en büyük farktır.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="glass-card p-10 text-center">
          <h2 className="text-xl font-bold text-white mb-4">Verinin Gücünü Keşfedin</h2>
          <p className="text-[#64748b] text-sm mb-8">BOGA AI ile her gün güncellenen +500 ABD hissesinin analizine hemen ulaşın.</p>
          <Link 
            href="/"
            className="px-8 py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb] transition-all"
          >
            Sinyalleri Gör
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
