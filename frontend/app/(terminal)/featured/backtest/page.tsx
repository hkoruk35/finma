'use client'

import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { History, Clock, TrendingUp, TrendingDown, DollarSign, BarChart2, Calendar } from 'lucide-react'

/* Mock Backtest Verileri */
const BACKTEST_DAYS = [
  {
    date: '14 Mart 2026',
    stocks: [
      { ticker: 'OUT', entry: 28.37, live: 26.71, pnl: -1.66, pnl_pct: -5.85 },
      { ticker: 'FANG', entry: 174.60, live: 182.43, pnl: 7.83, pnl_pct: 4.48 },
      { ticker: 'GFS', entry: 46.37, live: 41.88, pnl: -4.49, pnl_pct: -9.68 },
      { ticker: 'NOC', entry: 728.99, live: 733.41, pnl: 4.42, pnl_pct: 0.61 },
      { ticker: 'OKE', entry: 83.70, live: 85.36, pnl: 1.66, pnl_pct: 1.99 },
      { ticker: 'EQNR', entry: 31.29, live: 35.25, pnl: 3.96, pnl_pct: 12.66 },
      { ticker: 'TIGO', entry: 69.77, live: 72.16, pnl: 2.39, pnl_pct: 3.43 },
      { ticker: 'TGT', entry: 116.69, live: 117.37, pnl: 0.68, pnl_pct: 0.58 },
      { ticker: 'DELL', entry: 139.69, live: 151.70, pnl: 12.01, pnl_pct: 8.60 },
      { ticker: 'LMT', entry: 642.21, live: 646.10, pnl: 3.89, pnl_pct: 0.61 },
    ],
  },
  {
    date: '13 Mart 2026',
    stocks: [
      { ticker: 'NVDA', entry: 895.00, live: 912.45, pnl: 17.45, pnl_pct: 1.95 },
      { ticker: 'FANG', entry: 178.20, live: 182.43, pnl: 4.23, pnl_pct: 2.37 },
      { ticker: 'PLTR', entry: 72.80, live: 78.50, pnl: 5.70, pnl_pct: 7.83 },
      { ticker: 'AMD', entry: 162.40, live: 168.30, pnl: 5.90, pnl_pct: 3.63 },
      { ticker: 'NOC', entry: 722.50, live: 733.41, pnl: 10.91, pnl_pct: 1.51 },
      { ticker: 'OKE', entry: 82.90, live: 85.36, pnl: 2.46, pnl_pct: 2.97 },
      { ticker: 'SMCI', entry: 820.00, live: 892.40, pnl: 72.40, pnl_pct: 8.83 },
      { ticker: 'TGT', entry: 115.50, live: 117.37, pnl: 1.87, pnl_pct: 1.62 },
      { ticker: 'LMT', entry: 638.00, live: 646.10, pnl: 8.10, pnl_pct: 1.27 },
      { ticker: 'NTR', entry: 76.20, live: 82.86, pnl: 6.66, pnl_pct: 8.74 },
    ],
  },
]

export default function BacktestPage() {
  const [selectedDay, setSelectedDay] = useState(0)
  const day = BACKTEST_DAYS[selectedDay]

  const totalPnlPct = day.stocks.reduce((acc, s) => acc + s.pnl_pct, 0) / day.stocks.length
  const winners = day.stocks.filter(s => s.pnl >= 0).length
  const losers = day.stocks.filter(s => s.pnl < 0).length

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-finma-purple" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Backtest — Geçmiş Performans
          </span>
        </div>
      </div>

      {/* Tarih Seçimi */}
      <div className="flex gap-2">
        {BACKTEST_DAYS.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setSelectedDay(i)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-all',
              selectedDay === i
                ? 'bg-finma-primary/20 border-finma-primary/40 text-finma-primary'
                : 'bg-finma-card border-finma-border text-finma-text-dim hover:text-finma-text'
            )}
          >
            <Calendar className="w-3 h-3" />
            {d.date}
          </button>
        ))}
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Ort. Getiri</div>
            <div className={cn('text-lg font-bold finma-number', totalPnlPct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Kazanan / Kaybeden</div>
            <div className="text-lg font-bold">
              <span className="text-finma-green finma-number">{winners}</span>
              <span className="text-finma-text-dim mx-1">/</span>
              <span className="text-finma-red finma-number">{losers}</span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Başarı Oranı</div>
            <div className="text-lg font-bold text-finma-primary finma-number">
              {((winners / day.stocks.length) * 100).toFixed(0)}%
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">$1,000 Başına</div>
            <div className={cn('text-lg font-bold finma-number', totalPnlPct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
              {totalPnlPct >= 0 ? '+' : ''}${(totalPnlPct * 10).toFixed(2)}
            </div>
          </div>
        </Card>
      </div>

      {/* Tablo */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <BarChart2 className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-bold text-finma-text">Günlük Liste — {day.date}</span>
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-finma-text-dim border-b border-finma-border/30">
                <th className="text-left py-2 px-2 font-medium">#</th>
                <th className="text-left py-2 px-2 font-medium">Hisse</th>
                <th className="text-right py-2 px-2 font-medium">Tahmini Giriş</th>
                <th className="text-right py-2 px-2 font-medium">Canlı Fiyat</th>
                <th className="text-right py-2 px-2 font-medium">PnL</th>
                <th className="text-right py-2 px-2 font-medium">Değişim %</th>
                <th className="text-right py-2 px-2 font-medium">$1,000 İçin</th>
              </tr>
            </thead>
            <tbody>
              {day.stocks.map((stock, idx) => (
                <tr key={stock.ticker} className="border-b border-finma-border/10 hover:bg-finma-card-hover transition-colors">
                  <td className="py-2.5 px-2 finma-number text-finma-text-dim">{idx + 1}</td>
                  <td className="py-2.5 px-2 font-semibold text-finma-primary finma-number">{stock.ticker}</td>
                  <td className="py-2.5 px-2 text-right finma-number text-finma-text">${stock.entry.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right finma-number text-finma-text">${stock.live.toFixed(2)}</td>
                  <td className={cn('py-2.5 px-2 text-right finma-number font-medium', stock.pnl >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    {stock.pnl >= 0 ? '+' : ''}${stock.pnl.toFixed(2)}
                  </td>
                  <td className={cn('py-2.5 px-2 text-right finma-number font-medium', stock.pnl_pct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    {stock.pnl_pct >= 0 ? '+' : ''}{stock.pnl_pct.toFixed(2)}%
                  </td>
                  <td className={cn('py-2.5 px-2 text-right finma-number font-medium', stock.pnl_pct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    {stock.pnl_pct >= 0 ? '+' : ''}${(stock.pnl_pct * 10).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-finma-border font-bold">
                <td colSpan={4} className="py-2.5 px-2 text-finma-text text-xs">ORTALAMA</td>
                <td className={cn('py-2.5 px-2 text-right finma-number text-xs', totalPnlPct >= 0 ? 'text-finma-green' : 'text-finma-red')}>—</td>
                <td className={cn('py-2.5 px-2 text-right finma-number text-xs', totalPnlPct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                  {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                </td>
                <td className={cn('py-2.5 px-2 text-right finma-number text-xs', totalPnlPct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                  {totalPnlPct >= 0 ? '+' : ''}${(totalPnlPct * 10).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
