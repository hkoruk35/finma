import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "https://bogastock.com/global/tr/terms" }
};


export default function TermsPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Kullanım Şartları ve Hizmet Sözleşmesi</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Şartların Kabulü ve Kurumsal Beyan
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> platformuna, web sitesine veya mobil uygulamalarına erişim sağlayarak veya üyelik oluşturarak işbu Kullanım Şartları ve Hizmet Sözleşmesi hükümlerini okuduğunuzu, anladığınızı ve bunlarla hukuken bağlı olmayı kabul etmiş olursunuz.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis), gelişmiş yapay zeka modelleri ve kantitatif veri algoritmaları ile çalışan otomatik bir <strong className="text-white">teknik analiz ve karar destek platformudur</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Hizmet Kapsamı ve Yatırım Tavsiyesi Muafiyeti
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong>, piyasadaki öne çıkan teknik fırsatları algoritmalarıyla tarayarak kullanıcılara genel bilgilendirme, istatistiksel modelleme ve analitik karar destek verileri sunar. 
            </p>
            <p className="text-slate-300">
              Platform bünyesinde yayınlanan hiçbir grafik, indikatör sinyali, AI skoru veya teknik analiz çıktısı <strong className="text-white">yatırım tavsiyesi, portföy yöneticiliği veya finansal danışmanlık değildir</strong>. BogaStock.com, ABD SPK (SEC) nezdinde tescilli bir Yatırım Danışmanı (RIA) veya Aracı Kurum olmadığı gibi, Türkiye Cumhuriyeti 6362 Sayılı SPK veya AB yetkili makamları çerçevesinde lisanslı bir finansal danışmanlık kuruluşu değildir. Kullanıcılar ile hiçbir şekilde danışmanlık veya mütevelli ilişkisi tesis edilmez.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Küresel Piyasalar ve AB Yasaları (ESMA, MiFID II, MAR) Uyum Beyanı
            </h2>
            <p className="mb-4 text-slate-300">
              Platformumuz küresel finansal piyasaları kapsar: <strong className="text-white">ABD Piyasaları (NYSE, NASDAQ, S&P 500, Dow, Russell)</strong>, <strong className="text-white">Avrupa Borsaları (DAX, FTSE 100, CAC40, STOXX50)</strong>, <strong className="text-white">Asya Borsaları (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong>, <strong className="text-white">Latin Amerika Borsaları (S&P Latam 40, IBOVESPA)</strong> ile Döviz, Emtia ve Kripto borsaları.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong>; Avrupa Birliği (AB) finansal düzenleme direktifleri (<strong className="text-white">ESMA</strong>, <strong className="text-white">MiFID II</strong>) ve <strong className="text-white">AB Piyasa Suistimali Yönetmeliği (MAR - Regulation EU No 596/2014)</strong> esaslarına tam uyum gözetilerek işletilir. Sistemimiz piyasa manipülasyonu veya yetkisiz portföy yönlendirmesi içermez.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Kullanıcı Hesap Güvenliği ve Fikri Mülkiyet Kısıtlamaları
            </h2>
            <p className="mb-4 text-slate-300">
              Oluşturulan kullanıcı hesapları kişiye özeldir ve üçüncü kişilerle paylaşılamaz. Kullanıcılar hesap erişim şifrelerinin güvenliğinden kendileri sorumludur.
            </p>
            <p className="text-slate-300">
              BogaStock.com bünyesindeki telif hakları, yazılım kodları, algoritma mimarisi, AI skorlama motoru verileri ve tasarım bileşenleri firmamıza aittir. Yazılı izin olmaksızın platform verilerinin botlar/scraping araçlarıyla çekilmesi, kopyalanması, otomatik olarak toplanması veya ticari amaçla yeniden dağıtılması yasaktır.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Veri Gizliliği (GDPR, KVKK ve CCPA)
            </h2>
            <p className="text-slate-300">
              Kullanıcı verileri Avrupa Birliği Genel Veri Koruma Tüzüğü (<strong className="text-white">GDPR</strong>), Türkiye Cumhuriyeti 6698 Sayılı Kişisel Verilerin Korunması Kanunu (<strong className="text-white">KVKK</strong>) ve Kaliforniya Tüketici Gizliliği Yasası (<strong className="text-white">CCPA</strong>) standartlarına tam uyum içinde işlenir. BogaStock.com kişisel verileri hiçbir üçüncü tarafa satmaz veya satılık veri olarak kiralamaz.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              6. Sorumluluk Sınırlaması ve Hizmet Değişiklikleri
            </h2>
            <p className="text-slate-300">
              Finansal piyasalarda işlem yapmak yüksek derecede volatilite ve risk taşır. BogaStock.com analitik karar destek verilerinin kullanımı sonucunda alınacak tüm ticari kararlar ve doğabilecek finansal/hukuki kayıplar münhasıran kullanıcının sorumluluğundadır. BogaStock.com hizmet özelliklerini veya şartlarını önceden haber vermeksizin güncelleme hakkını saklı tutar.
            </p>
          </section>

          {/* Section 7 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Hukuki Yürürlük</h2>
            <p className="text-xs text-slate-400">
              BogaStock.com platformunu kullanmaya devam ederek yukarıdaki şartları ve yasal çerçeveyi kabul etmiş olursunuz.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Son Güncelleme: 4 Ağustos 2026 | BogaStock.com Teknik Analiz ve Karar Destek Platformu
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
