'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal'
import type { MarketIndex } from '@/types'
import { Globe, ChevronLeft, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom'

/* ── Symbol yönetimi güncellenmiştir
 * Bu sayede tüm sayfalardan gelen semboller doğru exchange-prefixed formata çözümlenir.
 */

/* ── Türkçe sektör/açıklama haritası ── */
const sectorMapTR: Record<string, string> = {
  DJI: 'Dow Jones Sanayi Endeksi – ABD\'nin en büyük 30 şirketi',
  SPX: 'S&P 500 Endeksi – ABD\'nin en büyük 500 şirketi',
  NDX: 'Nasdaq 100 Endeksi – Teknoloji ağırlıklı büyük şirketler',
  RUT: 'Russell 2000 – Küçük ölçekli ABD şirketleri',
  VIX: 'Volatilite Endeksi – Piyasa korku/belirsizlik göstergesi',
  BTC: 'Bitcoin – En büyük kripto para birimi',
  ETH: 'Ethereum – Akıllı sözleşme platformu',
  GC: 'Altın Vadeli – Güvenli liman yatırım aracı',
  SI: 'Gümüş Vadeli – Değerli metal / endüstriyel kullanım',
  CL: 'Ham Petrol (WTI) – Enerji emtiası',
  BLK: 'BlackRock – Dünyanın en büyük varlık yöneticisi',
  BLC: 'Bausch + Lomb – Sağlık / Göz bakımı',
  XLF: 'Finans Sektörü ETF – Bankalar, sigorta, yatırım şirketleri',
  XLV: 'Sağlık Sektörü ETF – İlaç, biyoteknoloji, hastane grupları',
  XLY: 'Tüketici İhtiyari ETF – Perakende, otomotiv, eğlence',
  XLI: 'Sanayi Sektörü ETF – Havacılık, savunma, makine',
  XLE: 'Enerji Sektörü ETF – Petrol, doğalgaz, enerji şirketleri',
  XLK: 'Teknoloji Sektörü ETF – Yazılım, donanım, yarı iletken',
  XLB: 'Hammadde Sektörü ETF – Kimya, madencilik, orman ürünleri',
  XLC: 'İletişim Sektörü ETF – Medya, telekomünikasyon, sosyal ağlar',
  XLRE: 'Gayrimenkul Sektörü ETF – GYO\'lar, ticari gayrimenkul',
  XLU: 'Kamu Hizmetleri ETF – Elektrik, su, gaz dağıtım şirketleri',
}

interface MarketContextProps {
  indices: MarketIndex[]
  onSelectChart?: (symbol: string) => void
}

/* ── Fixed-position Tooltip (portal ile body'ye render edilir) ── */
function Tooltip({ symbol, text, hint, anchorRect }: {
  symbol: string
  text: string
  hint: string
  anchorRect: DOMRect
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const tooltipWidth = 260
  let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2
  // Ekran dışına taşmasın
  if (left < 8) left = 8
  if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8

  const top = anchorRect.top - 8 // kartın üstünde

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top, width: tooltipWidth, transform: 'translateY(-100%)' }}
    >
      <div className="bg-finma-sidebar border border-finma-border rounded-lg shadow-2xl px-3 py-2.5">
        <div className="text-[10px] font-semibold text-finma-primary mb-1">{symbol}</div>
        <div className="text-[11px] text-finma-text leading-relaxed">{text}</div>
        <div className="text-[9px] text-finma-text-dim mt-1.5 border-t border-finma-border pt-1.5">
          {hint}
        </div>
      </div>
      {/* Ok işareti */}
      <div
        className="absolute w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-finma-border"
        style={{ left: anchorRect.left + anchorRect.width / 2 - left - 6, bottom: -6 }}
      />
    </div>,
    document.body
  )
}

export function MarketContext({ indices, onSelectChart }: MarketContextProps) {
  const { setChartSymbol } = useTerminalStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [tappedSymbol, setTappedSymbol] = useState<string | null>(null)
  const [tappedRect, setTappedRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const updateScrollButtons = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollButtons()
    el.addEventListener('scroll', updateScrollButtons, { passive: true })
    return () => el.removeEventListener('scroll', updateScrollButtons)
  }, [updateScrollButtons])

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = dir === 'left' ? -300 : 300
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const handleMouseEnter = (symbol: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return
    setHoveredSymbol(symbol)
    setHoveredRect(e.currentTarget.getBoundingClientRect())
  }

  const handleMouseLeave = () => {
    if (isMobile) return
    setHoveredSymbol(null)
    setHoveredRect(null)
  }

  const handleClick = (symbol: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (isMobile) {
      if (tappedSymbol === symbol) {
        // setChartSymbol otomatik olarak toTvSymbol() uygular (store seviyesinde)
        setChartSymbol(symbol)
        onSelectChart?.(symbol)
        setSelectedSymbol(symbol)
        setTappedSymbol(null)
        setTappedRect(null)
      } else {
        setTappedSymbol(symbol)
        setTappedRect(rect)
      }
    } else {
      setChartSymbol(symbol)
      onSelectChart?.(symbol)
      setSelectedSymbol(symbol)
    }
  }

  // Aktif tooltip bilgisi
  const activeSymbol = hoveredSymbol || tappedSymbol
  const activeRect = hoveredRect || tappedRect
  const activeInfo = activeSymbol ? (sectorMapTR[activeSymbol] || '') : ''
  const activeHint = isMobile ? 'Grafiği açmak için tekrar dokunun' : 'Grafiği açmak için tıklayın'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Globe className="w-3.5 h-3.5 text-finma-cyan" />
        <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">
          Piyasa Özeti
        </span>
        <span className="text-[10px] text-finma-text-dim ml-1">
          ({indices.length} endeks/kripto/emtia)
        </span>
      </div>

      {/* Yatay kaydırma konteyneri */}
      <div className="relative group">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-finma-bg via-finma-bg/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-finma-text" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-finma-bg via-finma-bg/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4 text-finma-text" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {indices.map((index) => {
            const isSelected = selectedSymbol === index.symbol

            return (
              <div
                key={index.symbol}
                className="relative shrink-0"
                onMouseEnter={(e) => handleMouseEnter(index.symbol, e)}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  onClick={(e) => handleClick(index.symbol, e)}
                  className={cn(
                    'bg-finma-card border rounded-md px-3 py-1.5 min-w-[100px] transition-all duration-200 cursor-pointer select-none',
                    isSelected
                      ? 'border-finma-primary/50 bg-finma-primary/5'
                      : 'border-finma-border hover:border-finma-border-light hover:bg-finma-card-hover'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-finma-primary">{index.symbol}</span>
                    <span
                      className={cn(
                        'text-[9px] finma-number font-medium',
                        index.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red'
                      )}
                    >
                      {index.change_pct >= 0 ? '+' : ''}{index.change_pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="finma-number text-xs font-bold text-white mt-0.5">
                    ${index.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className={cn(
                      'finma-number text-[9px]',
                      index.change >= 0 ? 'text-finma-green' : 'text-finma-red'
                    )}
                  >
                    {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip - Portal ile body'ye render, overflow sorununu aşar */}
      {activeSymbol && activeRect && (
        <Tooltip
          symbol={activeSymbol}
          text={activeInfo}
          hint={activeHint}
          anchorRect={activeRect}
        />
      )}
    </div>
  )
}
