import { Activity, ArrowLeft, Mail, MessageSquare, MapPin } from 'lucide-react'
import Link from 'next/link'

export default function ContactPage() {
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

      <main className="pt-32 px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">Geri Bildirim ve İletişim</h1>
        <p className="text-finma-text-muted text-center max-w-2xl mx-auto mb-16">
          FinMA deneyiminizi geliştirmek için görüşleriniz bizim için çok değerli. Bize her zaman ulaşabilirsiniz.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-finma-card border border-finma-border/50 rounded-2xl p-8 text-center hover:border-finma-primary/30 transition-all">
            <div className="w-12 h-12 bg-finma-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Mail className="w-6 h-6 text-finma-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">E-posta</h3>
            <p className="text-sm text-finma-text-dim mb-4">Sorularınız ve destek için</p>
            <a href="mailto:support@finmasmart.com" className="text-finma-primary hover:underline font-medium">support@finmasmart.com</a>
          </div>

          <div className="bg-finma-card border border-finma-border/50 rounded-2xl p-8 text-center hover:border-finma-primary/30 transition-all">
            <div className="w-12 h-12 bg-finma-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-6 h-6 text-finma-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">Geri Bildirim</h3>
            <p className="text-sm text-finma-text-dim mb-4">Öneri ve istekleriniz için</p>
            <p className="text-finma-primary font-medium">Platform içi destek paneli</p>
          </div>

          <div className="bg-finma-card border border-finma-border/50 rounded-2xl p-8 text-center hover:border-finma-primary/30 transition-all">
            <div className="w-12 h-12 bg-finma-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-6 h-6 text-finma-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">Ofis</h3>
            <p className="text-sm text-finma-text-dim mb-4">Genel Merkez</p>
            <p className="text-finma-primary font-medium">New YORK / USA</p>
          </div>
        </div>

        <div className="bg-finma-card/50 border border-finma-border/50 rounded-2xl p-8 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold mb-6">Bize Ulaşın</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-finma-text-dim">Ad Soyad</label>
                <input type="text" className="w-full bg-finma-bg border border-finma-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-finma-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-finma-text-dim">E-posta</label>
                <input type="email" className="w-full bg-finma-bg border border-finma-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-finma-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-finma-text-dim">Mesajınız</label>
              <textarea rows={4} className="w-full bg-finma-bg border border-finma-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-finma-primary" />
            </div>
            <button className="w-full finma-btn-primary py-3 font-bold">Gönder</button>
          </div>
        </div>
      </main>
    </div>
  )
}
