import { Activity, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function KVKKPage() {
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
        <h1 className="text-3xl font-bold mb-8 text-finma-primary">KVKK Aydınlatma Metni</h1>
        
        <div className="space-y-8 text-finma-text-muted leading-relaxed">
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kullanıcılarımızı bilgilendiriyoruz.</p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Veri Sorumlusu</h2>
            <p>FinMA platformu veri sorumlusudur.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">İşlenen Kişisel Veriler</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Kimlik bilgileri (ad, e-posta)</li>
              <li>İşlem güvenliği verileri</li>
              <li>Kullanıcı ve davranış verileri</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">İşleme Amaçları</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Hizmet sunumu</li>
              <li>Kullanıcı deneyimi geliştirme</li>
              <li>Yasal yükümlülükler</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Hukuki Sebepler</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Açık rıza</li>
              <li>Sözleşmenin ifası</li>
              <li>Meşru menfaat</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Verilerin Aktarımı</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Yasal zorunluluklar halinde resmi kurumlara</li>
              <li>Hizmet sağlayıcılara sınırlı olarak</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Veri Sahibi Hakları</h2>
            <p className="mb-4">KVKK’nın 11. maddesi kapsamında kullanıcılar:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Verilerinin işlenip işlenmediğini öğrenme</li>
              <li>Düzeltilmesini isteme</li>
              <li>Silinmesini talep etme</li>
              <li>İşlemeye itiraz etme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Başvuru</h2>
            <p>Kullanıcılar taleplerini yazılı olarak iletebilir.</p>
          </section>

          <section className="pt-8 border-t border-finma-border/50">
            <p>İletişim: <Link href="/contact" className="text-finma-primary hover:underline">İletişim Sayfası</Link></p>
          </section>
        </div>
      </main>
    </div>
  )
}
