import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function DisclaimerPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="flex justify-end mb-4">
          <Link href="/disclaimer" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">English →</Link>
        </div>
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Yasal Uyarılar ve Uyumluluk</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Yatırım Tavsiyesi Değildir</h2>
            <p>
              BOGA AI Daily +8000, otomatik bir bilgilendirme servisidir. Bu platformda sunulan içerik —
              özel BOGA AI tarafından üretilen analizler, puanlar ve işlem derecelendirmeleri
              (YÜKSEK İNANÇ, POZİTİF EĞİLİM vb. dahil ancak bunlarla sınırlı olmamak üzere) — yalnızca
              bilgilendirme amaçlıdır. Finansal, yatırım veya profesyonel tavsiye niteliği TAŞIMAZ. Kayıtlı bir
              yatırım danışmanı (RIA), aracı kurum veya finansal mütevelli değiliz. Herhangi bir yatırım
              kararı vermeden önce lisanslı bir finans uzmanına danışın.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Yüksek Risk Bildirimi</h2>
            <p>
              ABD hisse senetlerinde işlem yapmak yüksek derecede risk ve önemli sermaye kaybı potansiyeli
              içerir. AI puanlarımız deneyseldir ve gelecekteki sonuçları garanti etmeyen geçmiş veri
              kalıplarına dayanır. Sağlanan herhangi bir puanın karlılığı veya başarısı konusunda hiçbir
              garanti vermiyoruz. Bilgileri kendi sorumluluğunuzda kullanın.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Veri Gizliliği (CCPA/GDPR Uyumluluğu)</h2>
            <p>
              Kullanıcı gizliliğine öncelik veriyoruz. BOGA AI Daily +8000, yalnızca hesap doğrulama
              amacıyla güvenli üçüncü taraf sağlayıcılar üzerinden e-posta adreslerini toplar. Kullanıcı
              verilerini üçüncü taraflara SATMIYORUZ. Üyeler, ayarlarımız veya iletişim formumuz
              aracılığıyla her zaman hesap ve veri silme talebinde bulunma hakkına sahiptir.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Reklam ve Tarafsızlık Bildirimi</h2>
            <p>
              Ücretsiz üyelik kademesini desteklemek için bu platformda üçüncü taraf reklamlar
              gösterilebilir. BOGA AI, reklam ve analiz arasında sıkı bir ayrım sürdürür; reklam verenler
              BOGA AI puanlama motoru, sinyal üretimi veya hisse seçim süreci üzerinde etki sahibi değildir.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Son Güncelleme: Nisan 2026. BOGA AI Daily +8000 platformunu kullanarak, yukarıda belirtilen
              tüm şartları okuduğunuzu, anladığınızı ve gönüllü olarak kabul ettiğinizi onaylıyorsunuz.
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
