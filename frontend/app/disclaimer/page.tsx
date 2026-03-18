import { Activity, ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function DisclaimerPage() {
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
        <div className="flex items-center gap-4 mb-8">
          <AlertTriangle className="w-10 h-10 text-finma-yellow" />
          <h1 className="text-3xl font-bold text-finma-primary">SPK Uyarı Metni</h1>
        </div>
        
        <div className="space-y-8 text-finma-text-muted leading-relaxed">
          <p className="text-lg font-medium text-white">
            FinMA platformunda yer alan tüm bilgi, yorum ve analizler genel niteliktedir.
          </p>

          <div className="bg-finma-card/50 border border-finma-border/50 rounded-2xl p-6 space-y-4">
            <ul className="list-disc pl-5 space-y-3">
              <li>Bu platformda sunulan içerikler yatırım danışmanlığı kapsamında değildir.</li>
              <li>Yatırım danışmanlığı hizmeti, yalnızca SPK lisanslı kurumlar tarafından verilebilir.</li>
              <li>Buradaki bilgiler, kişisel risk ve getiri tercihlerinize uygun olmayabilir.</li>
              <li>Alınan yatırım kararları sonucunda oluşabilecek kazanç veya kayıplardan kullanıcı sorumludur.</li>
            </ul>
          </div>

          <div className="p-4 bg-finma-red/10 border border-finma-red/30 rounded-xl text-center">
            <p className="text-finma-red font-bold">
              Önemli Not: Geçmiş performans, gelecekteki sonuçların garantisi değildir.
            </p>
          </div>

          <section className="pt-8 border-t border-finma-border/50">
            <p>İletişim: <Link href="/contact" className="text-finma-primary hover:underline">İletişim Sayfası</Link></p>
          </section>
        </div>
      </main>
    </div>
  )
}
