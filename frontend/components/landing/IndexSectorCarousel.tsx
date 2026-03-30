'use client'

import { useState, useEffect } from 'react'

interface IndexSectorItem {
  id: string
  label: string
  type: 'index' | 'sector'
  price: number
  change_pct: number
  analysis: string // 3 sentences AI analysis
}

const MOCK_DATA: IndexSectorItem[] = [
  // 5 Indices
  {
    id: 'SPX',
    label: 'S&P 500',
    type: 'index',
    price: 5892.45,
    change_pct: 1.24,
    analysis: 'S&P 500 teknoloji sektörüne odaklanmış güçlü bir yükseliş gösteriyor. Yapay zeka hisse senetleri portföy ağırlıklarını artırıyor. Makroekonomik veriler yumuşak iniş senaryosunu destekliyor.',
  },
  {
    id: 'DJI',
    label: 'Dow Jones',
    type: 'index',
    price: 43156.78,
    change_pct: 0.87,
    analysis: 'Dow Jones finansal sektör gücü ile düşük volatilitede ilerliyor. Büyük cap şirketlerin kazanç beklentileri kuvvetli. Endüstriyel hisse senetleri ekonomik dayanıklılığı gösteriyor.',
  },
  {
    id: 'IXIC',
    label: 'NASDAQ',
    type: 'index',
    price: 18234.56,
    change_pct: 2.18,
    analysis: 'NASDAQ yapay zeka ve bulut teknolojileri tarafından yönlendiriliyor. Yüksek büyüme hisse senetleri güçlü momentum gösteriyor. Teknoloji sektörü M&A faaliyetlerinde artış görüyor.',
  },
  {
    id: 'VIX',
    label: 'VIX (Korku)',
    type: 'index',
    price: 16.45,
    change_pct: -5.32,
    analysis: 'VIX volatilite endeksi yüksek seviyelerde kalsa da düşüş trendinde. Piyasa katılımcıları riske karşı iyimser bir tutum sergiliyor. Opsiyon primiyumları indirim avı için fırsatlar sunuyor.',
  },
  {
    id: 'RUT',
    label: 'Russell 2K',
    type: 'index',
    price: 2087.34,
    change_pct: 1.45,
    analysis: 'Russell 2000 küçük cap hisse senetleri yükseliş momentumu gösteriyor. Bölgesel bankalar faiz oranı beklentilerine uyum sağlıyor. Ekonomik büyüme sinyalleri gelecek çeyrek için olumlu işaretler veriyor.',
  },
  // 11 Sectors
  {
    id: 'tech',
    label: 'Teknoloji',
    type: 'sector',
    price: 3456.78,
    change_pct: 3.45,
    analysis: 'Teknoloji sektörü yapay zeka yatırımları ile ana güçlendirici. Büyük bulut sağlayıcılar kurumsal harcama artışından yarar sağlıyor. Yarıiletken talebi güçlü ve marjlar iyileşiyor.',
  },
  {
    id: 'healthcare',
    label: 'Sağlık',
    type: 'sector',
    price: 2134.56,
    change_pct: 1.23,
    analysis: 'Sağlık sektörü reçeteli ilaç devam ettiren ürünlerin faydasından yararlanıyor. Biyoteknoloji inovasyonu klinik başarılarla momentum kazanıyor. Tıbbi cihazlar yaşlanan nüfus tarafından destekleniyor.',
  },
  {
    id: 'finance',
    label: 'Finans',
    type: 'sector',
    price: 4567.89,
    change_pct: 0.98,
    analysis: 'Finans sektörü faiz oranı ortamında ayak uydurma hedefini koruyor. Yatırım bankacılığı M&A ve IPO faaliyetlerinde canlanma görüyor. Varlık yönetimi bölümü kayıt kıran veri inflows alıyor.',
  },
  {
    id: 'energy',
    label: 'Enerji',
    type: 'sector',
    price: 2345.67,
    change_pct: -0.67,
    analysis: 'Enerji sektörü petrol fiyatlarının dengesine duyarlı kalıyor. Yenilenebilir enerji yatırımları uzun vadeli büyüme sürüyor. Elektrik hisse senetleri düşük volatilitesi ile tercih ediliyor.',
  },
  {
    id: 'consumer',
    label: 'Tüketici',
    type: 'sector',
    price: 3234.45,
    change_pct: 0.45,
    analysis: 'Tüketici sektörü duraylılığı gösteriyor ancak ertelenen alım beklentileri var. Premium markaları güçlü kalırken bütçe seçenekleri tepki gösteriyor. E-ticaret penetrasyonu geleneksel perakende için baskı oluşturuyor.',
  },
  {
    id: 'industrial',
    label: 'Endüstriyel',
    type: 'sector',
    price: 3678.90,
    change_pct: 1.56,
    analysis: 'Endüstriyel sektörü altyapı harcamaları tarafından destekleniyor. Otomotiv OEM\'leri elektrikli araç geçişinde kapasite genişletiyor. Makine üreticileri sağlam siparişler ve geri bildirim rapor ediyor.',
  },
  {
    id: 'materials',
    label: 'Malzemeler',
    type: 'sector',
    price: 2567.34,
    change_pct: -1.34,
    analysis: 'Malzemeler sektörü küresel büyüme yavaşlaması endişelerine duyarlı. Değerli metal fiyatları jeopolitik belirsizlikten fayda görüyor. Kimya üretimi sınai talepte zayıflık gösteriyor.',
  },
  {
    id: 'realestate',
    label: 'Gayrimenkul',
    type: 'sector',
    price: 1234.56,
    change_pct: -2.45,
    analysis: 'Gayrimenkul sektörü yüksek faiz oranlarından maruz kalıyor. Lüks emlak piyasası dayanıklı ancak orta segment zayıf. Veri merkezi REIT\'leri yapay zeka talep tarafından yararlanıyor.',
  },
  {
    id: 'utilities',
    label: 'Kamu Hizmetleri',
    type: 'sector',
    price: 1456.78,
    change_pct: 0.67,
    analysis: 'Kamu hizmetleri sektörü güvenli port olarak tercih ediliyor. Temettü verimi faiz oranlarına kıyasla cazip kalıyor. Elektrik talebi veri merkezi yüklemelerinden artış görüyor.',
  },
  {
    id: 'communication',
    label: 'İletişim',
    type: 'sector',
    price: 2890.12,
    change_pct: 2.34,
    analysis: 'İletişim hisse senetleri yapay zeka entegrasyonuna odaklanıyor. 5G dağıtımı tamamlanırken 6G araştırması başlıyor. Uydu iletişim yeni gelir akışları açılıyor.',
  },
  {
    id: 'discretionary',
    label: 'Tüketici Ürünleri',
    type: 'sector',
    price: 3123.45,
    change_pct: 0.89,
    analysis: 'Tüketici ürünleri hisse senetleri tüketici güveninin iyileşmesine yanıt veriyor. Lüks markalar yüksek net değeri olan bireylere karşı dayanıklı. Perakende zincirler envanteri optimize etmeyi başarıyor.',
  },
]

interface IndexSectorCarouselProps {
  className?: string
}

export function IndexSectorCarousel({ className = '' }: IndexSectorCarouselProps) {
  const [hoveredId, setHoveredId] = useState<string>('SPX')
  const [selectedItem, setSelectedItem] = useState<IndexSectorItem | null>(null)
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const item = MOCK_DATA.find(i => i.id === hoveredId)
    if (item) setSelectedItem(item)
  }, [hoveredId])

  useEffect(() => {
    setSelectedItem(MOCK_DATA.find(i => i.id === 'SPX') || null)
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainer) return
    const scrollAmount = 300
    scrollContainer.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Main Analysis Box */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {selectedItem?.label}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedItem?.type === 'index' ? 'Endeks' : 'Sektör'} Analizi
            </p>
          </div>
          {selectedItem && (
            <div className="text-right">
              <div className="text-2xl font-bold">
                {selectedItem.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div
                className={`text-lg font-semibold ${
                  selectedItem.change_pct >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {selectedItem.change_pct >= 0 ? '+' : ''}{selectedItem.change_pct.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {/* Analysis Text */}
        {selectedItem && (
          <p className="text-sm text-gray-300 leading-relaxed">
            {selectedItem.analysis}
          </p>
        )}

        {/* Timestamp */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-600">
            Güncellendi: {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} EST • NY Piyasa Saatleri: 09:30 - 17:00
          </p>
        </div>
      </div>

      {/* Scrolling Carousel */}
      <div className="relative group w-full overflow-hidden">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-all group-hover:opacity-100 opacity-50"
          aria-label="Scroll left"
        >
          ←
        </button>

        <div
          ref={setScrollContainer}
          className="overflow-x-auto scrollbar-hide w-full"
        >
          <div className="flex gap-3 pb-2 pl-16 pr-16" style={{ minWidth: 'min-content' }}>
            {MOCK_DATA.map((item) => {
              const isSelected = hoveredId === item.id
              const isPositive = item.change_pct >= 0

              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onClick={() => setHoveredId(item.id)}
                  className={`flex-shrink-0 rounded-lg border px-4 py-3 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900/70'
                  }`}
                  style={{ minWidth: 140 }}
                >
                  <div className="text-left">
                    <div className="font-semibold text-white text-sm">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.type === 'index' ? 'Endeks' : 'Sektör'}
                    </div>
                    <div
                      className={`text-sm font-bold mt-2 ${
                        isPositive ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {isPositive ? '+' : ''}{item.change_pct.toFixed(2)}%
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-all group-hover:opacity-100 opacity-50"
          aria-label="Scroll right"
        >
          →
        </button>
      </div>
    </div>
  )
}
