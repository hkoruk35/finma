import Link from 'next/link'
import { Zap, Shield } from 'lucide-react'

export default function TermsPage() {
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
          <Shield className="w-6 h-6 text-finma-primary" />
          <div>
            <h1 className="text-2xl font-bold text-white">Kullanım Koşulları</h1>
            <p className="text-xs text-finma-text-dim">Son güncelleme: Mart 2026 · Revizyon 1.0</p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-finma-text-dim">

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Hizmetin Tanımı</h2>
            <p>
              FinMA ("Platform"), hisse senedi piyasasını yapay zeka ile analiz eden ve kullanıcılara
              karar destek senaryoları sunan bir B2C SaaS platformudur. Platform; sinyal servisi,
              broker, aracı kurum veya yatırım danışmanlığı hizmeti <strong className="text-white">değildir</strong>.
            </p>
            <p>
              Platformun sunduğu tüm içerik ve analizler <strong className="text-white">yalnızca bilgilendirme amaçlıdır</strong>.
              Hiçbir içerik yatırım tavsiyesi, alım-satım önerisi veya finansal tavsiye niteliği taşımaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. Kabul</h2>
            <p>
              Platforma kaydolarak veya hizmeti kullanarak bu Kullanım Koşulları'nı okuduğunuzu,
              anladığınızı ve bağlı olmayı kabul ettiğinizi beyan edersiniz.
              Koşulları kabul etmiyorsanız platformu kullanmamanız gerekmektedir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. Yasal Uyum ve Sorumluluk Reddi</h2>
            <p>
              SEC (ABD), FCA (İngiltere), SPK (Türkiye) ve ESMA (AB) düzenlemelerine göre "yatırım tavsiyesi";
              belirli bir kişiye belirli bir menkul kıymeti almayı veya satmayı öneren içeriktir.
              FinMA'nın ürettiği içerik bu tanımın dışındadır:
            </p>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Genel piyasa gözlemi sunar, bireyselleştirilmiş tavsiye vermez.</li>
              <li>"Olası / possible / may / could" dili kullanılır; kesinlik ifadesi yoktur.</li>
              <li>Kullanıcı kimlik ve portföy bilgisi toplanmaz.</li>
              <li>Her analiz içeriğinde ve sitede "yatırım tavsiyesi değildir" bildirimi yer alır.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Abonelik ve Ücretlendirme</h2>
            <p>
              Platform; 7 günlük ücretsiz deneme, Pro ($19/ay) ve Smart Tracking add-on ($29/ay) planları
              sunmaktadır. Ödemeler Stripe üzerinden güvenli biçimde işlenir. Kart bilgileri hiçbir zaman
              sunucularımıza iletilmez; Stripe PCI-DSS uyumlu altyapıyı yönetir.
            </p>
            <p>
              Aboneliğinizi dilediğiniz zaman iptal edebilirsiniz. İptal sonrası mevcut dönem sonuna
              kadar erişiminiz devam eder; pro-rata iade yapılmaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Yasaklı Kullanımlar</h2>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Platform içeriğini üçüncü taraflara yeniden satmak veya dağıtmak</li>
              <li>Otomatik araçlarla içerik kazımak (web scraping)</li>
              <li>API limitlerini aşmaya yönelik kötüye kullanım</li>
              <li>Platformu yatırım danışmanlığı hizmeti olarak pazarlamak</li>
              <li>Platform altyapısına zarar verecek faaliyetlerde bulunmak</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">6. Hesap Silme</h2>
            <p>
              Hesabınızı silme talebini settings@finmasmart.com adresine iletebilirsiniz.
              Talepler GDPR ve KVKK uyarınca 30 gün içinde işleme alınır.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">7. Değişiklikler</h2>
            <p>
              Bu koşullar zaman zaman güncellenebilir. Önemli değişiklikler e-posta ile bildirilir.
              Platformu kullanmaya devam etmeniz güncel koşulları kabul ettiğiniz anlamına gelir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">8. İletişim</h2>
            <p>
              Sorularınız için: <a href="mailto:legal@finmasmart.com" className="text-finma-primary hover:underline">legal@finmasmart.com</a>
            </p>
          </section>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-wrap gap-4 text-xs text-finma-text-dim">
          <Link href="/legal/privacy" className="hover:text-finma-primary">Gizlilik Politikası</Link>
          <Link href="/legal/risk"    className="hover:text-finma-primary">Risk Açıklaması</Link>
          <Link href="/pricing"       className="hover:text-finma-primary">Fiyatlandırma</Link>
        </div>
      </div>
    </div>
  )
}
