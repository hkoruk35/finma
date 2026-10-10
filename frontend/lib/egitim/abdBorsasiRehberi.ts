/**
 * ABD Borsası Eğitim Rehberi — içerik (yalnızca Türkçe, /global/tr/egitim).
 *
 * Kaynak: ABD_Borsasi_Egitim_Rehberi.md (kullanıcı dökümanı). Düzenleme notları:
 *  - Yazım hataları ve bozuk cümleler düzeltildi, anlam korundu.
 *  - Bilgi hataları düzeltildi: Kelly formülü, %60/%40 portföy tablosunun toplamı (%105 → %100),
 *    trailing stop örneği, OTCBB'nin bugünkü adı (OTC Pazarları), 2008 krizinin süresi.
 *  - VİDEO BAĞLANTILARI: dökümandaki 62 YouTube bağlantısının 61'i YouTube'da bulunmuyor (oEmbed 404), kalan
 *    1'i İngilizce bir TED-Ed videosu — hiçbiri Türkçe başlıkla eşleşmiyor. Ölü bağlantı yayınlanmaz; her video
 *    başlığı için YouTube'un Türkçe arama sonucuna giden bağlantı üretilir. Gerçek bir video bulunduğunda
 *    `url` alanı doldurulursa doğrudan o video açılır (alan boşsa arama bağlantısı kullanılır).
 */

export type Block =
  | { t: "p"; text: string }
  | { t: "terms"; items: { term: string; text: string }[] }
  | { t: "ul"; title?: string; items: string[] }
  | { t: "note"; tone: "info" | "warn"; text: string }
  | { t: "table"; head: string[]; rows: string[][]; caption?: string }
  | { t: "mistakes"; items: { title: string; bad: string[]; fix: string }[] };

export interface EgitimVideo {
  title: string;
  /** Doğrulanmış doğrudan video bağlantısı (yoksa arama bağlantısı üretilir) */
  url?: string;
  /** Aramada başlığa eklenen ek terim (varsayılan: "Türkçe") */
  extraQuery?: string;
}

export type Level = "Başlangıç" | "Orta" | "İleri";

export interface EgitimSection {
  id: string;
  title: string;
  level: Level;
  group: "Temeller" | "Analiz" | "Strateji ve Risk" | "Pratik" | "Disiplin";
  blocks: Block[];
  videos: EgitimVideo[];
}

export const EGITIM_TITLE = "ABD Borsası Eğitim Rehberi: Sıfırdan Profesyonelliğe";
export const EGITIM_INTRO =
  "ABD borsasını tamamen yeni başlayanlar için hazırlanmış kapsamlı bir rehber. Her bölümün altında, konuyla ilgili Türkçe video eğitimlerine giden bağlantıları bulacaksınız.";

export function videoHref(v: EgitimVideo): string {
  if (v.url) return v.url;
  const q = `${v.title} ${v.extraQuery ?? "Türkçe"}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export const EGITIM_SECTIONS: EgitimSection[] = [
  {
    id: "borsaya-giris",
    title: "Borsaya Giriş: Temel Kavramlar",
    level: "Başlangıç",
    group: "Temeller",
    blocks: [
      {
        t: "p",
        text: "Borsa (Stock Market), şirketlerin hisse senetlerinin alınıp satıldığı merkezi bir pazardır. Bir hisse senedi satın aldığınızda, o şirketin küçük bir parçasının sahibi olursunuz.",
      },
      {
        t: "terms",
        items: [
          { term: "Hisse Senedi (Stock)", text: "Bir şirketin mülkiyetinin bir parçası." },
          { term: "Broker", text: "Alım-satım işlemlerinizi gerçekleştiren aracı kurum." },
          { term: "Borsa Endeksi (Index)", text: "Birden fazla hissenin performansını tek bir sayıyla gösteren ölçü." },
          { term: "Fiyat/Kazanç Oranı (P/E)", text: "Hisse fiyatının, hisse başına kazanca oranı." },
        ],
      },
    ],
    videos: [
      { title: "Borsa Nedir? Başlayanlar İçin Tam Rehber" },
      { title: "Hisse Senedi Piyasası'na Giriş" },
      { title: "Stock Market Temel Kavramları" },
    ],
  },
  {
    id: "abd-borsalari",
    title: "ABD Borsası'nın Yapısı: NYSE, NASDAQ ve OTC",
    level: "Başlangıç",
    group: "Temeller",
    blocks: [
      { t: "p", text: "ABD'de hisse senetlerinin işlem gördüğü başlıca üç pazar vardır:" },
      {
        t: "terms",
        items: [
          {
            term: "NYSE (New York Stock Exchange)",
            text: "Piyasa değeri bakımından dünyanın en büyük borsası. Köklü, yerleşik şirketlerin çoğu burada listelenir.",
          },
          {
            term: "NASDAQ",
            text: "Teknoloji şirketleri için tercih edilen, tamamen elektronik işleyen borsa. Apple, Microsoft ve Alphabet (Google) gibi teknoloji devleri burada işlem görür.",
          },
          {
            term: "OTC Pazarları (eski adıyla OTCBB)",
            text: "Daha küçük ve yeni şirketlerin hisselerinin işlem gördüğü, borsa dışı pazar. Daha az düzenleme ve raporlama zorunluluğu vardır; risk belirgin şekilde yüksektir.",
          },
        ],
      },
    ],
    videos: [
      { title: "NYSE vs NASDAQ: Farklar ve Benzerlikler" },
      { title: "Amerikan Borsası Nerede İşlem Görür?" },
      { title: "Stock Exchange Türleri ve İşleyişi" },
    ],
  },
  {
    id: "endeksler",
    title: "Borsa Endeksleri: S&P 500, Dow Jones, Nasdaq-100",
    level: "Başlangıç",
    group: "Temeller",
    blocks: [
      {
        t: "p",
        text: "Endeksler, belirli hisse senetlerinin bir araya gelmesiyle oluşan ve piyasanın genel performansını gösteren ölçülerdir.",
      },
      {
        t: "terms",
        items: [
          {
            term: "S&P 500",
            text: "500 büyük şirketten oluşur. Amerikan ekonomisinin genel durumunun en yaygın göstergesidir ve uzun vadeli yatırımcıların başvuru noktasıdır.",
          },
          {
            term: "Dow Jones Industrial Average (DJIA)",
            text: "30 büyük şirketten oluşur. 1896'dan beri hesaplanan, en eski endekslerden biridir; daha seçici ve geleneksel şirketlerden oluşur.",
          },
          {
            term: "Nasdaq-100",
            text: "Nasdaq'ta işlem gören, finans dışı en büyük 100 şirketten oluşur. Teknoloji ağırlıklıdır ve S&P 500'e göre daha oynaktır.",
          },
        ],
      },
    ],
    videos: [
      { title: "S&P 500 nedir? Yatırımcılar için Rehber" },
      { title: "Dow Jones, S&P 500, Nasdaq Farkları" },
      { title: "Borsa Endekslerini Anlamak" },
    ],
  },
  {
    id: "hisse-turleri",
    title: "Hisse Senedi Türleri: Growth, Value ve Dividend",
    level: "Başlangıç",
    group: "Temeller",
    blocks: [
      { t: "p", text: "Farklı yatırım stratejileri için farklı hisse türleri vardır." },
      {
        t: "terms",
        items: [
          {
            term: "Growth Stocks (Büyüme Hisseleri)",
            text: "Gelirleri ve fiyatları hızla artan, genç ve yüksek potansiyelli şirketler. Çoğu temettü ödemez ya da çok az öder (Tesla, Amazon gibi). Volatilite ve risk yüksektir.",
          },
          {
            term: "Value Stocks (Değer Hisseleri)",
            text: "Kazançlarına ve varlıklarına göre ucuz fiyatlanan, sağlam şirketler. Çoğu temettü öder; daha istikrarlı ve uzun vadeli bir yatırım sunar. Makine, enerji ve finans sektörlerinde sık görülür.",
          },
          {
            term: "Dividend Stocks (Temettü Hisseleri)",
            text: "Düzenli kâr payı dağıtan hisseler. Düzenli gelir sağlar; emekliler ve pasif gelir arayanlar için uygundur. %3-5 temettü verimi yaygındır.",
          },
          {
            term: "Blue Chip Stocks (Mavi Çip)",
            text: "Köklü, güvenilir ve büyük şirketler (Coca-Cola, Procter & Gamble gibi). Daha istikrarlı ve görece güvenli kabul edilir.",
          },
        ],
      },
    ],
    videos: [
      { title: "Growth Stocks vs Value Stocks" },
      { title: "Dividend Stocks Nasıl Çalışır?" },
      { title: "Blue Chip Stocks Yatırımı" },
    ],
  },
  {
    id: "finansal-metrikler",
    title: "Temel Finansal Metrikler: P/E, EPS, Piyasa Değeri",
    level: "Başlangıç",
    group: "Temeller",
    blocks: [
      { t: "p", text: "Bir şirketi değerlendirirken sık kullanılan temel metrikler:" },
      {
        t: "terms",
        items: [
          {
            term: "EPS (Earnings Per Share — Hisse Başına Kazanç)",
            text: "Şirketin net kârının hisse sayısına bölünmesiyle bulunur: Net Kâr / Hisse Sayısı. Yüksek EPS, daha kârlı bir şirkete işaret eder.",
          },
          {
            term: "P/E (Price-to-Earnings — Fiyat/Kazanç Oranı)",
            text: "Hisse fiyatının EPS'ye oranıdır. Düşük P/E ucuz, yüksek P/E ise yüksek beklenti (pahalı) anlamına gelebilir. Genel ortalama 15-25 civarındadır; sektöre göre ciddi farklılık gösterir.",
          },
          {
            term: "Market Cap (Piyasa Değeri)",
            text: "Şirketin toplam değeri: Hisse Fiyatı × Hisse Sayısı. Large Cap: 10 milyar $ üzeri (daha güvenli) · Mid Cap: 2-10 milyar $ (orta risk) · Small Cap: 2 milyar $ altı (yüksek risk).",
          },
          {
            term: "P/B (Price-to-Book — Fiyat/Defter Değeri)",
            text: "Fiyatın defter değerine oranı. 1'in altı, hissenin defter değerinin altında işlem gördüğünü gösterebilir; tek başına alım sinyali değildir.",
          },
          {
            term: "Temettü Verimi (Dividend Yield)",
            text: "Yıllık temettünün hisse fiyatına oranı. %2-5 arası yaygın bir aralıktır.",
          },
        ],
      },
    ],
    videos: [
      { title: "P/E Ratio Nasıl Kullanılır?" },
      { title: "Finansal Metrikler 101" },
      { title: "Market Cap Açıklaması" },
    ],
  },
  {
    id: "teknik-analiz",
    title: "Teknik Analiz: Grafik Desenleri ve İndikatörler",
    level: "Orta",
    group: "Analiz",
    blocks: [
      {
        t: "p",
        text: "Teknik analiz, geçmiş fiyat ve hacim verilerine bakarak gelecekteki fiyat hareketlerini tahmin etmeye çalışan yöntemdir.",
      },
      {
        t: "terms",
        items: [
          {
            term: "Head and Shoulders (Omuz-Baş-Omuz)",
            text: "Düşüş eğilimine dönüş sinyali. Üç tepeden oluşur, ortadaki en yüksektir. Formasyon, boyun çizgisinin aşağı kırılmasıyla teyit edilir.",
          },
          {
            term: "Double Top / Double Bottom (Çift Tepe / Çift Dip)",
            text: "Çift tepe düşüş, çift dip yükseliş sinyali verir. Fiyat iki benzer seviyeyi test eder.",
          },
          {
            term: "Destek ve Direnç",
            text: "Destek: fiyatın düşerken durma eğilimi gösterdiği seviye. Direnç: fiyatın yükselirken durma eğilimi gösterdiği seviye. Bu seviyeler tekrar tekrar test edilebilir.",
          },
          {
            term: "Trend Çizgileri",
            text: "Yükselen trend için dip noktaları, düşen trend için tepe noktaları birleştirilir. Trendin geçerli olup olmadığını gösterir.",
          },
        ],
      },
      {
        t: "ul",
        title: "Popüler indikatörler",
        items: [
          "Hareketli Ortalama (Moving Average): Son N günün ortalama fiyatı. MA50 ve MA200 sık kullanılır; fiyatın hareketli ortalamanın üstüne çıkması yükseliş eğilimi olarak yorumlanır.",
          "RSI (Relative Strength Index): 0-100 arasında dalgalanan momentum göstergesi. 70 üzeri aşırı alım (overbought), 30 altı aşırı satım (oversold) olarak yorumlanır.",
          "MACD: İki hareketli ortalama arasındaki farka dayanır; trend değişimi ve momentum sinyalleri verir.",
          "Bollinger Bantları: Standart sapmaya dayalı volatilite göstergesi. Fiyat çoğunlukla bantlar arasında kalır; bantların genişlemesi volatilitenin arttığını, daralması azaldığını gösterir.",
        ],
      },
      {
        t: "note",
        tone: "info",
        text: "Hiçbir indikatör tek başına güvenilir bir sinyal vermez. Birden fazla teyit arayın ve her işlemde risk yönetimi uygulayın.",
      },
    ],
    videos: [
      { title: "Teknik Analiz Başlangıç Rehberi" },
      { title: "Grafik Desenleri: Head and Shoulders" },
      { title: "Moving Average Nasıl Kullanılır" },
      { title: "RSI İndikatörü Açıklaması" },
      { title: "MACD Stratejisi" },
      { title: "Bollinger Bands Tam Rehber" },
    ],
  },
  {
    id: "temel-analiz",
    title: "Temel (Fundamental) Analiz: İşletme Analizi",
    level: "Orta",
    group: "Analiz",
    blocks: [
      {
        t: "p",
        text: "Temel analiz, bir şirketin gerçek değerini belirlemek için işletme verilerini ve finansal tablolarını inceleme yöntemidir.",
      },
      {
        t: "terms",
        items: [
          {
            term: "Gelir Tablosu (Income Statement)",
            text: "Gelir (Revenue): toplam satış · Brüt Kâr: gelir − üretim maliyeti · İşletme Kârı: tüm işletme giderleri düştükten sonra kalan · Net Kâr: nihai kâr/zarar. Yıllık büyüme eğilimi önemlidir.",
          },
          {
            term: "Bilanço (Balance Sheet)",
            text: "Aktifler: şirketin sahip olduğu varlıklar · Yükümlülükler: borçlar · Özsermaye: aktifler − yükümlülükler · Likidite: varlıkları nakde çevirebilme yeteneği.",
          },
          {
            term: "Nakit Akış Tablosu (Cash Flow)",
            text: "İşletme nakit akışı: günlük operasyondan gelen nakit · Yatırım nakit akışı: yatırımlar ve varlık satışlarından gelen/giden nakit · Finansman nakit akışı: borçlanma ve özsermaye hareketleri. Sürekli pozitif işletme nakit akışı sağlıklı işletmenin işaretidir.",
          },
        ],
      },
      {
        t: "terms",
        items: [
          { term: "Cari Oran (Current Ratio)", text: "Dönen Varlıklar / Kısa Vadeli Yükümlülükler. 1,5-3,0 arası genellikle iyi kabul edilir; yüksek oran iyi likiditeye işaret eder." },
          { term: "Borç/Özsermaye (Debt-to-Equity)", text: "Toplam Borç / Özsermaye. Düşük oran daha az finansal risk demektir; sektöre göre değişir." },
          { term: "ROE (Özsermaye Kârlılığı)", text: "Net Kâr / Özsermaye × 100. Yüksek ROE verimli yönetime işaret eder; %15 üzeri genellikle iyi kabul edilir." },
          { term: "ROA (Aktif Kârlılığı)", text: "Net Kâr / Toplam Aktif. Şirketin varlıklarını ne kadar verimli kullandığını gösterir." },
        ],
      },
    ],
    videos: [
      { title: "Fundamental Analiz 101" },
      { title: "Finansal Tabloları Nasıl Okursunuz?" },
      { title: "Şirket Analizi: P/E Oranından Satış Büyümesine" },
      { title: "Cash Flow Nedir ve Neden Önemlidir?" },
    ],
  },
  {
    id: "islem-tarzlari",
    title: "Day Trading, Swing Trading ve Uzun Vadeli Yatırım",
    level: "Orta",
    group: "Strateji ve Risk",
    blocks: [
      { t: "p", text: "Farklı zaman ufukları için farklı stratejiler vardır." },
      {
        t: "terms",
        items: [
          {
            term: "Day Trading (Gün İçi Alım-Satım)",
            text: "Pozisyonlar aynı gün açılıp kapatılır. Volatil hisseler tercih edilir. Yüksek risk ve yüksek potansiyel kazanç barındırır; deneyim ve disiplin gerektirir. Kısa vadeli kazançlar yüksek vergi oranına tabidir.",
          },
          {
            term: "Swing Trading",
            text: "Pozisyonlar yaklaşık 2-7 gün tutulur. Teknik analiz ve trend takibi kullanılır. Gün boyu ekran başında olmayı gerektirmez ve risk daha kontrol edilebilirdir. Swing başına %2-5 hedefleyen yaklaşımlar yaygındır.",
          },
          {
            term: "Position Trading",
            text: "Haftalar veya aylar boyunca tutulur. Uzun vadeli trendi takip eder; daha az işlem yapılır. Temel ve teknik analiz birlikte kullanılır.",
          },
          {
            term: "Long-Term Investing (Uzun Vadeli Yatırım)",
            text: "Yıllarca tutulur; temettü ve bileşik getiriyle büyür. Minimum işlem ve stres, vergi avantajı sağlar. S&P 500 gibi endekslere yatırım yaygın bir yoldur; emeklilik portföyleri için uygundur.",
          },
        ],
      },
      {
        t: "note",
        tone: "warn",
        text: "Pattern Day Trader (PDT) kuralı: ABD'de marjin hesabında 5 iş günü içinde 4 veya daha fazla gün içi işlem yapan hesaplar için en az 25.000 $ özsermaye şartı aranır. Kural değişikliği gündemde olabilir; güncel koşulları mutlaka brokerınızdan teyit edin.",
      },
    ],
    videos: [
      { title: "Day Trading vs Swing Trading: Hangisi Daha İyi?" },
      { title: "Swing Trading Stratejileri" },
      { title: "Long-Term Investing Rehberi" },
      { title: "Pattern Day Trading Kuralı Açıklanmıştır" },
    ],
  },
  {
    id: "portfoy",
    title: "Portföy Oluşturma ve Çeşitlendirme",
    level: "Orta",
    group: "Strateji ve Risk",
    blocks: [
      { t: "p", text: "Riski azaltmanın anahtarı: tüm yumurtaları aynı sepete koymamak." },
      {
        t: "ul",
        title: "Çeşitlendirme türleri",
        items: [
          "Sektör çeşitlendirmesi: Teknoloji, sağlık, finans, enerji, tüketici gibi farklı sektörlere yatırım yapın; bir sektördeki kriz diğerlerini aynı ölçüde etkilemez.",
          "Piyasa değeri çeşitlendirmesi: Large Cap %50 (güvenli) · Mid Cap %30 (orta risk) · Small Cap %20 (yüksek potansiyel).",
          "Coğrafi çeşitlendirme: ABD %70-80 · Uluslararası gelişmiş ülkeler %15-20 · Gelişmekte olan piyasalar %5-10.",
        ],
      },
      {
        t: "table",
        caption: "Örnek ağırlık dağılımları (yüzde)",
        head: ["Model", "Large Cap", "Mid Cap", "Small Cap", "Uluslararası", "Tahvil"],
        rows: [
          ["%100 hisse — agresif, genç yatırımcı", "40", "30", "20", "10", "0"],
          ["%60 hisse / %40 tahvil — dengeli", "25", "15", "10", "10", "40"],
          ["%40 hisse / %60 tahvil — muhafazakâr, emekliliğe yakın", "20", "10", "5", "5", "60"],
        ],
      },
      {
        t: "ul",
        title: "Endeks fonu yatırımı (pasif yatırım)",
        items: [
          "VOO: Vanguard S&P 500 ETF",
          "VTI: Vanguard Total Stock Market",
          "VXUS: Vanguard International Stocks",
          "BND: Vanguard Total Bond Market",
          "Düşük maliyet ve otomatik çeşitlendirme sağlar.",
        ],
      },
      {
        t: "p",
        text: "Rebalancing (yeniden dengeleme): Portföyü yılda bir kez gözden geçirin. Fiyat hareketleri yüzdeleri kaydırmış olabilir; amaç risk seviyesini sabit tutmaktır.",
      },
    ],
    videos: [
      { title: "Portföy Oluşturma Başlayanlar İçin" },
      { title: "Çeşitlendirme Nedir ve Neden Önemlidir" },
      { title: "İndeks Fonları ile Yatırım" },
      { title: "Modern Portföy Teorisi" },
    ],
  },
  {
    id: "risk-yonetimi",
    title: "Risk Yönetimi: Stop Loss ve Pozisyon Boyutlandırma",
    level: "Orta",
    group: "Strateji ve Risk",
    blocks: [
      { t: "p", text: "En başarılı yatırımcılar, kazancı büyütmekten önce kaybı küçük tutmaya odaklanır." },
      {
        t: "terms",
        items: [
          {
            term: "Sabit Yüzde Stop Loss",
            text: "Giriş fiyatının %5-10 altına konur. Basit ve etkilidir, kaybı hızla sınırlar. Örnek: 100 $'dan giriş → 95 $'da stop.",
          },
          {
            term: "Teknik Seviye Stop Loss",
            text: "Önceki destek seviyesinin altına yerleştirilir; daha anlamlıdır ve genellikle daha iyi risk/ödül oranı sağlar. Örnek: destek 95 $ ise stop 94 $.",
          },
          {
            term: "Trailing Stop Loss (İz Süren Stop)",
            text: "Fiyat yükseldikçe stop da yukarı taşınır; kâr korunur. Platform tarafından otomatik yapılabilir. Örnek: %5 trailing, zirve 110 $ ise stop 104,50 $.",
          },
        ],
      },
      {
        t: "ul",
        title: "Pozisyon boyutlandırma",
        items: [
          "Risk yüzdesi yöntemi: Her işlemde sermayenin %1-2'sini riske atın. Pozisyon büyüklüğü = (Sermaye × Risk %) / hisse başına risk.",
          "Örnek: 10.000 $ × %1 = 100 $ risk. Giriş 100 $, stop 95 $ ise hisse başına risk 5 $ → 20 hisse.",
          "Kelly kriteri (ileri seviye): f* = K − (1 − K) / R; burada K kazanma oranı, R ortalama kazanç / ortalama kayıp oranıdır. Örnek: K = %50, R = 2 → f* = %25. Tam Kelly agresiftir; pratikte genellikle yarısı ya da çeyreği kullanılır.",
        ],
      },
      {
        t: "ul",
        title: "Risk/ödül ve hesap koruma",
        items: [
          "En az 1:2 hedefleyin (1 $ risk, 2 $ kazanç); daha iyisi 1:3 veya 1:4. Bu oranlar kayıpları telafi etmeyi kolaylaştırır.",
          "Günlük azami kayıp: Hesabın %2-3'ünü kaybederseniz o gün işlemi bırakın.",
          "Haftalık azami kayıp: %5-10'a ulaşırsanız durun. Hem sermayeyi hem de ruh sağlığınızı korur.",
        ],
      },
    ],
    videos: [
      { title: "Stop Loss Stratejileri" },
      { title: "Position Sizing ve Risk Yönetimi" },
      { title: "Risk/Reward Oranı Nedir?" },
      { title: "Trailing Stop Loss Nasıl Çalışır?" },
    ],
  },
  {
    id: "vergi",
    title: "Vergi Muhasebesi ve Yatırımcı Sorumlulukları",
    level: "Orta",
    group: "Pratik",
    blocks: [
      {
        t: "note",
        tone: "warn",
        text: "Bu bölüm ABD vergi kurallarını anlatır. Türkiye'de yerleşik yatırımcıların vergi yükümlülüğü farklıdır; kendi durumunuz için bir mali müşavire danışın.",
      },
      {
        t: "terms",
        items: [
          {
            term: "Kısa Vadeli Sermaye Kazancı",
            text: "1 yıldan kısa tutulan hisselerden elde edilir. Adi gelir vergisi oranı (%10-37) uygulanır. Day trading ve swing trading buraya girer; vergi yükü daha yüksektir.",
          },
          {
            term: "Uzun Vadeli Sermaye Kazancı",
            text: "1 yıldan uzun tutulan hisselerden elde edilir. Tercihli oranlar (%0, %15, %20) uygulanır; vergi yükü çok daha düşüktür.",
          },
          {
            term: "Temettü Vergisi",
            text: "Nitelikli temettülerde %0-20, niteliksiz temettülerde adi gelir vergisi oranı uygulanır; gelir düzeyinize bağlıdır.",
          },
          {
            term: "Tax-Loss Harvesting (Vergi Zararı Kullanımı)",
            text: "Zarardaki yatırımları satıp zararı kayda geçirerek kârları dengelemektir. Kârları aşan zarar, yılda 3.000 $'a kadar olağan gelirden düşülebilir; kalanı sonraki yıllara aktarılır.",
          },
        ],
      },
    ],
    videos: [
      { title: "Yatırımcılar İçin Vergi Rehberi" },
      { title: "Kısa Vadeli vs Uzun Vadeli Kazanç" },
      { title: "Tax-Loss Harvesting Stratejisi" },
      { title: "Brokerage Statements Nasıl Okunur?" },
    ],
  },
  {
    id: "broker",
    title: "Broker Seçimi ve Ticaret Platformları",
    level: "Başlangıç",
    group: "Pratik",
    blocks: [
      { t: "p", text: "Doğru broker, yatırım yolculuğunun temelini oluşturur. Popüler platformlar:" },
      {
        t: "terms",
        items: [
          { term: "Robinhood", text: "Başlayanlar için uygun; komisyonsuz, düşük minimum bakiye, opsiyon işlemleri destekli, mobil öncelikli arayüz. Yatırımcı koruması: SIPC (ilk 500.000 $)." },
          { term: "Fidelity", text: "Profesyonel araçlar, geniş araştırma ve eğitim kaynakları, 0 $ minimum bakiye. Arayüzü daha karmaşıktır." },
          { term: "Charles Schwab", text: "Kapsamlı platform, düşük komisyonlar, güçlü müşteri hizmeti; aktif yatırımcılar için uygundur." },
          { term: "tastytrade (eski adıyla Tastyworks)", text: "Opsiyon yatırımcıları için tasarlanmış; düşük komisyonlar, hızlı işlem. Hisse seçeneği daha kısıtlıdır." },
        ],
      },
      {
        t: "ul",
        title: "Broker seçim kriterleri",
        items: [
          "Komisyonlar ve ücretler",
          "Minimum bakiye",
          "Yazılım ve uygulama kalitesi",
          "Müşteri hizmeti",
          "Yatırımcı koruması (SIPC)",
          "Araştırma araçları",
        ],
      },
      {
        t: "note",
        tone: "info",
        text: "Türkiye'den hesap açabilme koşulları brokera göre değişir; hesap açmadan önce brokerın kabul ettiği ülkeleri ve şartlarını kontrol edin.",
      },
    ],
    videos: [
      { title: "En İyi Broker Seçimi" },
      { title: "Robinhood vs Fidelity vs Charles Schwab" },
      { title: "Thinkorswim Platformu Rehberi" },
      { title: "Başlayanlar için Broker Karşılaştırması" },
    ],
  },
  {
    id: "piyasa-donguleri",
    title: "Piyasa Döngüleri: Boğa, Ayı, Düzeltme ve Çöküş",
    level: "Orta",
    group: "Pratik",
    blocks: [
      { t: "p", text: "Piyasa türlerini ve döngülerini anlamak, başarı için kritiktir." },
      {
        t: "terms",
        items: [
          {
            term: "Bull Market (Boğa Piyasası)",
            text: "Fiyatlar genel olarak yükselişte, yatırımcı duyarlılığı iyimserdir. S&P 500'ün dipten %20 ve üzeri yükselmesi boğa piyasası kabul edilir; aylar ya da yıllar sürebilir.",
          },
          {
            term: "Bear Market (Ayı Piyasası)",
            text: "Fiyatlar genel olarak düşüşte, yatırımcılar endişeli ve satış baskısı yüksektir. Tepeden %20 ve üzeri düşüş ayı piyasası kabul edilir; aylar ya da yıllar sürebilir.",
          },
          {
            term: "Correction (Düzeltme)",
            text: "%10-19 arası düşüş. Normal piyasa döngüsünün parçasıdır; boğa piyasalarının içinde de görülür.",
          },
          {
            term: "Crash (Çöküş)",
            text: "Günler veya haftalar içinde yaşanan hızlı ve sert (%20 ve üzeri) düşüş; panik satışı ve korku hâkimdir.",
          },
        ],
      },
      {
        t: "ul",
        title: "Tarihsel örnekler",
        items: [
          "2020 COVID çöküşü: yaklaşık %34 düşüş, kabaca 5 haftada.",
          "2008 finansal krizi: tepeden dibe yaklaşık %57 düşüş, yaklaşık 17 ayda.",
          "1987 Black Monday: tek günde yaklaşık %20 düşüş.",
        ],
      },
    ],
    videos: [
      { title: "Bull Market vs Bear Market Açıklanmıştır" },
      { title: "Piyasa Döngüleri" },
      { title: "Market Crash Sırasında Ne Yapmalı?" },
      { title: "Tarihsel Piyasa Çöküşleri" },
    ],
  },
  {
    id: "ortak-hatalar",
    title: "Ortak Hatalar ve Nasıl Kaçınılır",
    level: "Başlangıç",
    group: "Disiplin",
    blocks: [
      { t: "p", text: "Başarısız yatırımcılar çoğunlukla aynı hataları tekrarlar; başarılılar bunları bilir ve kaçınır." },
      {
        t: "mistakes",
        items: [
          {
            title: "1. Duygusal işlem yapmak",
            bad: ["Korkuyla, fırsat varken satmak", "Açgözlülükle kâr almadan tüm trendi yakalamaya çalışmak", "Zarardaki pozisyonu \"toparlar\" umuduyla tutmak"],
            fix: "Önceden plan yapın ve plana bağlı kalın.",
          },
          {
            title: "2. Aşırı işlem (overtrading)",
            bad: ["Her fırsatta al-sat yapmak", "Çok sık işlem: yüksek maliyet ve vergi"],
            fix: "Haftada 2-3 yüksek kaliteli işlem hedefleyin.",
          },
          {
            title: "3. Yeterli araştırma yapmamak",
            bad: ["Başkalarının tavsiyesiyle hisse almak", "Haberleri ve finansalları okumadan almak"],
            fix: "Kendi araştırmanızı yapın, finansalları kontrol edin.",
          },
          {
            title: "4. Yanlış pozisyon boyutu",
            bad: ["Tüm parayı tek hisseye yatırmak", "Kaybederken pozisyonu büyütmek"],
            fix: "İşlem başına küçük risk alın (sermayenin %1-2'si) ve küçük başlayın.",
          },
          {
            title: "5. Stop loss kullanmamak",
            bad: ["Zarardaki pozisyonu süresiz tutmak", "Kötü kararı \"düzelir\" umuduyla büyütmek"],
            fix: "Her işlemde stop belirleyin ve uygulayın.",
          },
          {
            title: "6. Yükselen hisseyi kovalamak (FOMO)",
            bad: ["Hisse yükselirken, tepeye yakın almak", "Fırsatı kaçırma korkusuyla girmek"],
            fix: "Planlı girişler yapın; destek bölgelerini bekleyin.",
          },
          {
            title: "7. \"Mutlaka geri gelir\" psikolojisi",
            bad: ["Zarardaki hisseye para eklemek (maliyet düşürme tuzağı)", "\"Kesinlikle toparlanır\" umuduna tutunmak"],
            fix: "Zararı kabul edin ve başka fırsatlara bakın.",
          },
          {
            title: "8. Aşırı kaldıraç kullanmak",
            bad: ["Marjin hesabıyla 2x-3x kaldıraç", "Küçük hareketlerin büyük kayıplara dönüşmesi"],
            fix: "Başlangıçta kaldıraç kullanmayın.",
          },
          {
            title: "9. Yetersiz çeşitlendirme",
            bad: ["Tek sektöre odaklanmak", "Aşırı yoğunlaşmış portföy"],
            fix: "En az 10-15 farklı hisse ve 5+ sektör hedefleyin.",
          },
          {
            title: "10. İşlem günlüğü tutmamak",
            bad: ["Hangi işlemlerin neden başarılı veya başarısız olduğunu bilememek", "Tekrarlayan hataları fark edememek"],
            fix: "Tüm işlemleri kaydedin; gerekçeyi ve sonucu not edin.",
          },
        ],
      },
      {
        t: "ul",
        title: "Başarı için ipuçları",
        items: [
          "Plan yapın, plana bağlı kalın.",
          "Duygularınızı kontrol edin; disipline güvenin.",
          "Kaybederken çabuk durun, kazanırken sabırlı olun.",
          "Sürekli öğrenin ve kendinizi geliştirin.",
          "Risk yönetimi her şeyden önemlidir.",
          "Hızlı zengin olmaya çalışmayın; uzun vadeli düşünün.",
        ],
      },
    ],
    videos: [
      { title: "Yatırımcıların Yaptığı 10 Büyük Hata" },
      { title: "Emotional Trading Kontrolü" },
      { title: "Overtrading Neden Kötüdür?" },
      { title: "Stop Loss Neden Önemlidir?" },
      { title: "Ticaret Günlüğü Nasıl Tutulur" },
    ],
  },
  {
    id: "strateji-gelistirme",
    title: "Kendi Stratejini Geliştir: Backtesting ve Forward Testing",
    level: "İleri",
    group: "Strateji ve Risk",
    blocks: [
      { t: "p", text: "Yalnızca başkalarının stratejilerini takip etmek yeterli değildir; kendi stratejinizi test etmeyi öğrenin." },
      {
        t: "terms",
        items: [
          {
            term: "Backtesting (Geçmiş Veriyle Test)",
            text: "Stratejiyi geçmiş 5-10 yıllık veri üzerinde sınamaktır: \"Bu stratejiyi 2015'te uygulasaydım ne olurdu?\" sorusuna cevap arar ve kazanma oranını ile kârlılığı gösterir.",
          },
          {
            term: "Forward Testing (Paper Trading)",
            text: "Stratejiyi gerçek para riske etmeden, canlı piyasa koşullarında sınamaktır. Geçmiş testlerde görünmeyen faktörleri (gecikme, psikoloji, işlem maliyeti) ortaya çıkarır.",
          },
        ],
      },
      {
        t: "ul",
        title: "Backtest adımları",
        items: [
          "Stratejiyi yazılı tanımlayın (kurallar net olsun).",
          "Tarihsel veriyi indirin.",
          "İşlemleri simüle edin (elle ya da yazılımla).",
          "Kazanç ve kaybı hesaplayın.",
          "İstatistikleri analiz edin.",
        ],
      },
      {
        t: "ul",
        title: "Önemli metrikler",
        items: [
          "Win Rate: Kazanan işlem yüzdesi (risk/ödül oranına bağlı olarak %40 ve üzeri genellikle hedeflenir).",
          "Ortalama Kazanç / Ortalama Kayıp oranı.",
          "Profit Factor: Toplam kazanç / toplam kayıp.",
          "Drawdown: Zirveden en büyük düşüş.",
          "Risk/Reward oranı: Her işlemde hedeflenen oran.",
        ],
      },
    ],
    videos: [
      { title: "Backtest Nedir ve Nasıl Yapılır" },
      { title: "TradingView'da Backtesting" },
      { title: "Paper Trading Rehberi" },
      { title: "Kendi Trading Stratejini Geliştir" },
      { title: "Golden Cross Stratejisi" },
    ],
  },
  {
    id: "sonuc",
    title: "Sonuç: Yatırım Yolculuğunda Başarı İçin Son Tavsiyeler",
    level: "Başlangıç",
    group: "Disiplin",
    blocks: [
      { t: "p", text: "ABD borsasını öğrenme yolculuğuna başladığınız için tebrikler! Nihai tavsiyeler:" },
      {
        t: "ul",
        title: "Hemen başlayın",
        items: [
          "Bir broker seçin (başlangıç için Robinhood ya da Fidelity sık tercih edilir).",
          "Kaybetmeyi göze alabileceğiniz küçük bir tutarla (100-500 $) başlayın.",
          "Önce gerçek para riske etmeden paper trading yapın (örneğin TradingView).",
          "Basit stratejilerle başlayın, yavaş yavaş genişletin.",
        ],
      },
      {
        t: "ul",
        title: "Her gün öğrenin",
        items: [
          "Teknik ve temel analiz konularını okuyun.",
          "Başarılı yatırımcıları ve fonları takip edin (Warren Buffett, endeks fonları).",
          "Podcast dinleyin (Marketplace, ChooseFI).",
          "Video eğitimleri izleyin.",
          "Kitap okuyun: \"The Intelligent Investor\", \"Market Wizards\".",
        ],
      },
      {
        t: "ul",
        title: "Disipline bağlı kalın",
        items: [
          "Plan yapın, plana bağlı kalın.",
          "Duygularınızı kontrol edin.",
          "Risk yönetimini asla göz ardı etmeyin.",
          "Kaybederken öğrenin, kazanırken mütevazı kalın.",
          "Kayıpların yaratacağı stresi taşıyıp taşıyamayacağınızı kendinize dürüstçe sorun.",
        ],
      },
      {
        t: "ul",
        title: "Gerçekçi beklentiler",
        items: [
          "Yılda %10-15 getiri çok iyi bir sonuçtur.",
          "Ayın başında %0-2 arası dalgalanma normaldir.",
          "İlk 2 yıl çoğunlukla öğrenme ve hata yapma dönemidir.",
          "Hızlı zenginlik yoktur; istikrarlı, sabırlı büyüme vardır.",
        ],
      },
      {
        t: "note",
        tone: "warn",
        text: "Yasal uyarı: Bu sayfadaki içerik genel eğitim amaçlıdır ve yatırım tavsiyesi değildir. Tüm yatırımlar risk içerir; geçmiş performans gelecekteki sonuçları garanti etmez. Kendi araştırmanızı yapın.",
      },
    ],
    videos: [
      { title: "Başlangıç Rehberi Özet" },
      { title: "İlk 1 Yılda Neleri Beklemelisin" },
      { title: "Yatırımcı Mindset" },
      { title: "Warren Buffett'tan Başlangıç Tavsiyesi" },
    ],
  },
];

export const EGITIM_GROUPS: EgitimSection["group"][] = ["Temeller", "Analiz", "Strateji ve Risk", "Pratik", "Disiplin"];

export function egitimStats() {
  const videos = EGITIM_SECTIONS.reduce((a, s) => a + s.videos.length, 0);
  return { sections: EGITIM_SECTIONS.length, videos };
}
