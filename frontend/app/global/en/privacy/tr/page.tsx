import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function PrivacyPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/global/en/privacy" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Gizlilik Politikası</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <p>Son güncelleme: Nisan 2026</p>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Topladığımız Bilgiler</h2>
            <p>
              Hizmetlerimizi sunmak için minimum düzeyde kişisel bilgi topluyoruz.
              Bu, hesap kaydı yaptığınızda e-posta adresinizi ve oturumunuzu
              sürdürmek ve site performansını analiz etmek için IP adresleri ve tarayıcı
              çerezleri gibi teknik verileri içerir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Verileri Nasıl Kullanıyoruz</h2>
            <p>
              Verileriniz şu amaçlarla kullanılır:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
               <li>Üye hesabınızı ve izleme listesi ayarlarınızı yönetmek.</li>
               <li>Günlük piyasa özetleri veya kritik uyarılar göndermek (tercih ettiyseniz).</li>
               <li>Toplu kullanım kalıplarına dayanarak AI puanlama algoritmalarımızı geliştirmek.</li>
               <li>İlgili finansal reklamları göstermek.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Veri Paylaşımı</h2>
            <p>
              Kişisel verilerinizi üçüncü taraflara satmıyoruz.
              Toplu, anonimleştirilmiş veriler, reklam dağıtımını kolaylaştırmak için
              reklam ortaklarımızla paylaşılabilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Güvenlik</h2>
            <p>
              Hesabınızı korumak için endüstri standardı şifreleme kullanıyoruz.
              Ancak, hiçbir elektronik depolama veya iletim yöntemi %100 güvenli değildir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Haklarınız</h2>
            <p>
              contact@bogastock.com adresinden bizimle iletişime geçerek kişisel
              verilerinizi her zaman görüntüleme, düzeltme veya silme talebinde bulunabilirsiniz.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
