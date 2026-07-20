import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function DisclaimerPageTr() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">Yasal Uyarılar ve Uyumluluk</h1>

        <div className="glass-card p-8 space-y-12 text-white leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">1. Yatırım Danışmanlığı Sorumluluk Muafiyeti (Yatırım Tavsiyesi Değildir)</h2>
            <p className="mb-4">
              BOGASTOCK.com (Blue One Global Analysis), yapay zeka tabanlı algoritmik modeller ve kantitatif veri analizleri sunan otomatik bir interactive charts, araştırma ve bilgilendirme platformudur. Platformumuz bünyesinde üretilen tüm içerikler, özel yapay zeka (AI) algoritmalarımız tarafından hazırlanan kantitatif skorlar, analizler, trend değerlendirmeleri ve işlem derecelendirmeleri (örneğin; "YÜKSEK İNANÇ", "POZİTİF EĞİLİM" ve benzeri her türlü sınıflandırma) yalnızca genel bilgilendirme ve eğitim amacıyla sunulmaktadır.
            </p>
            <p>
              Bu platformda sunulan hiçbir bilgi, analiz veya yönlendirme; yatırım tavsiyesi, portföy yöneticiliği, finansal danışmanlık ya da hukuki/vergisel bir öneri niteliği taşımamaktadır. BOGASTOCK.com, ABD Sermaye Piyasası Kanunları (U.S. Investment Advisers Act of 1940) kapsamında tescilli bir Yatırım Danışmanı (Registered Investment Adviser - RIA) veya Aracı Kurum (Broker-Dealer) olmadığı gibi, Türkiye Cumhuriyeti Sermaye Piyasası Kanunu (6362 Sayılı SPK) ve ilgili mevzuatı çerçevesinde yetkilendirilmiş bir portföy yönetim şirketi, yatırım danışmanı ya da aracı kurum niteliğinde de değildir. Platformumuz, kullanıcıları ile hiçbir şekilde yatırım danışmanı-danışan veya mali mütevelli (fiduciary) ilişkisi tesis etmez. Sunulan veriler doğrultusunda karar almadan önce, kişisel risk-getiri tercihlerinize uygun olarak lisanslı ve yetkili bir finansal danışmandan profesyonel destek almanız önemle tavsiye edilir.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">2. Yüksek Risk ve Finansal Kayıp Bildirimi</h2>
            <p className="mb-4">
              Sermaye piyasalarında, özellikle de ABD (NYSE, NASDAQ) ve Türkiye (BIST) hisse senedi piyasalarında işlem yapmak, yüksek derecede oynaklık (volatilite) barındırır ve yatırılan sermayenin tamamının veya bir kısmının kaybedilmesi riskini taşır. Yapay zeka algoritmalarımız tarafından üretilen puanlar ve analizler deneysel nitelikte olup, geçmiş veri setleri, matematiksel modellemeler ve istatistiksel olasılıklar temel alınarak oluşturulmuştur.
            </p>
            <p>
              Finansal piyasalarda geçmiş dönem performansları, gelecekteki sonuçların veya başarıların bir garantisi ya da taahhüdü olarak kabul edilemez. Algoritma ve modellerimizin mutlak bir karlılık veya başarı sağlayacağına dair açık ya da zımni hiçbir garanti verilmemektedir. Platformumuzda yer alan verilerin, analizlerin veya skorların kullanımına dayalı olarak gerçekleştireceğiniz tüm ticari işlemler ve yatırım kararları tamamen kendi özgür iradenizle alınmış olup, bu kararların doğuracağı finansal, hukuki ve cezai sonuçlar ile olası tüm maddi/manevi kayıplar münhasıran yatırımcının (kullanıcının) şahsi sorumluluğundadır.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">3. Veri Gizliliği ve Global Mevzuata Uyum (GDPR, CCPA ve KVKK)</h2>
            <p className="mb-4">
              Kullanıcılarımızın veri gizliliği ve güvenliği BOGASTOCK.com için en yüksek önceliktir. Platformumuz, Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR), Kaliforniya Tüketici Gizliliği Yasası (CCPA) ve Türkiye Cumhuriyeti 6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK) standartlarına tam uyum sağlamayı taahhüt eder.
            </p>
            <p>
              Sistemimiz, yalnızca kullanıcı hesaplarının doğrulanması, abonelik süreçlerinin yönetilmesi ve güvenli erişim sağlanması amacıyla, güvenli üçüncü taraf yetkilendirme sağlayıcıları (identity providers) aracılığıyla sınırlı kişisel veri (e-posta adresi, ad-soyad gibi) toplamaktadır. BOGASTOCK.com, kullanıcılarının kişisel verilerini kesinlikle üçüncü şahıslara veya veri aracılarına satmaz, kiralamaz ya da ticari amaçla paylaşmaz. Kullanıcılarımız, hesap ayarları veya doğrudan iletişim kanallarımız üzerinden diledikleri an kişisel verilerinin silinmesini (unutulma hakkı kapsamında), işlenmesinin durdurulmasını veya üyeliklerinin iptal edilmesini talep etme hakkına sahiptir.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4">4. Reklam, Tarafsızlık ve Bağımsızlık Beyanı</h2>
            <p>
              Platformumuzun operasyonel sürdürülebilirliğini sağlamak ve ücretsiz erişim imkanlarını desteklemek amacıyla, web sitemizde ve uygulamalarımızda üçüncü taraf reklam ortaklıklarına yer verilebilir. BOGASTOCK.com (Blue One Global Analysis), editoryal bağımsızlık ve analitik tarafsızlık ilkelerine sıkı sıkıya bağlıdır. Reklam veren üçüncü tarafların, sponsorların veya iş ortaklarının; tescilli yapay zeka puanlama motorumuz, algoritma mimarimiz, sinyal üretim süreçlerimiz, hisse senedi seçim kriterlerimiz veya analiz sonuçlarımız üzerinde doğrudan ya da dolaylı hiçbir etkisi, müdahalesi veya yönlendirmesi söz konusu olamaz. Tüm analitik çıktılar, tamamen nesnel kantitatif parametrelerle tarafsız olarak üretilmektedir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-4">Yatırımcı Sorumluluğu Taahhüdü</h2>
            <p>
              BOGASTOCK.com (Blue One Global Analysis) platformuna erişim sağlayarak, üye olarak veya platform içeriklerini kullanarak; yukarıda belirtilen tüm yasal şartları, sorumluluk sınırlandırmalarını, risk bildirimlerini ve gizlilik politikalarını okuduğunuzu, anladığınızı ve bu şartlara tamamen kendi özgür iradenizle, hukuken bağlayıcı bir şekilde muvafakat ettiğinizi beyan ve kabul edersiniz.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#00d2ff]">
              Son Güncelleme: 1 Mayıs 2026
            </p>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
