import Link from 'next/link'
import { Zap, AlertTriangle } from 'lucide-react'

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen bg-finma-bg text-white">
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-finma-primary" />
          <span className="text-sm font-bold text-white">FinMA</span>
        </Link>
        <Link href="/" className="text-xs text-finma-text-dim hover:text-white">Ana Sayfa</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-finma-yellow" />
          <div>
            <h1 className="text-2xl font-bold text-white">Risk Açıklaması</h1>
            <p className="text-xs text-finma-text-dim">Son güncelleme: Mart 2026</p>
          </div>
        </div>

        {/* Kritik uyarı kutusu */}
        <div className="rounded-xl border border-finma-yellow/30 bg-finma-yellow/5 p-5 space-y-2">
          <p className="text-sm font-bold text-finma-yellow flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Önemli Uyarı
          </p>
          <p className="text-sm text-finma-text-dim leading-relaxed">
            FinMA'da sunulan tüm içerik <strong className="text-white">yalnızca bilgilendirme amaçlıdır</strong> ve
            yatırım tavsiyesi niteliği taşımamaktadır. Finansal piyasalarda işlem yapmak ciddi risk içerir.
            Yatırımlarınızın tamamını kaybedebilirsiniz.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-finma-text-dim">

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Platform Niteliği</h2>
            <p>
              FinMA; bir <strong className="text-white">Karar Destek Platformu</strong>'dur.
              Sinyal servisi, aracı kurum, broker veya kayıtlı yatırım danışmanı değildir.
              Platform, SEC (ABD), FCA (İngiltere), SPK (Türkiye) veya diğer düzenleyici kurumlar
              nezdinde yatırım danışmanlığı lisansına sahip değildir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. Piyasa Riski</h2>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Hisse senedi değerleri düşebilir; yatırılan tutarın tamamı kaybedilebilir.</li>
              <li>Geçmiş fiyat hareketleri gelecekteki performansı garanti etmez.</li>
              <li>Piyasa koşulları beklenmedik şekilde değişebilir (siyasi, ekonomik, jeopolitik).</li>
              <li>Volatilite yüksek dönemlerde analizlerin güncelliği kısıtlı kalabilir.</li>
              <li>Likidite riski: Yüksek hacimli görünen hisseler ani kriz dönemlerinde işlem göremez hale gelebilir.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. AI Analiz Riski</h2>
            <p>
              Platform, Gemini AI tarafından üretilen içerikleri sunar. AI üretimi analizler:
            </p>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Hatalı veya eksik bilgi içerebilir</li>
              <li>Gerçek zamanlı piyasa koşullarını tam olarak yansıtmayabilir</li>
              <li>Öngörülemez piyasa olaylarını (siyah kuğu) hesaba katamaz</li>
              <li>Belirli bir sonucu garanti etmez</li>
            </ul>
            <p>
              AI içerikleri bilinçli olarak olasılıksal dil ("olası", "mümkün", "bazı yatırımcılar")
              ile sunulur. Bu dil, belirsizliği açıkça ifade eder.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Veri Kaynağı Riski</h2>
            <p>
              Platform verileri Yahoo Finance ve Polygon.io gibi üçüncü taraf sağlayıcılardan alır.
              Bu sağlayıcıların gecikmeli, eksik veya hatalı veri sunma ihtimali vardır.
              FinMA, veri kalitesinden kaynaklanan kayıplardan sorumlu değildir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Kullanıcı Sorumluluğu</h2>
            <p>
              FinMA'da yer alan hiçbir içerik, bir menkul kıymeti almak veya satmak için
              bireyselleştirilmiş tavsiye değildir. Kullanıcı:
            </p>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Kendi yatırım kararlarını özgür iradesiyle verir</li>
              <li>Kendi risk toleransını ve finansal durumunu değerlendirmekle yükümlüdür</li>
              <li>Gerektiğinde lisanslı bir finansal danışmana başvurmalıdır</li>
              <li>Platform içeriğini kendi sorumluluğunda kullandığını kabul eder</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">6. Sorumluluk Sınırlaması</h2>
            <p>
              FinMA ve operatörleri; platformun kullanımından doğan doğrudan, dolaylı, tesadüfi,
              özel veya sonuçsal zararlardan (yatırım kayıpları dahil) hiçbir şekilde sorumlu tutulamaz.
              Uygulanabilir hukuk bunu kısıtladığı ölçüde bu sınırlama geçerlidir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">7. Küresel Kullanıcılar</h2>
            <p>
              Platform farklı ülkelerden kullanıcılara hizmet verir. Her ülkenin menkul kıymet
              düzenlemeleri farklıdır. Kullanıcılar kendi yargı alanlarındaki yasal yükümlülüklerinden
              bizzat sorumludur. Platform, yerel mevzuat uyumluluğunu garanti etmez.
            </p>
          </section>
        </div>

        {/* Son uyarı */}
        <div className="rounded-xl border border-white/10 bg-white/3 p-5">
          <p className="text-xs text-finma-text-dim leading-relaxed text-center">
            <strong className="text-white">For informational purposes only. Not investment advice.</strong>
            <br />
            All financial decisions are the sole responsibility of the user.
            Past performance is not indicative of future results.
            Investing involves risk, including the possible loss of principal.
          </p>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-wrap gap-4 text-xs text-finma-text-dim">
          <Link href="/legal/terms"   className="hover:text-finma-primary">Kullanım Koşulları</Link>
          <Link href="/legal/privacy" className="hover:text-finma-primary">Gizlilik Politikası</Link>
          <Link href="/pricing"       className="hover:text-finma-primary">Fiyatlandırma</Link>
        </div>
      </div>
    </div>
  )
}
