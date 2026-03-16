'use client'

import { useState } from 'react'
import { X, FileText, Shield, CheckCircle2 } from 'lucide-react'

interface SubscriptionAgreementProps {
  onAccept: () => void
  onClose: () => void
}

export function SubscriptionAgreement({ onAccept, onClose }: SubscriptionAgreementProps) {
  const [agreed, setAgreed] = useState(false)
  const [kvkkAgreed, setKvkkAgreed] = useState(false)
  const [riskAgreed, setRiskAgreed] = useState(false)

  const allAgreed = agreed && kvkkAgreed && riskAgreed

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-finma-card border border-finma-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-finma-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-finma-primary" />
            <h2 className="text-sm font-bold text-white">Abonelik Sözleşmesi</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors">
            <X className="w-4 h-4 text-finma-text-dim" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-finma-text-dim leading-relaxed">
          {/* Service Agreement */}
          <section>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-finma-primary" />
              1. HİZMET SÖZLEŞMESİ
            </h3>
            <div className="space-y-2 pl-6">
              <p>
                <strong className="text-finma-text">1.1.</strong> İşbu sözleşme, FinMA platformu (&quot;Hizmet Sağlayıcı&quot;) ile
                kullanıcı (&quot;Abone&quot;) arasında, FinMA Pro abonelik hizmetinin kullanımına ilişkin koşulları düzenler.
              </p>
              <p>
                <strong className="text-finma-text">1.2.</strong> Abonelik ücreti aylık 19 ABD Doları (USD) olup,
                abonelik başlatıldığında tahsil edilir.
              </p>
              <p>
                <strong className="text-finma-text">1.3.</strong> Abonelik her ayın başlangıç tarihinde otomatik yenilenir. Abone,
                istediği zaman aboneliğini iptal edebilir. İptal durumunda erişim mevcut dönem sonuna kadar devam eder.
              </p>
            </div>
          </section>

          {/* SPK Disclaimer */}
          <section>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-finma-yellow" />
              2. YATIRIM UYARISI (SPK Mevzuatı)
            </h3>
            <div className="space-y-2 pl-6">
              <p>
                <strong className="text-finma-text">2.1.</strong> FinMA platformu, 6362 sayılı Sermaye Piyasası Kanunu kapsamında
                yatırım danışmanlığı veya portföy yönetimi hizmeti sunmamaktadır.
              </p>
              <p>
                <strong className="text-finma-text">2.2.</strong> Platform üzerinden sunulan bilgiler, analizler, sinyaller ve
                öneriler yalnızca bilgilendirme amaçlıdır ve yatırım tavsiyesi niteliği taşımaz.
              </p>
              <p>
                <strong className="text-finma-text">2.3.</strong> Sermaye Piyasası Kurulu (SPK) tarafından düzenlenen yatırım
                kuruluşları dışında, hiçbir kişi veya kuruluş yatırım danışmanlığı faaliyetinde bulunamaz.
              </p>
              <p>
                <strong className="text-finma-text">2.4.</strong> Kullanıcıların yatırım kararları tamamen kendi sorumluluğundadır.
                FinMA, kullanıcıların yatırım kararlarından doğacak zararlardan sorumlu tutulamaz.
              </p>
              <p>
                <strong className="text-finma-text">2.5.</strong> Geçmiş performans göstergeleri gelecekteki sonuçların garantisi
                değildir. Yatırım araçlarının değeri artabileceği gibi azalabilir de.
              </p>
            </div>
          </section>

          {/* Turkish Commercial Code */}
          <section>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-finma-cyan" />
              3. TİCARİ HÜKÜMLER (Türk Ticaret Kanunu)
            </h3>
            <div className="space-y-2 pl-6">
              <p>
                <strong className="text-finma-text">3.1.</strong> İşbu sözleşme, 6102 sayılı Türk Ticaret Kanunu ve 6098 sayılı
                Türk Borçlar Kanunu hükümlerine tabidir.
              </p>
              <p>
                <strong className="text-finma-text">3.2.</strong> Hizmet Sağlayıcı, hizmetin kesintisiz veya hatasız olacağını
                garanti etmez. Teknik bakım, güncelleme veya mücbir sebep hallerinde hizmet geçici olarak durdurulabilir.
              </p>
              <p>
                <strong className="text-finma-text">3.3.</strong> Abone, platform üzerindeki içerikleri kopyalayamaz, çoğaltamaz
                veya ticari amaçla kullanamaz. Fikri mülkiyet hakları Hizmet Sağlayıcı&apos;ya aittir.
              </p>
              <p>
                <strong className="text-finma-text">3.4.</strong> Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
              </p>
            </div>
          </section>

          {/* KVKK */}
          <section>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-finma-green" />
              4. KİŞİSEL VERİLERİN KORUNMASI (KVKK)
            </h3>
            <div className="space-y-2 pl-6">
              <p>
                <strong className="text-finma-text">4.1.</strong> 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;)
                kapsamında, Hizmet Sağlayıcı veri sorumlusu sıfatıyla aşağıdaki bilgileri işlemektedir:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Ad-soyad, e-posta adresi (Google hesabı üzerinden)</li>
                <li>Kullanıcı tercihleri ve ayarları</li>
                <li>Platform kullanım verileri ve oturum bilgileri</li>
                <li>Abonelik ve ödeme bilgileri</li>
              </ul>
              <p>
                <strong className="text-finma-text">4.2.</strong> Kişisel verileriniz yalnızca hizmetin sunulması, iyileştirilmesi
                ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenmektedir.
              </p>
              <p>
                <strong className="text-finma-text">4.3.</strong> Verileriniz, açık rızanız olmaksızın üçüncü şahıslarla
                paylaşılmaz. Yasal zorunluluklar saklıdır.
              </p>
              <p>
                <strong className="text-finma-text">4.4.</strong> KVKK&apos;nın 11. maddesi kapsamında haklarınız:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                <li>İşlenmişse buna ilişkin bilgi talep etme</li>
                <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
                <li>Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme</li>
                <li>KVKK&apos;nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
              </ul>
              <p>
                <strong className="text-finma-text">4.5.</strong> Veri sorumlusuna başvuru: info@finmasmart.com
              </p>
            </div>
          </section>

          {/* Risk Disclosure */}
          <section>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-finma-red" />
              5. RİSK BİLDİRİMİ
            </h3>
            <div className="space-y-2 pl-6">
              <p>
                <strong className="text-finma-text">5.1.</strong> Sermaye piyasası araçlarının alım satımına ilişkin kararlarınız
                sonucunda kâr elde edebileceğiniz gibi zarar riskiniz de bulunmaktadır.
              </p>
              <p>
                <strong className="text-finma-text">5.2.</strong> Bu nedenle, işlem yapmaya karar vermeden önce, karşılaşabileceğiniz
                riskleri anlamanız ve kısıtlarınızı dikkate alarak karar vermeniz gerekmektedir.
              </p>
              <p>
                <strong className="text-finma-text">5.3.</strong> Platform üzerindeki yapay zeka analizleri istatistiksel modellere
                dayanmaktadır ve kesinlik garantisi vermez. AI tarafından üretilen sinyal ve analizler hatalar içerebilir.
              </p>
            </div>
          </section>
        </div>

        {/* Checkboxes & Actions */}
        <div className="p-4 border-t border-finma-border space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-xs text-finma-text">
              Abonelik sözleşmesini ve ticari hükümleri okudum, kabul ediyorum.
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={kvkkAgreed}
              onChange={(e) => setKvkkAgreed(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-xs text-finma-text">
              KVKK Aydınlatma Metni&apos;ni okudum, kişisel verilerimin işlenmesine onay veriyorum.
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={riskAgreed}
              onChange={(e) => setRiskAgreed(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-xs text-finma-text">
              Yatırım risk bildirimini okudum; sunulan bilgilerin yatırım tavsiyesi olmadığını, kararlarımın kendi
              sorumluluğumda olduğunu kabul ediyorum.
            </span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 text-xs py-2.5 px-4 border border-finma-border rounded-lg text-finma-text-dim hover:bg-white/5 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={onAccept}
              disabled={!allAgreed}
              className="flex-1 finma-btn-primary text-xs py-2.5 px-4 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Kabul Et ve Üyeliği Başlat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
