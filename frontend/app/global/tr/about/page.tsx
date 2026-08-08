import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
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
    title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
    url: "https://bogastock.com/global/tr/about",
  },
};

export default function AboutPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Hikayemiz</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            Bir Otonom Araç Fikrinden<br />
            <span className="text-[#3b82f6]">Bugünün BogaStock'una.</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            BogaStock, bir gecede ortaya çıkmadı. Kaliforniya'da otonom araçlar üzerine çalışan küçük bir ekibin, yıllar içinde biriktirdiği veri işleme deneyimini finans dünyasına taşımasıyla doğdu.
          </p>
        </div>

        {/* 2018 - Origin */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#3b82f6]">2018</span>
            <h2 className="text-xl font-bold text-white">Kaliforniya'da Bir Başlangıç</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            BogaStock'un hikayesi aslında finansla değil, otonom araçlarla başlıyor. 2018 yılında Kaliforniya'da kurulan AFK Data Sistemleri (AFK DaSYS), ilk yıllarında kendi kendine giden araçlar için veri işleme ve karar destek sistemleri geliştirdi. Bugün, 2025 itibarıyla bu bilgi birikimi ABD genelinde 48 eyalette, 1.000'den fazla şehirde gerçek zamanlı Smart City simülasyonlarını mümkün kılıyor.
          </p>
        </div>

        {/* 2021 - BogaStock born */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#8b5cf6]">2021</span>
            <h2 className="text-xl font-bold text-white">Yollar Finansla Kesişiyor</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            2021 yılında AFK DaSYS ekibi, şehirlerin trafiğini okumak için geliştirdiği yoğun veri işleme deneyimini bambaşka bir alana, finans piyasalarına yöneltmeye karar verdi. Aynı disiplin — büyük hacimli veriyi anlamlandırıp anlık kararlara dönüştürme — burada da işe yarayabilirdi. Bu vizyonla BogaStock.com hayata geçti: amaç, ABD borsalarındaki binlerce hisseyi takip etmeyi karmaşık bir uğraş olmaktan çıkarıp herkes için anlaşılır hale getirmekti.
          </p>
        </div>

        {/* Continuous learning */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
          <h2 className="text-xl font-bold text-white mb-4">Hiç Durmayan Bir Öğrenme Süreci</h2>
          <p className="text-white/70 leading-relaxed">
            BogaStock'un yapay zekâsı, kurulduğu günden bugüne aynı kalmadı ve kalmayacak. Sistem her yeni analiz veya işlem modelini devreye aldığında, kendi içinde bir yeniden öğrenme sürecinden geçiriyor — yani platform ne kadar çok kullanılırsa, o kadar çok tecrübe kazanıyor ve zamanla daha isabetli hale geliyor. Bu gelişim, Smart City ve otonom araç teknolojileri üzerine çalışan kardeş bir yapay zekâ sistemi olan{" "}
            <a href="https://www.afknexro.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">AFK Nexro AI</a>
            {" "}ile birlikte, ortak bir Ar-Ge kültürü içinde ilerliyor.
          </p>
        </div>

        {/* Today */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">Bugün BogaStock</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">70+</div>
              <p className="text-white/70 text-sm leading-relaxed">ülkede kullanıcılara ulaşıyoruz, sistemimiz kesintisiz 7/24 çalışıyor.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">6.000+</div>
              <p className="text-white/70 text-sm leading-relaxed">ABD hisse senedi ve ETF'ini her gün tarayıp değerlendiriyoruz.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">5 Dil</div>
              <p className="text-white/70 text-sm leading-relaxed">web sitemizde; kendi veritabanlarımız ve veri merkezlerimiz üzerinden hizmet veriyoruz.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">30+ Dil</div>
              <p className="text-white/70 text-sm leading-relaxed">Boga Copilot ile — günlük hayata uygun, doğal bir dille sohbet edebiliyoruz.</p>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-medium text-white mb-4">Neye İnanıyoruz</h2>
          <p className="text-white/80 max-w-2xl mx-auto italic leading-relaxed">
            "Algoritmaların yönettiği bir dünyada, verinin doğru işlenmesi kadar onu anlaşılır kılmak da önemli. BogaStock olarak amacımız, karmaşık piyasa verisini herkesin anlayabileceği net bir yola dönüştürüp, kullanıcımızın kendi kararını rahatça verebilmesine yardımcı olmak."
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
