import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function TermsPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/terms" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Kullanım Şartları</h1>

        <div className="glass-card p-8 space-y-6 text-white leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Şartların Kabulü</h2>
            <p>
              BOGA AI Daily +8000'e erişerek, bu Kullanım Şartlarına uymayı ve bunlarla
              bağlı olmayı kabul edersiniz. Kabul etmiyorsanız, lütfen servisi kullanmayın.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Kullanıcı Hesapları</h2>
            <p>
              Hesap şifrenizin gizliliğini korumaktan siz sorumlusunuz.
              Hesaplar yalnızca bireysel kullanım içindir ve paylaşılamaz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Kullanım Kısıtlamaları</h2>
            <p>
              BOGA AI sinyallerini, puanlarını veya AI özetlerini açık yazılı izin olmadan
              kazımayacağınızı, otomatik olarak toplamayacağınızı veya yeniden dağıtmayacağınızı kabul edersiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Servis Değişiklikleri</h2>
            <p>
              Servisin herhangi bir bölümünü önceden bildirimde bulunmaksızın
              herhangi bir zamanda değiştirme veya durdurma hakkını saklı tutarız.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Fesih</h2>
            <p>
              Sahtekarlık şüphesi veya bu şartların ihlali durumunda
              hesabınızı askıya alabilir veya sonlandırabiliriz.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
