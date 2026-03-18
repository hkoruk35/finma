import { Activity, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-finma-bg text-white pb-20">
      <nav className="fixed top-0 w-full z-50 bg-finma-bg/80 backdrop-blur-xl border-b border-finma-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 group">
            <Activity className="w-7 h-7 text-finma-primary" />
            <div className="flex">
              <span className="text-xl font-bold text-white">Fin</span>
              <span className="text-xl font-bold text-finma-primary">MA</span>
            </div>
          </Link>
          <Link href="/" className="text-sm text-finma-text-dim hover:text-white flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Geri Dön
          </Link>
        </div>
      </nav>

      <main className="pt-32 px-4 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-finma-primary">Gizlilik Politikası</h1>
        
        <div className="space-y-8 text-finma-text-muted leading-relaxed">
          <section>
            <p>
              FinMA olarak kullanıcılarımızın gizliliğine ve kişisel verilerinin korunmasına büyük önem veriyoruz. Bu politika, platformumuzu kullandığınızda hangi verilerin toplandığını, nasıl kullanıldığını ve nasıl korunduğunu açıklamaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Toplanan Veriler</h2>
            <p className="mb-4">FinMA aşağıdaki verileri toplayabilir:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Ad, soyad, e-posta adresi gibi kimlik bilgileri</li>
              <li>IP adresi, cihaz bilgisi ve tarayıcı verileri</li>
              <li>Kullanıcı tercihleri ve platform içi davranış verileri</li>
              <li>Finansal analiz ve kullanım geçmişi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Verilerin Kullanım Amaçları</h2>
            <p className="mb-4">Toplanan veriler şu amaçlarla kullanılır:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Hizmetlerin sunulması ve geliştirilmesi</li>
              <li>Kullanıcı deneyiminin kişiselleştirilmesi</li>
              <li>Güvenlik ve sistem performansının sağlanması</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Veri Paylaşımı</h2>
            <p className="mb-4">Kişisel veriler:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Üçüncü taraflarla izinsiz paylaşılmaz</li>
              <li>Yalnızca yasal zorunluluklar kapsamında ilgili otoritelerle paylaşılabilir</li>
              <li>Hizmet sağlayıcılarla sınırlı ve güvenli şekilde işlenebilir</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Veri Güvenliği</h2>
            <p className="mb-4">FinMA, verilerinizi korumak için:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>SSL şifreleme</li>
              <li>Güvenli sunucu altyapısı</li>
              <li>Yetkisiz erişim önleme sistemleri</li>
            </ul>
            <p className="mt-4">kullanmaktadır.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Çerezler (Cookies)</h2>
            <p>
              Platformumuz, kullanıcı deneyimini iyileştirmek için çerezler kullanır. Kullanıcılar tarayıcı ayarlarından çerezleri kontrol edebilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Kullanıcı Hakları</h2>
            <p className="mb-4">Kullanıcılar:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Verilerine erişme</li>
              <li>Düzeltme talep etme</li>
              <li>Silinmesini isteme</li>
            </ul>
            <p className="mt-4">haklarına sahiptir.</p>
          </section>

          <section className="pt-8 border-t border-finma-border/50">
            <p>İletişim: <Link href="/contact" className="text-finma-primary hover:underline">İletişim Sayfası</Link></p>
          </section>
        </div>
      </main>
    </div>
  )
}
