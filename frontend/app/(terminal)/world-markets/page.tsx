'use client'

import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { Globe2, Clock, TrendingUp, TrendingDown } from 'lucide-react'

const WORLD_MARKETS = [
  {
    region: 'Amerika',
    markets: [
      { name: 'S&P 500', symbol: 'SPX', price: 5580, change: -0.80, status: 'Açık' },
      { name: 'Dow Jones', symbol: 'DJI', price: 41800, change: -0.76, status: 'Açık' },
      { name: 'Nasdaq', symbol: 'NDX', price: 19400, change: -0.92, status: 'Açık' },
      { name: 'Russell 2000', symbol: 'RUT', price: 2080, change: -0.88, status: 'Açık' },
      { name: 'Bovespa', symbol: 'BVSP', price: 128500, change: 0.45, status: 'Açık' },
      { name: 'S&P/TSX', symbol: 'TSX', price: 22400, change: -0.32, status: 'Açık' },
    ],
  },
  {
    region: 'Avrupa',
    markets: [
      { name: 'FTSE 100', symbol: 'UKX', price: 8420, change: 0.35, status: 'Kapalı' },
      { name: 'DAX', symbol: 'DAX', price: 18950, change: 0.62, status: 'Kapalı' },
      { name: 'CAC 40', symbol: 'CAC', price: 8150, change: 0.28, status: 'Kapalı' },
      { name: 'BIST 100', symbol: 'XU100', price: 9850, change: 1.24, status: 'Kapalı' },
      { name: 'STOXX 600', symbol: 'SXXP', price: 520, change: 0.41, status: 'Kapalı' },
      { name: 'IBEX 35', symbol: 'IBEX', price: 11250, change: 0.18, status: 'Kapalı' },
    ],
  },
  {
    region: 'Asya-Pasifik',
    markets: [
      { name: 'Nikkei 225', symbol: 'NI225', price: 38900, change: -1.20, status: 'Kapalı' },
      { name: 'Hang Seng', symbol: 'HSI', price: 22800, change: 0.85, status: 'Kapalı' },
      { name: 'Shanghai', symbol: 'SSEC', price: 3280, change: 0.32, status: 'Kapalı' },
      { name: 'ASX 200', symbol: 'AXJO', price: 7950, change: -0.45, status: 'Kapalı' },
      { name: 'KOSPI', symbol: 'KS11', price: 2680, change: -0.68, status: 'Kapalı' },
      { name: 'Sensex', symbol: 'BSESN', price: 74500, change: 0.52, status: 'Kapalı' },
    ],
  },
  {
    region: 'Emtia & Döviz',
    markets: [
      { name: 'Altın', symbol: 'GC', price: 2950, change: 0.63, status: '24 Saat' },
      { name: 'Gümüş', symbol: 'SI', price: 33.20, change: 0.76, status: '24 Saat' },
      { name: 'Petrol (WTI)', symbol: 'CL', price: 78.50, change: 1.85, status: '24 Saat' },
      { name: 'EUR/USD', symbol: 'EURUSD', price: 1.0892, change: 0.12, status: '24 Saat' },
      { name: 'USD/TRY', symbol: 'USDTRY', price: 38.45, change: 0.08, status: '24 Saat' },
      { name: 'Bitcoin', symbol: 'BTC', price: 83000, change: -1.42, status: '24 Saat' },
    ],
  },
]

export default function WorldMarketsPage() {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-finma-cyan" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Dünya Borsaları
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
          <Clock className="w-3 h-3" />
          <span className="finma-number">Son güncelleme: {timeStr}</span>
        </div>
      </div>

      {WORLD_MARKETS.map((region) => (
        <Card key={region.region} padding="sm">
          <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
            <Globe2 className="w-4 h-4 text-finma-primary" />
            <span className="text-sm font-bold text-finma-text">{region.region}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
            {region.markets.map((market) => (
              <div
                key={market.symbol}
                className="flex items-center justify-between bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 hover:border-finma-primary/30 transition-colors cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-finma-text">{market.name}</div>
                  <div className="text-[9px] text-finma-text-dim finma-number">{market.symbol}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold finma-number text-finma-text">
                    {market.price >= 1000 ? market.price.toLocaleString() : market.price.toFixed(2)}
                  </div>
                  <div className={cn(
                    'text-[10px] finma-number font-medium flex items-center justify-end gap-0.5',
                    market.change >= 0 ? 'text-finma-green' : 'text-finma-red'
                  )}>
                    {market.change >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {market.change >= 0 ? '+' : ''}{market.change.toFixed(2)}%
                  </div>
                </div>
                <span className={cn(
                  'text-[8px] px-1.5 py-0.5 rounded font-medium ml-2',
                  market.status === 'Açık' ? 'bg-finma-green/20 text-finma-green' :
                  market.status === '24 Saat' ? 'bg-finma-cyan/20 text-finma-cyan' :
                  'bg-finma-text-dim/20 text-finma-text-dim'
                )}>
                  {market.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
