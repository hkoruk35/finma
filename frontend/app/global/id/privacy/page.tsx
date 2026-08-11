import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "https://bogastock.com/global/tr/privacy" }
};


export default function PrivacyPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Gizlilik Politikası ve Global Veri Güvenliği Standartları</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Veri Güvenliği Yaklaşımımız ve Taahhüdümüz
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis), yapay zeka tabanlı algoritmalarla çalışan bir <strong className="text-white">teknik analiz ve karar destek platformudur</strong>. Kullanıcılarımızın veri gizliliği ve bilgi güvenliği, kurumsal mimarimizin merkezinde yer alır.
            </p>
            <p className="text-slate-300">
              Sistemimiz; Google Veri Güvenliği İlkeleri doğrultusunda <strong className="text-white">Veri Minimizasyonu (Sadece gerekli verinin toplanması)</strong> ve <strong className="text-white">Tasarım Gereği Gizlilik (Privacy by Design)</strong> prensiplerine tam bağlılıkla işletilmektedir.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Uluslararası Mevzuat Uyum Çerçevesi (ABD, AB, Latin Amerika, Asya ve Türkiye)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong>, hizmet sunduğu tüm coğrafyalardaki veri koruma kanunlarına ve uluslararası veri güvenliği standartlarına tam uyum sağlar:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">Avrupa Birliği (AB):</strong> AB Genel Veri Koruma Tüzüğü (<strong className="text-white">GDPR - General Data Protection Regulation</strong>) ve ePrivacy Direktifi.</li>
              <li><strong className="text-white">Amerika Birleşik Devletleri (ABD):</strong> Kaliforniya Tüketici Gizliliği Yasası (<strong className="text-white">CCPA / CPRA</strong>) ve eyalet veri koruma standartları.</li>
              <li><strong className="text-white">Latin Amerika:</strong> Brezilya Genel Veri Koruma Kanunu (<strong className="text-white">LGPD</strong>), Meksika (<strong className="text-white">LFPDPPP</strong>) ve Arjantin (<strong className="text-white">Ley 25.326</strong>) mevzuatları.</li>
              <li><strong className="text-white">Asya Pasifik:</strong> Güney Kore (<strong className="text-white">PIPA</strong>), Japonya (<strong className="text-white">APPI</strong>), Singapur/Malezya (<strong className="text-white">PDPA</strong>), Hindistan (<strong className="text-white">DPDP</strong>) ve Endonezya (<strong className="text-white">PDP Law</strong>).</li>
              <li><strong className="text-white">Türkiye:</strong> T.C. 6698 Sayılı Kişisel Verilerin Korunması Kanunu (<strong className="text-white">KVKK</strong>).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Toplanan Veriler ve Kullanım Amaçları
            </h2>
            <p className="mb-4 text-slate-300">
              Google ve Supabase güvenli kimlik doğrulama altyapısı (OAuth 2.0) üzerinden yalnızca hesabın oluşturulması ve oturum güvenliğinin sağlanması amacıyla asgari düzeyde kişisel veri (e-posta adresi, ad-soyad, profil resmi) işlenir.
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">Hesap Yönetimi:</strong> Güvenli oturum açma, abonelik ve kişisel izleme listesi (Watchlist) tercihlerinin saklanması.</li>
              <li><strong className="text-white">Analitik ve Güvenlik:</strong> Anonim IP logları ile siber saldırılara karşı sistem güvenliğinin sağlanması.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Veri Satışının Yasağı ve Üçüncü Taraf Paylaşım İlkesi
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com, kullanıcıların kişisel verilerini kesinlikle üçüncü kişilere satmaz, kiralamaz veya veri komisyoncularıyla (data brokers) pazarlamaz.</strong> Verileriniz yalnızca güvenli altyapı hizmet sağlayıcılarımız (Google Cloud, Supabase) bünyesinde şifreli olarak işlenir.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Şifreleme ve Altyapı Güvenliği Standartları
            </h2>
            <p className="text-slate-300">
              Tüm veri iletimleri uçtan uca <strong className="text-white">TLS 1.3 / SSL 256-bit</strong> yüksek seviyeli şifreleme protokolleriyle korunur. Veritabanı katmanında <strong className="text-white">AES-256</strong> veri depolama şifrelemesi ve çift faktörlü erişim kontrolü uygulanır.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              6. Kullanıcı Hakları ve Unutulma Hakkı (Data Rights & Deletion)
            </h2>
            <p className="text-slate-300">
              Tüm kullanıcılarımız; verilerini görüntüleme, düzeltme, dışa aktarma (Data Portability) ve hesaplarıyla birlikte tüm kişisel verilerinin kalıcı olarak silinmesini (<strong className="text-white">Unutulma Hakkı - Right to Erasure</strong>) talep etme hakkına sahiptir. Taleplerinizi profil ayarlarınızdan veya iletişim kanallarımızdan iletebilirsiniz.
            </p>
          </section>

          {/* Section 7 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Küresel Gizlilik Beyanı</h2>
            <p className="text-xs text-slate-400">
              BogaStock.com platformunu kullanarak bu gizlilik politikası ve uluslararası veri koruma standartlarını kabul etmiş olursunuz.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Son Güncelleme: 4 Ağustos 2026 | BogaStock.com Veri Güvenliği ve Gizlilik Yönetimi
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
