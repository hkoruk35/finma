import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yasal Uyarı",
  alternates: {
    canonical: "https://bogastock.com/global/tr/disclaimer",
    languages: {
    en: "https://bogastock.com/global/en/disclaimer",
    es: "https://bogastock.com/global/es/disclaimer",
    fr: "https://bogastock.com/global/fr/disclaimer",
    id: "https://bogastock.com/global/id/disclaimer",
    pt: "https://bogastock.com/global/pt/disclaimer",
    tr: "https://bogastock.com/global/tr/disclaimer",
    "x-default": "https://bogastock.com/global/en/disclaimer",
    },
  },
};


export default function DisclaimerPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Yasal Uyarılar, Uyumluluk ve Sorumluluk Reddi Beyanı</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Teknik Analiz ve Karar Destek Platformu Beyanı (Yatırım Tavsiyesi Değildir)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis), yapay zeka ve kantitatif algoritma modelleriyle çalışan otomatik bir <strong className="text-white">teknik analiz ve karar destek platformudur</strong>. Sistemimiz, piyasada öne çıkan teknik fırsatları algoritmalarımızla tarayarak kullanıcılara analitik karar destek verileri sunar.
            </p>
            <p className="text-slate-300">
              BogaStock.com üzerinde sunulan tüm içerikler, grafikler, AI skoru değerlendirmeleri ve indikatör sinyalleri yalnızca genel bilgilendirme, teknik inceleme ve eğitim amacıyla sunulmaktadır. Platformumuz bünyesindeki hiçbir veri; yatırım tavsiyesi, portföy yöneticiliği, finansal danışmanlık ya da hukuki/vergisel bir öneri niteliği taşımamaktadır. <strong className="text-white">BogaStock.com</strong>, ABD Sermaye Piyasası Kurumu (SEC) kapsamında tescilli bir Yatırım Danışmanı (RIA - Registered Investment Adviser) veya Aracı Kurum (Broker-Dealer) olmadığı gibi, Türkiye Cumhuriyeti 6362 Sayılı Sermaye Piyasası Kanunu (SPK) ve AB finansal mevzuatları çerçevesinde yetkilendirilmiş bir portföy yönetim şirketi de değildir. Platformumuz kullanıcılar ile hiçbir şekilde danışman-müteri veya mali mütevelli ilişkisi kurmaz. Yatırım kararlarınız öncesinde yetkili ve lisanslı bir finansal danışmandan destek almanız tavsiye edilir.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Küresel Piyasalar Kapsamı ve Yüksek Risk Bildirimi
            </h2>
            <p className="mb-4 text-slate-300">
              Küresel sermaye piyasalarında — <strong className="text-white">ABD (NYSE, NASDAQ, S&P 500, Dow, Russell 2000)</strong>, <strong className="text-white">Avrupa Borsaları (DAX, FTSE 100, CAC40, IBEX35, STOXX50)</strong>, <strong className="text-white">Asya Borsaları (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong> ve <strong className="text-white">Latin Amerika Borsaları (S&P Latam 40, S&P Latam BMI, IBOVESPA, IGCX, IBXX)</strong> ile Döviz (Forex), Emtia ve Kripto para piyasalarında — işlem yapmak yüksek derecede volatilite ve risk içerir.
            </p>
            <p className="text-slate-300">
              Algoritmalarımız tarafından sağlanan istatistiksel modeller ve teknik analiz çıktıları geçmiş veri setlerine dayanır. Geçmiş dönem performansları ve matematiksel modeller, gelecekteki sonuçların veya başarının bir garantisi olarak kabul edilemez. BogaStock.com verilerine dayanarak alacağınız tüm ticari kararlar ve bu kararların finansal/hukuki sonuçları münhasıran kullanıcının şahsi sorumluluğundadır.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Avrupa Birliği (AB) Yasaları ve Uluslararası Mevzuata Uyum
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong>, Avrupa Birliği (AB) finansal piyasa düzenlemelerini, <strong className="text-white">ESMA (Avrupa Menkul Kıymetler ve Piyasalar Otoritesi)</strong> ilkelerini, <strong className="text-white">MiFID II (Finansal Araç Pazarları Direktifi)</strong> bilgilendirme standartlarını ve <strong className="text-white">MAR (AB Piyasa Suistimali Yönetmeliği - Regulation EU No 596/2014)</strong> esaslarını referans alarak faaliyet göstermektedir.
            </p>
            <p className="text-slate-300">
              Platformumuz hiçbir şekilde piyasa manipülasyonu, insider trading (içeriden öğrenenlerin ticareti) teşviki veya lisanssız kişiselleştirilmiş portföy yönlendirmesi yapmaz. Algoritmik tarama sistemimiz tarafsız, programatik ve nesnel teknik indikatör kurallarına dayanmaktadır.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Veri Gizliliği ve Standartları (GDPR, KVKK ve CCPA)
            </h2>
            <p className="text-slate-300">
              Kullanıcılarımızın veri gizliliği <strong className="text-white">BogaStock.com</strong> için önceliklidir. Platformumuz, Avrupa Birliği Genel Veri Koruma Tüzüğü (<strong className="text-white">GDPR</strong>), Türkiye Cumhuriyeti 6698 Sayılı Kişisel Verilerin Korunması Kanunu (<strong className="text-white">KVKK</strong>) ve Kaliforniya Tüketici Gizliliği Yasası (<strong className="text-white">CCPA</strong>) gibi ilgili mevzuata uygun şekilde faaliyet göstermeyi hedefler. Kişisel verileriniz kesinlikle üçüncü şahıslara veya veri aracılarına satılmaz veya kiralanmaz.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Bağımsızlık ve Tarafsızlık İlkesi
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> üzerinde yer alabilecek reklam veya sponsorluk yayınları, yapay zeka algoritma motorumuzun analitik çıktıları üzerinde doğrudan veya dolaylı hiçbir etkiye sahip değildir. Tüm karar destek taramaları tamamen bağımsız ve nesnel matematiksel algoritmalar tarafından üretilir.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Kullanıcı Beyanı ve Taahhüdü</h2>
            <p className="text-xs text-slate-400">
              BogaStock.com platformuna erişim sağlayarak veya üye olarak yukarıda açıklanan yasal uyarıları, AB yasaları ve uluslararası mevzuat sınırlandırmalarını okuduğunuzu ve karar destek hizmetlerinin yatırım tavsiyesi olmadığını kabul etmiş sayılırsınız.
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
