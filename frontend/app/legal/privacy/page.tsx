import Link from 'next/link'
import { Zap, Shield } from 'lucide-react'

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-bold text-white">Gizlilik Politikası</h1>
            <p className="text-xs text-finma-text-dim">Son güncelleme: Mart 2026 · GDPR + KVKK Uyumlu</p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-finma-text-dim">

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Toplanan Veriler</h2>
            <p>FinMA aşağıdaki verileri toplar:</p>
            <ul className="space-y-2 pl-4 list-disc">
              <li><strong className="text-white">Hesap verisi:</strong> E-posta adresi, şifreli oturum, abonelik durumu</li>
              <li><strong className="text-white">Kullanım verisi:</strong> Görüntülenen hisseler, analiz talebi sayısı, oturum süresi</li>
              <li><strong className="text-white">Teknik veri:</strong> IP adresi, tarayıcı tipi, cihaz bilgisi (güvenlik amaçlı)</li>
            </ul>
            <p>
              Platform, portföy büyüklüğü veya menkul kıymet sahipliği gibi bireysel finansal bilgileri
              <strong className="text-white"> toplamaz ve saklamaz</strong>. Bu tasarım bilinçlidir:
              Kişiselleştirilmiş finansal tavsiye verilememesi için gereklidir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. Verilerin Kullanımı</h2>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Hesap kimlik doğrulaması ve güvenlik</li>
              <li>Abonelik yönetimi (Stripe entegrasyonu)</li>
              <li>Platform kullanım analitiği (kota kontrolü)</li>
              <li>Hizmet iyileştirme ve hata ayıklama</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            </ul>
            <p>
              Verileriniz <strong className="text-white">üçüncü taraflara satılmaz</strong>.
              Reklam amacıyla kullanılmaz.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. Veri Güvenliği</h2>
            <ul className="space-y-2 pl-4 list-disc">
              <li>Şifreler bcrypt (cost factor 12) ile hashlenir; düz metin saklanmaz</li>
              <li>Tüm iletişim HTTPS/TLS üzerinden gerçekleşir</li>
              <li>Supabase Row Level Security (RLS) ile her kullanıcı yalnızca kendi verisine erişir</li>
              <li>JWT access token 15 dakika, refresh token 7 gün geçerlidir</li>
              <li>Supabase günlük otomatik yedek + haftalık manuel snapshot</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Üçüncü Taraf Hizmetler</h2>
            <p>Platform aşağıdaki üçüncü taraf hizmetleri kullanır:</p>
            <div className="space-y-2">
              {[
                { name: 'Stripe',    purpose: 'Ödeme işleme',       policy: 'https://stripe.com/privacy' },
                { name: 'Supabase', purpose: 'Veritabanı (PostgreSQL)', policy: 'https://supabase.com/privacy' },
                { name: 'Google',   purpose: 'OAuth girişi (isteğe bağlı)', policy: 'https://policies.google.com/privacy' },
                { name: 'DeepL',    purpose: 'Dil çeviri servisi', policy: 'https://www.deepl.com/privacy' },
              ].map(({ name, purpose, policy }) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-white font-medium">{name}</span>
                    <span className="text-finma-text-dim ml-2 text-xs">— {purpose}</span>
                  </div>
                  <a href={policy} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-finma-primary hover:underline">
                    Politika
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Haklarınız (GDPR / KVKK)</h2>
            <ul className="space-y-2 pl-4 list-disc">
              <li><strong className="text-white">Erişim:</strong> Sakladığımız verilerinizi talep edebilirsiniz</li>
              <li><strong className="text-white">Düzeltme:</strong> Yanlış verilerin düzeltilmesini isteyebilirsiniz</li>
              <li><strong className="text-white">Silme (Right to Erasure):</strong> Hesabınızın ve verilerinizin silinmesini talep edebilirsiniz; 30 gün içinde işleme alınır</li>
              <li><strong className="text-white">Taşınabilirlik:</strong> Verilerinizi makine okunabilir formatta alabilirsiniz</li>
              <li><strong className="text-white">İtiraz:</strong> Belirli veri işleme faaliyetlerine itiraz edebilirsiniz</li>
            </ul>
            <p>
              Talepler için: <a href="mailto:privacy@finmasmart.com" className="text-finma-primary hover:underline">privacy@finmasmart.com</a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">6. Çerezler</h2>
            <p>
              Platform, oturum yönetimi için HttpOnly cookie kullanır. Üçüncü taraf pazarlama çerezleri
              kullanılmaz. Analitik amaçlı Plausible Analytics (gizlilik odaklı, GDPR uyumlu) kullanılabilir.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">7. İletişim</h2>
            <p>
              Gizlilik ile ilgili sorularınız için:{' '}
              <a href="mailto:privacy@finmasmart.com" className="text-finma-primary hover:underline">privacy@finmasmart.com</a>
            </p>
          </section>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-wrap gap-4 text-xs text-finma-text-dim">
          <Link href="/legal/terms" className="hover:text-finma-primary">Kullanım Koşulları</Link>
          <Link href="/legal/risk"  className="hover:text-finma-primary">Risk Açıklaması</Link>
          <Link href="/pricing"     className="hover:text-finma-primary">Fiyatlandırma</Link>
        </div>
      </div>
    </div>
  )
}
