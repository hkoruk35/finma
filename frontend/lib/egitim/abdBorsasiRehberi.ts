/**
 * ABD Borsası Eğitim Rehberi — içerik (yalnızca Türkçe, /global/tr/egitim).
 *
 * Kaynak: ABD_Borsasi_Egitim_Rehberi.md + infografik görseller (public/egitim/*.webp, BogaStock.com filigranlı).
 * Videolar: dökümandaki bağlantılar geçersiz olduğu için her bölüm, ABD borsası odaklı Türkçe YouTube aramasına gider.
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
}

export interface EgitimImage {
  src: string;
  alt: string;
}

export type Level = "Başlangıç" | "Orta" | "İleri";

export interface EgitimSection {
  id: string;
  title: string;
  level: Level;
  group: "Temeller" | "Analiz" | "Strateji ve Risk" | "Pratik" | "Disiplin";
  blocks: Block[];
  images?: EgitimImage[];
  video: EgitimVideo;
}

export const EGITIM_TITLE = "ABD Borsası Eğitim Rehberi: Sıfırdan Profesyonelliğe";
export const EGITIM_INTRO =
  "ABD borsasını tamamen yeni başlayanlar için hazırlanmış kapsamlı bir rehber. Her bölümde özet infografik ve konuyla ilgili Türkçe video eğitimlerine giden bir bağlantı bulacaksınız.";

export function videoHref(v: EgitimVideo): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${v.title} Türkçe`)}`;
}

export const EGITIM_SECTIONS: EgitimSection[] = [
  {
    id: "borsaya-giris",
    title: "Borsaya Giriş: Temel Kavramlar",
    level: "Başlangıç",
    group: "Temeller",
    images: [{ src: "/egitim/panel-1.webp", alt: "Özet infografik" }],
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
    video: { title: "ABD Borsası Nedir? Yeni Başlayanlar İçin" },
  },
  {
    id: "abd-borsalari",
    title: "ABD Borsası'nın Yapısı: NYSE, NASDAQ ve OTC",
    level: "Başlangıç",
    group: "Temeller",
    images: [{ src: "/egitim/panel-2.webp", alt: "Özet infografik" }],
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
    video: { title: "NYSE ve NASDAQ Farkları" },
  },
  {
    id: "endeksler",
    title: "Borsa Endeksleri: S&P 500, Dow Jones, Nasdaq-100",
    level: "Başlangıç",
    group: "Temeller",
    images: [{ src: "/egitim/panel-3.webp", alt: "Özet infografik" }],
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
    video: { title: "S&P 500, Dow Jones ve Nasdaq-100 Nedir?" },
  },
  {
    id: "hisse-turleri",
    title: "Hisse Senedi Türleri: Growth, Value ve Dividend",
    level: "Başlangıç",
    group: "Temeller",
    images: [{ src: "/egitim/panel-4.webp", alt: "Özet infografik" }],
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
    video: { title: "Growth, Value ve Dividend Hisseleri" },
  },
  {
    id: "finansal-metrikler",
    title: "Temel Finansal Metrikler: P/E, EPS, Piyasa Değeri",
    level: "Başlangıç",
    group: "Temeller",
    images: [{ src: "/egitim/panel-5.webp", alt: "Özet infografik" }],
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
    video: { title: "P/E, EPS ve Piyasa Değeri Nedir?" },
  },
  {
    id: "teknik-analiz",
    title: "Teknik Analiz: Grafik Desenleri ve İndikatörler",
    level: "Orta",
    group: "Analiz",
    images: [{ src: "/egitim/panel-6.webp", alt: "Özet infografik" }],
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
    video: { title: "ABD Hisselerinde Teknik Analiz" },
  },
  {
    id: "mum-formasyonlari",
    title: "Mum Formasyonları: Fiyatın Dili",
    level: "Orta",
    group: "Analiz",
    images: [{ src: "/egitim/panel-7.webp", alt: "Mum formasyonları infografiği" }],
    blocks: [
      {
        t: "p",
        text: "Mum formasyonları, fiyat hareketlerinin psikolojisini gösterir ve olası dönüş ya da devam sinyalleri verir. Tek başına yeterli değildir; hacim ve trend yönüyle birlikte değerlendirin.",
      },
      {
        t: "terms",
        items: [
          { term: "Tek mum formasyonları", text: "Doji (kararsızlık), Hammer (yükseliş dönüşü), Shooting Star (düşüş dönüşü), Long Green (güçlü yükseliş), Long Red (güçlü düşüş)." },
          { term: "İkili mum formasyonları", text: "Bullish Engulfing (yükseliş), Bearish Engulfing (düşüş), Harami (ters dönüş), Piercing Line (yükseliş)." },
          { term: "Devam formasyonları", text: "Three White Soldiers (yükseliş devamı), Three Black Crows (düşüş devamı)." },
        ],
      },
    ],
    video: { title: "Mum Formasyonları (ABD Hisseleri)" },
  },
  {
    id: "breakout",
    title: "Breakout Senaryosu: Yeni Trendin İlk Adımı",
    level: "Orta",
    group: "Analiz",
    images: [{ src: "/egitim/panel-8.webp", alt: "Breakout senaryosu infografiği" }],
    blocks: [
      { t: "p", text: "Breakout, fiyatın önemli bir direnç veya destek seviyesini kırarak yeni bir trend başlatmasıdır." },
      {
        t: "terms",
        items: [
          { term: "Yukarı yönlü breakout", text: "Direnç seviyesi kırılır, hacim artar ve yeni bir yükseliş trendi başlar." },
          { term: "Aşağı yönlü breakout", text: "Destek seviyesi kırılır, hacim artar ve yeni bir düşüş trendi başlar." },
        ],
      },
      { t: "note", tone: "info", text: "Kırılımın gücü hacimle ölçülür. Hacimsiz kırılımlar çoğunlukla yanlış kırılımdır (false breakout); güçlü bir mum kapanışıyla teyit bekleyin." },
    ],
    video: { title: "Breakout Stratejisi (ABD Hisseleri)" },
  },
  {
    id: "pullback",
    title: "Pullback Senaryosu: Sağlıklı Düzeltme, Güçlü Devam",
    level: "Orta",
    group: "Analiz",
    images: [{ src: "/egitim/panel-9.webp", alt: "Pullback senaryosu infografiği" }],
    blocks: [
      { t: "p", text: "Pullback, trend yönünde ilerleyen fiyatın kısa süreli geri çekilme yaşayıp trendine devam etmesidir. Trend içinde daha iyi bir giriş noktası sunar." },
      {
        t: "terms",
        items: [
          { term: "Yükseliş trendinde pullback", text: "Trend yönü yukarıdır; fiyat trend çizgisine geri gelir, destek bölgesinden yeniden güçlenir ve trend devam eder." },
          { term: "Düşüş trendinde pullback", text: "Trend yönü aşağıdır; fiyat trend çizgisine geri gelir, direnç bölgesinden yeniden zayıflar ve trend devam eder." },
        ],
      },
      { t: "note", tone: "info", text: "Pullback'te 5m/15m gibi küçük zaman dilimleri, trend yönü için üst zaman dilimiyle birlikte kullanılabilir. Girişte hacmin azalıp mum onayının gelmesini bekleyin." },
    ],
    video: { title: "Pullback Stratejisi (ABD Hisseleri)" },
  },
  {
    id: "senaryolar",
    title: "Senaryo Karşılaştırması: Hangi Durumda Ne Yapmalı?",
    level: "Orta",
    group: "Analiz",
    images: [
      { src: "/egitim/panel-10.webp", alt: "Breakout ve pullback adımları" },
      { src: "/egitim/panel-ozet.webp", alt: "Tüm senaryoların özeti: olay, sinyal, strateji" },
    ],
    blocks: [
      {
        t: "ul",
        title: "Breakout + pullback birlikte",
        items: ["Direnç seviyesi kırılır (hacim artar).", "Fiyat kısa süreli geri çekilir (pullback).", "Destek bölgesinden tekrar güçlenir.", "Trend yönünde işlem açılır."],
      },
      {
        t: "table",
        caption: "Tüm senaryoların özeti",
        head: ["Senaryo", "Ne olur?", "Sinyal", "Strateji"],
        rows: [
          ["Breakout (Yukarı)", "Direnç kırılır, yeni trend başlar", "Hacim artışı + kapanış", "Kırılım yönünde giriş, stop altında destek"],
          ["Breakout (Aşağı)", "Destek kırılır, yeni trend başlar", "Hacim artışı + kapanış", "Kırılım yönünde giriş, stop üstünde direnç"],
          ["Pullback (Yukarı)", "Trend içinde kısa geri çekilme", "Destek + mum onayı", "Trend yönünde giriş, stop altında destek"],
          ["Pullback (Aşağı)", "Trend içinde kısa tekrar yükseliş", "Direnç + mum onayı", "Trend yönünde giriş, stop üstünde direnç"],
        ],
      },
      { t: "note", tone: "info", text: "Tüm senaryolarda hacim, trend ve zaman dilimi uyumu önemlidir. Stop-loss ve kâr hedefi mutlaka belirlenmelidir. Disiplin, başarıyı getirir." },
    ],
    video: { title: "Breakout ve Pullback ile Giriş Stratejisi" },
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
    video: { title: "ABD Hisselerinde Temel Analiz" },
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
    ],
    video: { title: "Day Trading ve Swing Trading (ABD Borsası)" },
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
    video: { title: "ETF ve Portföy Çeşitlendirme (ABD)" },
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
    video: { title: "Stop Loss ve Risk Yönetimi (ABD Borsası)" },
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
    video: { title: "ABD Borsası Vergilendirme" },
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
    video: { title: "ABD Borsası İçin Broker Seçimi" },
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
    video: { title: "Boğa ve Ayı Piyasası (ABD)" },
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
    video: { title: "ABD Borsasında Yeni Başlayanların Hataları" },
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
    video: { title: "Backtest ve Paper Trading (ABD Hisseleri)" },
  },
  {
    id: "sss",
    title: "Sık Sorulan Sorular (SSS): Başlangıçtan İleriye",
    level: "Başlangıç",
    group: "Disiplin",
    images: [{ src: "/egitim/panel-sss.webp", alt: "Sık sorulan sorular infografiği" }],
    blocks: [
      {
        t: "terms",
        items: [
          { term: "Borsa için ne kadar para gerekir?", text: "Brokerlara göre değişir. Küçük miktarlarla (ör. 100-500 $) başlayabilirsiniz." },
          { term: "Hangi hisseyi almalıyım?", text: "Yatırım hedefinize ve risk toleransınıza göre (growth, value, dividend vb.) seçim yapın." },
          { term: "Kısa vadeli mi, uzun vadeli mi?", text: "Her ikisinin de avantajı var. Kısa vadeli daha fazla zaman ve dikkat ister." },
          { term: "Teknik analiz mi, temel analiz mi?", text: "En iyi sonuç için ikisini birlikte kullanın." },
          { term: "Hareketli ortalama nedir?", text: "Fiyat trendini gösteren bir indikatördür (EMA, SMA vb.)." },
          { term: "Piyasa neden düşer?", text: "Kâr realizasyonu, ekonomik veriler, jeopolitik riskler gibi birçok sebep olabilir." },
        ],
      },
      { t: "note", tone: "info", text: "Unutmayın: Borsa bir maraton, sprint değil." },
    ],
    video: { title: "ABD Borsası Sık Sorulan Sorular" },
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
    video: { title: "ABD Borsasında Başarı İçin Tavsiyeler" },
  },
];

export const EGITIM_GROUPS: EgitimSection["group"][] = ["Temeller", "Analiz", "Strateji ve Risk", "Pratik", "Disiplin"];

export function egitimStats() {
  const videos = EGITIM_SECTIONS.length;
  return { sections: EGITIM_SECTIONS.length, videos };
}
