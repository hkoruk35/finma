'use client'

export default function SignalsPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-finma-text mb-2">🔔 Canlı Sinyaller</h1>
      <p className="text-finma-text-dim text-sm mb-6">AI sistem otomatik olarak piyasa sinyallerini izler ve bildirim gönderir.</p>

      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-6 text-center mb-6">
        <p className="text-finma-text-dim mb-3">Bu Pro+ özelliğidir</p>
        <a
          href="/pricing"
          className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200"
        >
          Pro+ Özelliklerini Keşfet →
        </a>
      </div>

      <div className="bg-finma-bg border border-finma-border rounded-lg p-8 text-center">
        <p className="text-finma-text-dim">Yakında kullanılabilir olacak...</p>
      </div>
    </div>
  )
}
