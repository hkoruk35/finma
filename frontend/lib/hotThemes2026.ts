// 2026 güncel tematik liste — CES 2026 / Pentagon bütçesi / CHIPS Act gibi
// katalizörlerle öne çıkan 10 üst-düzey yatırım teması. Her temanın kendi
// takip sayfası /csp/[slug] altında yaşar (bkz. app/csp/[theme]/page.tsx).

export interface HotThemeStock {
  ticker: string;
  company: string;
  blurb: string;
}

export interface HotTheme {
  slug: string;
  number: number;
  title: string;
  accent: string;
  stocks: HotThemeStock[];
}

export const HOT_THEMES_2026: HotTheme[] = [
  {
    slug: "bellek-ureticiler-ai-depolama",
    number: 1,
    title: "Bellek Üreticiler & AI Depolama",
    accent: "#fde047",
    stocks: [
      { ticker: "MU", company: "Micron Technology", blurb: "HBM3E/HBM4 üretiminde NVDA'nın kilit tedarikçisi; DRAM ve NAND fiyat döngüsünün en büyük kazananı." },
      { ticker: "SNDK", company: "SanDisk", blurb: "Western Digital'den ayrılan NAND/flash depolama şirketi; kurumsal SSD talebinden doğrudan yararlanıyor." },
      { ticker: "WDC", company: "Western Digital", blurb: "HDD ve NAND üretiminde küresel lider; veri merkezi kapasite genişlemesinin ana tedarikçisi." },
      { ticker: "ALAB", company: "Astera Labs", blurb: "PCIe/CXL bağlantı çipleri; AI sunucularında bellek-işlemci arası veri akışını hızlandırıyor." },
      { ticker: "SIMO", company: "Silicon Motion", blurb: "NAND flash kontrolör çipleri lideri; SSD pazarındaki büyümeden pay alıyor." },
      { ticker: "MRVL", company: "Marvell", blurb: "Özel bellek ara bağlantı çipleri ve veri merkezi depolama silikon çözümleri." },
      { ticker: "RMBS", company: "Rambus", blurb: "DDR5/HBM bellek arabirim IP lisanslama lideri; bellek bant genişliği teknolojisinde kilit oyuncu." },
      { ticker: "AMAT", company: "Applied Materials", blurb: "Bellek çip üretim ekipmanları; DRAM/NAND fab kapasite yatırımlarının doğrudan yararlanıcısı." },
      { ticker: "LRCX", company: "Lam Research", blurb: "NAND/DRAM kazıma ve biriktirme ekipmanları; bellek üreticilerinin fab genişlemesine kritik tedarikçi." },
      { ticker: "ASML", company: "ASML Holding", blurb: "EUV litografi tekel sağlayıcısı; gelişmiş bellek ve lojik çip üretiminin vazgeçilmez ekipman ortağı." },
    ],
  },
  {
    slug: "uzay-temasi",
    number: 2,
    title: "Uzay Teması",
    accent: "#06b6d4",
    stocks: [
      { ticker: "SPCX", company: "Axiom Space", blurb: "Ticari uzay istasyonu modülü üreticisi; ISS halefi." },
      { ticker: "RKLB", company: "Rocket Lab", blurb: "Küçük uydu fırlatma roketleri; elektrikli Neutron roket geliştirme." },
      { ticker: "ASTS", company: "Ast SpaceMobile", blurb: "Orbital uzay haberleşme şirketi; doğrudan cep telefonlarına uydu bağlantısı." },
      { ticker: "LUNR", company: "Intuitive Machines", blurb: "Ay lander teknolojisi ve ay yüzeyinde ticari operasyonlar." },
      { ticker: "FJET", company: "FJET", blurb: "Uzay teknolojisi şirketi." },
      { ticker: "SATL", company: "Satellite Communications", blurb: "Uydu haberleşme altyapısı." },
      { ticker: "FLY", company: "FLY", blurb: "Havacılık ve uzay operasyonları." },
      { ticker: "RDW", company: "RDW", blurb: "Uzay araştırması ve geliştirme." },
      { ticker: "SIDU", company: "SIDU", blurb: "Uydu göz ağır lisanslama ve kuruluş." },
      { ticker: "UFO", company: "UFO", blurb: "Uzay yatırım portföyü." },
      { ticker: "YSS", company: "YSS", blurb: "Uydu ve uzay sistemleri." },
    ],
  },
  {
    slug: "fiziksel-ai-humanoid-robotik",
    number: 3,
    title: "Fiziksel AI & Hümanoid Robotik",
    accent: "#22d3ee",
    stocks: [
      { ticker: "TSLA", company: "Tesla", blurb: "Fremont fabrikası Optimus üretimine dönüştürüldü; Optimus Gen3 yaz 2026 lansmanı bekleniyor." },
      { ticker: "NVDA", company: "NVIDIA", blurb: "Isaac GR00T N1.6/N2 robotik AI modelleri; Jetson T4000; tüm robot ekosisteminin omurgası." },
      { ticker: "ISRG", company: "Intuitive Surgical", blurb: "da Vinci 5'e FDA kalp cerrahisi onayı; 2026'da prosedür büyümesi %13–15 hedefleniyor." },
      { ticker: "PATH", company: "UiPath", blurb: "Maestro agentic otomasyon platformu; WorkFusion satın aldı; finans sektörü AI ajan dönüşümü." },
      { ticker: "TER", company: "Teradyne", blurb: "Universal Robots ve MiR sahibi; kobot pazarı lideri." },
    ],
  },
  {
    slug: "ai-savunma-drone-otonom-sistemler",
    number: 4,
    title: "AI Savunma, Drone & Otonom Sistemler",
    accent: "#f87171",
    stocks: [
      { ticker: "ONDS", company: "Ondas Inc.", blurb: "Q1 2026 geliri yıllık bazda 10 kattan fazla artışla $50.1 milyona ulaştı; şirket 2026 gelir rehberini en az $390 milyona yükseltti. $457 milyon pro forma savunma sipariş defteri; Palantir ile birlikte SkyWeaver otonom savaş dronu geliştiriliyor; 2026 Dünya Kupası'nda çoklu sahaların counter-UAS güvenliğini üstlendi. Lockheed Martin ile Sentrycs counter-drone teknolojisi Sanctum savunma sistemine entegre edilecek; market cap $4.51 milyara ulaştı. Çok domainli sistem-sistem mimarisi ile hava, kara ve stratosfer platformları birleştiriliyor." },
      { ticker: "KTOS", company: "Kratos Defense", blurb: "Otonom insansız muharip uçaklar; Pentagon hızlı temin programlarının favori ismi." },
      { ticker: "AVAV", company: "AeroVironment", blurb: "Switchblade loitering mühimmatı; küçük taktik drone sistemleri lideri." },
      { ticker: "PLTR", company: "Palantir", blurb: "AIP platformu; hem savunma hem ticari AI veri analizi; ONDS ile ortak drone geliştirme." },
      { ticker: "BAH", company: "Booz Allen Hamilton", blurb: "2000+ AI mühendisi ile JADC2 ağının sistemleri entegrasyon şirketi." },
    ],
  },
  {
    slug: "kritik-maden-nadir-toprak",
    number: 5,
    title: "Kritik Maden, Nadir Toprak Elementleri & Yarıiletken Malzemeleri",
    accent: "#fbbf24",
    stocks: [
      { ticker: "MP", company: "MP Materials", blurb: "ABD'nin tek büyük ölçekli entegre nadir toprak operasyonu olan Mountain Pass maden sahasını işletiyor; DoD ile $500 milyon+ sermaye anlaşması imzaladı ve fiyat tabanı garantisi aldı; 2026 ortasında ağır nadir toprak ayrıştırma tesisini devreye alacak." },
      { ticker: "USAR", company: "USA Rare Earth", blurb: "Dikey entegre \"maden-dan-magnete\" stratejisi; ABD hükümeti %10 hisse edinimi; Round Top ağır nadir toprak projesi ve Oklahoma'daki mıknatıs üretim tesisi ile savunma ve EV sektörüne yönelik." },
      { ticker: "CRML", company: "Critical Metals Corp", blurb: "Grönland'ın Tanbreez nadir toprak yatağının kontrolüne sahip; ABD-Grönland görüşmelerinin yeniden başlamasıyla hissesi tek seansta %35 zıpladı." },
      { ticker: "REMX", company: "VanEck Rare Earth ETF", blurb: "Tek hisse riski istemeyenler için nadir toprak ve stratejik metal şirket sepeti." },
      { ticker: "ALB", company: "Albemarle", blurb: "Lityum üretiminin küresel lideri; EV batarya zincirine kritik hammadde sağlayıcısı." },
    ],
  },
  {
    slug: "nukleer-enerji-ai-guc",
    number: 6,
    title: "Nükleer Enerji & AI Güç Altyapısı",
    accent: "#34d399",
    stocks: [
      { ticker: "CEG", company: "Constellation Energy", blurb: "Meta ile 20 yıl/1.1 GW nükleer anlaşma; GSA federal $1 milyar tedarik sözleşmesi." },
      { ticker: "VST", company: "Vistra", blurb: "Amazon ve Meta uzun vadeli nükleer güç anlaşmaları; ABD'nin en büyük serbest güç üreticisi." },
      { ticker: "SMR", company: "NuScale Power", blurb: "NRC onaylı tek Küçük Modüler Reaktör tasarımcısı; hyperscale AI veri merkezleri odaklı." },
      { ticker: "CCJ", company: "Cameco", blurb: "230 milyon pound uranyum uzun vadeli kontrat portföyü; Westinghouse (%49) SMR geliştiriyor." },
      { ticker: "GEV", company: "GE Vernova", blurb: "Elektrik şebekesi türbin ve altyapı lideri; AI güç talebinin doğrudan yararlanıcısı." },
    ],
  },
  {
    slug: "kuantum-bilisim",
    number: 7,
    title: "Kuantum Bilişim",
    accent: "#a78bfa",
    stocks: [
      { ticker: "IONQ", company: "IonQ", blurb: "$26.9 milyar piyasa değeri; SkyWater teknoloji ortaklığı ile çip üretimi." },
      { ticker: "RGTI", company: "Rigetti", blurb: "108-kübit Cepheus sistemi; Q1 2026 geliri 3 katına çıktı; $8.5 milyar piyasa değeri." },
      { ticker: "QBTS", company: "D-Wave", blurb: "Kuantum tavlama; kurumsal optimizasyon müşterileri aktif kullanımda." },
      { ticker: "IBM", company: "IBM", blurb: "$1 milyar CHIPS Act federal yatırım; ABD'nin ilk kuantum çip fabrikası kurulumu." },
      { ticker: "QUBT", company: "Quantum Computing Inc", blurb: "Kriyojenik soğutmasız nanofotonik sistemler; NeuraWave AI uygulamaları." },
    ],
  },
  {
    slug: "ai-ajanlar-kurumsal-yazilim",
    number: 8,
    title: "AI Ajanlar & Kurumsal Yazılım Dönüşümü",
    accent: "#60a5fa",
    stocks: [
      { ticker: "CRWV", company: "CoreWeave", blurb: "AI-native bulut; OpenAI altyapısının birincil taşıyıcısı; 2026 IPO yılı." },
      { ticker: "PLTR", company: "Palantir", blurb: "AIP agentic platformu; savunma + ticari AI veri analizi." },
      { ticker: "MSFT", company: "Microsoft", blurb: "Azure AI Foundry; Copilot ajan katmanı; OpenAI hissedarlığı." },
      { ticker: "ORCL", company: "Oracle", blurb: "$300 milyar OpenAI güç tedarik anlaşması; bulut altyapısı üçlü haneli büyüme." },
    ],
  },
  {
    slug: "ai-veri-merkezi-sogutma",
    number: 9,
    title: "AI Veri Merkezi & Soğutma Altyapısı",
    accent: "#2dd4bf",
    stocks: [
      { ticker: "VRT", company: "Vertiv", blurb: "NVIDIA Rubin Ultra 800V DC mimari ortağı; 2026'da %34 gelir / %47 kazanç artışı beklentisi." },
      { ticker: "ANET", company: "Arista Networks", blurb: "AI veri merkezi ağ omurgası; hyperscale switch mimarisi lideri." },
      { ticker: "AVGO", company: "Broadcom", blurb: "Özel AI ASIC çipleri ve ağ silikon; hyperscaler müşteri tabanı." },
      { ticker: "EQIX", company: "Equinix", blurb: "Global veri merkezi colocation REIT; AI yük talebinden doğrudan yararlanan." },
      { ticker: "SMCI", company: "Super Micro Computer", blurb: "Yüksek yoğunluklu AI sunucu kümeleme mimarisi." },
    ],
  },
  {
    slug: "post-kuantum-siber-guvenlik",
    number: 10,
    title: "Post-Kuantum Siber Güvenlik & Egemenlik Güvenliği",
    accent: "#fb7185",
    stocks: [
      { ticker: "CRWD", company: "CrowdStrike", blurb: "AI destekli uç nokta güvenliği; bulut-native XDR platform lideri." },
      { ticker: "PANW", company: "Palo Alto Networks", blurb: "Platformlaşma stratejisi; Prisma Cloud ve Cortex AI entegrasyonu." },
      { ticker: "ARQQ", company: "Arqit Quantum", blurb: "Kuantum güvenli bulut şifreleme; hükümet ve telekom odaklı saf kuantum siber oyunu." },
      { ticker: "S", company: "SentinelOne", blurb: "Otonom AI tehdit tespit motoru; kurumsal EDR/XDR pazar payı büyüyor." },
    ],
  },
  {
    slug: "fiziksel-ai-yariiletken-cip-ekosistemi",
    number: 11,
    title: "Fiziksel AI İçin Yarı İletken Çip Ekosistemi",
    accent: "#38bdf8",
    stocks: [
      { ticker: "NVDA", company: "NVIDIA", blurb: "Rubin platform H2 2026; CUDA-Q kuantum-klasik köprüsü; Isaac robotik ekosistemi." },
      { ticker: "AMD", company: "AMD", blurb: "AI inferans çip pazarında NVDA'ya alternatif; MI300 serisi veri merkezi kazanımları." },
      { ticker: "AVGO", company: "Broadcom", blurb: "Özel AI ASIC; Google TPU ve hyperscaler özel çip tasarımlarının üreticisi." },
      { ticker: "MRVL", company: "Marvell", blurb: "Yüksek hızlı veri merkezi bağlantı ve fotonik çipler; AI-kuantum entegrasyon katmanı." },
      { ticker: "AEHR", company: "Aehr Test Systems", blurb: "Silikon fotonik müşterilerden yeni hiper ölçekli veri merkezi optik ara bağlantı sistemi siparişleri aldı; kuantum ve AI çip test altyapısı sağlayıcısı." },
    ],
  },
];

export function getHotTheme(slug: string): HotTheme | undefined {
  return HOT_THEMES_2026.find((t) => t.slug === slug);
}
