import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/global/tr/sss" },
};

export default function FAQPage() {
  const faqs = [
    {
      question: "1. BOGASTOCK tam olarak nedir ve benim için ne yapar?",
      answer: "BOGASTOCK, yapay zeka (BOGA AI) ve gelişmiş matematiksel algoritmalar kullanarak ABD borsalarındaki (NYSE, NASDAQ, AMEX) binlerce hisse senedini tarayan bir finansal teknoloji platformudur. Amacımız, karmaşık indikatör kalabalığı içinde kaybolmanızı önleyerek, trend hisseleri için teknik ve temel olarak en uygun 20-30 hedef hisseyi tespit etmek, bunları puanlamak ve sizin için net bir izleme planı sunmaktır. Yatırım kararlarınızı rasyonel verilere dayandırarak almanızı sağlarız."
    },
    {
      question: "2. Bize hisse alım-satım tavsiyesi mi veriyorsunuz?",
      answer: "Kesinlikle hayır. Biz bir yatırım danışmanlığı firması değiliz. BOGASTOCK, tamamen matematiksel algoritmalara dayalı analizler üreten bir yazılım platformudur. Sistemimiz size \"şu fiyattan alın, bu fiyattan satın\" demez; sadece teknik ve temel kriterlere göre gücü kanıtlanmış potansiyel adayları listeler ve yapay zeka analiz raporunu sunar. Ticaret yapıp yapmama kararı, risk yönetimi ve pozisyon büyüklüğü tamamen sizin sorumluluğunuzdadır."
    },
    {
      question: "3. Üye olmadan önce sistemi ücretsiz deneyebilir miyim?",
      answer: "Hayır, artık ücretsiz deneme süremiz yok — BOGASTOCK doğrudan Premium üyelik modeliyle çalışır. Üye olduğunuz anda abonelik başlar ve ödeme alınır; buna karşılık ilk ayınızı indirimli fiyattan başlatabilirsiniz. Üye olmadan önce herkese açık Gösterge Paneli'ni ücretsiz inceleyip platformun genel görünümünü test edebilirsiniz."
    },
    {
      question: "4. Üye olurken kart bilgisi giriyorum, ödeme hemen mi alınıyor?",
      answer: "Evet. Üyelik oluşturduğunuz anda kartınızdan ilk ay için indirimli tutar tahsil edilir, ikinci aydan itibaren standart aylık ücrete geçilir. Deneme süresi olmadığından ödeme kayıt anında başlar. İstediğiniz zaman, hiçbir ek ücret ödemeden üyeliğinizi hesap panelinizden iptal edebilirsiniz."
    },
    {
      question: "5. Kredi kartı bilgilerimi sisteminizde saklıyor musunuz? Güvende miyim?",
      answer: "Kredi kartı bilgileriniz kesinlikle bizim sitemizde veya sunucularımızda kayıt altına alınmaz ve saklanmaz. Ödeme altyapımız, dünyanın en güvenli ve prestijli ödeme sistemlerinden biri olan Stripe aracılığıyla, tamamen şifreli ve güvenli bir ortamda gerçekleştirilir. Güvenliğiniz bizim için en üst düzey önceliktir."
    },
    {
      question: "6. Trend Hisseleri nedir? Ben hiç bilmiyorum.",
      answer: "Trend Hisseleri, bir hisse senedinin birkaç gün ila birkaç hafta sürebilecek güçlü yönlü fiyat hareketlerini (trendleri) yakalayarak kar elde etmeyi amaçlayan bir ticaret yöntemidir. Günlük piyasa takibi yapacak vakti olmayan veya uzun vadeli beklemek istemeyen yatırımcılar için idealdir. BOGASTOCK, bu kısa ve orta vadeli yönlü hareketleri yakalamak üzere kalibre edilmiştir. Ancak her ticarette olduğu gibi trend hisseleri işlemlerinde de sermaye kaybı riski her zaman mevcuttur."
    },
    {
      question: "7. Önerilen hisseler hemen işleme girmeye hazır mıdır? Nasıl giriş yapmalıyım?",
      answer: "Sistemimizdeki \"Trend Hisseleri\" listesinde yer alan adaylar teknik olarak işleme hazır, güçlü yapılardır. Ancak daha yüksek karlılık ve daha düşük risk için, üyelerimize 15 dakikalık (15m) grafik yapımızda uygun formasyon ve paternler ile hassas giriş yapmaları yönünde ek rehberlik sunuyoruz. Bu hassas giriş stratejileri, olası yanlış sinyallerde kaybınızı minimize etmenize yardımcı olur."
    },
    {
      question: "8. \"İzleme Listesi\" ile \"Trend Listesi\" arasındaki fark nedir?",
      answer: "İzleme Listesi (Watchlist): Algoritmalarımızın radarına giren, potansiyeli yüksek ancak henüz tam olarak kırılım veya güvenli giriş seviyesine ulaşmamış adayları içerir.\n\nTrend Listesi: Bu adaylar izleme listesinden geçerek, gerekli tüm teknik ve hacimsel onayları alıp aktif ticaret planına dahil edilen en yüksek inançlı hisselerdir."
    },
    {
      question: "9. İnteraktif Grafik ve BOGA AI analizi bana nasıl yardımcı olacak?",
      answer: "Grafik detay ekranımızda, kendi geliştirdiğimiz sadeleştirilmiş interaktif grafik desteğini sunuyoruz. BOGA AI, bu grafik üzerinde karmaşık formasyonları analiz ederek net ticaret planları (Giriş bölgesi, Hedef seviyeleri ve Stop Loss noktası) üretir. Siz bu verileri inceleyerek kararınızı verir, kendi risk toleransınıza göre pozisyon büyüklüğünüzü ayarlayarak ticaretinizi yönetirsiniz."
    },
    {
      question: "10. BOGA AI sistemi zamanla hata yapar mı? Kendini nasıl geliştiriyor?",
      answer: "Dünyada hatasız çalışan hiçbir finansal sistem veya yapay zeka yoktur; piyasalar her zaman belirsizliklerle doludur. Ancak BOGA AI, kendi geliştirdiğimiz özel LLM (Büyük Dil Modeli) yapısı ve makine öğrenimi altyapısı sayesinde gerçekleşen her işlem sonucunu (başarılı veya başarısız) analiz ederek kendini sürekli olarak günceller ve geliştirir. Amacımız, değişen piyasa koşullarına en hızlı şekilde uyum sağlamaktır."
    },
    {
      question: "11. Grafiklerde çok fazla çizgi ve kafa karıştırıcı indikatör var mı? Anlamakta zorlanır mıyım?",
      answer: "Hayır! BOGASTOCK'un temel felsefesi gürültüden, karmaşadan ve kafa karışıklığından uzak durmaktır. Sizi teknik analiz jargonuna boğmak yerine, doğrudan sonuca götüren net, temiz grafikler ve anlaşılır metrikler sunuyoruz. Finansal okuryazarlığınız başlangıç düzeyinde olsa dahi yapay zekanın sade dilde yazdığı raporlar sayesinde durumu kolayca analiz edebilirsiniz."
    },
    {
      question: "12. Verileriniz canlı (anlık) mı yoksa gecikmeli mi geliyor?",
      answer: "Sistemimizdeki teknik veriler, piyasayı saat başı güncelleyen ve 15 dakika gecikmeli olan veri kaynaklarından beslenir. Trend hisseleri (günlük ve haftalık trend takibi) odağında olduğumuz için saniyelik veya anlık veri akışına ihtiyacımız yoktur; saat başı güncellenen veriler sağlıklı ve sakin analizler üretmek için fazlasıyla yeterli ve güvenlidir."
    },
    {
      question: "13. Borsada işlem gören binlerce hisse var. Hangisini seçeceğimi nasıl bileceğim?",
      answer: "İşte BOGASTOCK'un en büyük faydalarından biri buradadır. Algoritmamız her gün NYSE, NASDAQ ve AMEX borsalarındaki 6.000'den fazla hisse senedini otomatik tarar. Likidite ve hacim gibi filtrelerden geçirerek gürültüyü yok eder ve gündemimizde ortalama sadece 20-30 adet en kaliteli hisseyi tutar. Böylece samanlıkta iğne aramak zorunda kalmazsınız."
    },
    {
      question: "14. \"Akıllı Paranın İzini Sürmek\" ne anlama geliyor?",
      answer: "Piyasalarda fiyatları hareket ettiren asıl güç büyük kurumsal fonlar ve bankalardır (Akıllı Para). Algoritmamız, günlük sermaye akışlarını ve hacim patlamalarını takip ederek büyük oyuncuların hangi hisselere gizlice giriş yaptığını veya hangilerinden çıktığını tespit etmeye çalışır. Bu sayede rüzgarı arkamıza alarak yön belirleme şansımız artar."
    },
    {
      question: "15. \"Beş Kademeli Puan Derecelendirmesi\" nedir?",
      answer: "BOGASTOCK puanlama motoru, her adayı teknik ve temel rasyolara göre analiz ederek net bir sınıfa ayırır: Yüksek İnanç (High Conviction), Pozitif Eğilim, Nötr Bekle, Negatif Eğilim ve Düşük Performans. Bu sayede hangi hissenin arkasında ne derecede güçlü bir matematiksel destek olduğunu belirsizlik yaşamadan görürsünüz."
    },
    {
      question: "16. Hisselerin teknik puanları nasıl hesaplanıyor?",
      answer: "Teknik puanımız; RSI, MACD, bağıl hacim (Relative Volume), EMA hareketli ortalama kesişimleri, ADX trend gücü ve Bollinger Bantlarındaki sıkışma yoğunluğu gibi ABD piyasalarına özel kalibre edilmiş teknik göstergelerin ağırlıklı bir karmasından hesaplanır. Yani tek bir indikatöre değil, çok faktörlü bir onay mekanizmasına dayanır."
    },
    {
      question: "17. Sadece teknik analiz mi kullanıyorsunuz? Şirketin karı, bilançosu önemli değil mi?",
      answer: "Kesinlikle önemli! Sistemimiz teknik analizin yanına güçlü bir \"Temel ve Sektör Katmanı\" ekler. Hisselerin F/K oranları, serbest nakit akışı (FCF) verimleri, brüt kar marjları ve gelir büyüme momentumları, bulundukları sektör ortalamaları ile kıyaslanarak analiz edilir. Böylece sadece grafiği değil, mali performansı da güçlü olan şirketleri önceliklendiririz."
    },
    {
      question: "18. BOGASTOCK sadece ABD borsalarına mı odaklanıyor? Neden?",
      answer: "Evet, sistemimiz %100 ABD Hisse Senedi Piyasalarına (NYSE, NASDAQ, AMEX) odaklıdır. Bunun nedeni, dünyanın en likit, en derin ve algoritmik hareketlere en uygun yapısının ABD borsalarında olmasıdır. Tüm ağırlıklarımız, puanlama kriterlerimiz ve yapay zeka modellerimiz sadece bu piyasa yapısına göre özel olarak kalibre edilmiştir."
    },
    {
      question: "19. Sistemdeki işlemlerde kaybetme olasılığım var mı?",
      answer: "Evet, kesinlikle var. Finansal piyasalarda %100 başarı vaat eden hiçbir dürüst sistem olamaz. BOGA AI'ın tarihsel başarı oranı ve yüksek kazanç istatistikleri geçmiş verilere dayanır ve gelecekte her işlemin karla sonuçlanacağını garanti etmez. Bu nedenle her işlemde riskinizi sınırlamalı ve asla tek bir işleme tüm sermayenizi bağlamamalısınız."
    },
    {
      question: "20. \"Stop Loss\" (Zarar Durdur) kullanmak zorunda mıyım?",
      answer: "Evet, kesinlikle zorundasınız! BOGASTOCK felsefesinin birinci kuralı şudur: \"Stop Loss konmadan asla işlem açılmaz.\" Piyasa her an beklenmedik yönlere hareket edebilir. Sermayenizi büyük çöküşlerden korumanın tek yolu, işleme girmeden önce ne kadar kaybetmeyi göze aldığınızı belirlemek (Stop Loss) ve bu plana sadık kalmaktır. Bir plan yapın, disiplini elden bırakmayın ve duygularınızı ticaretinizden uzak tutun."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="tr" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Sıkça Sorulan Sorular (SSS)
          </h1>
          <p className="text-[#64748b] text-lg">
            BOGASTOCK'un nasıl çalıştığı, analizlerimiz ve sistem işleyişi hakkında merak ettiğiniz tüm detaylar.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-6 hover:border-[#3b82f6]/50 transition-colors">
              <h3 className="text-lg font-medium text-white mb-3 leading-snug">
                {faq.question}
              </h3>
              <div className="text-[#94a3b8] text-sm md:text-base leading-relaxed space-y-4">
                {faq.answer.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer locale="tr" />
    </div>
  );
}
