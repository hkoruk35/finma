import { Activity, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-8 text-finma-primary">Kullanım Koşulları</h1>
        
        <div className="space-y-8 text-finma-text-muted leading-relaxed">
          <section>
            <p>
              FinMA platformunu kullanarak aşağıdaki şartları kabul etmiş sayılırsınız.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Hizmet Tanımı</h2>
            <p>
              FinMA, finansal veri analizi, piyasa takibi ve yapay zekâ destekli içgörüler sunan bir platformdur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Kullanıcı Yükümlülükleri</h2>
            <p className="mb-4">Kullanıcılar:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Platformu yasalara uygun şekilde kullanmalıdır</li>
              <li>Yanıltıcı veya kötüye kullanım faaliyetlerinde bulunamaz</li>
              <li>Hesap güvenliğinden kendisi sorumludur</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Hizmet Kapsamı</h2>
            <p className="mb-4">FinMA:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Sürekli erişim garantisi vermez</li>
              <li>Veri doğruluğunu garanti etmez</li>
              <li>Hizmeti önceden bildirim yapmadan değiştirebilir</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Fikri Mülkiyet</h2>
            <p className="mb-4">Platformdaki tüm içerik:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>FinMA’ya aittir</li>
              <li>İzinsiz kopyalanamaz, dağıtılamaz</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-finma-red">Sorumluluk Reddi</h2>
            <p className="mb-4 font-medium">FinMA:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Finansal kayıplardan sorumlu değildir</li>
              <li>Kullanıcı kararlarının sonuçlarından sorumlu tutulamaz</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Hesap Sonlandırma</h2>
            <p>
              FinMA, kuralları ihlal eden kullanıcıların erişimini askıya alabilir.
            </p>
          </section>

          <section className="pt-8 border-t border-finma-border/50">
            <p>İletişim: <Link href="/contact" className="text-finma-primary hover:underline">İletişim Sayfası</Link></p>
          </section>
        </div>
      </main>
    </div>
  )
}
