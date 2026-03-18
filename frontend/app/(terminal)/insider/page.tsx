'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Card } from '@/components/shared/Card'
import { cn, formatCurrency } from '@/lib/utils'
import { UserCheck, TrendingUp, TrendingDown, DollarSign, Clock, Building2, RefreshCw } from 'lucide-react'

export default function InsiderPage() {
  const { data: insiderData, isLoading, refetch } = useQuery({
    queryKey: ['insider-latest'],
    queryFn: () => api.getLatestInsiderTransactions(),
    staleTime: 1000 * 60 * 60, // 1 saat
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <RefreshCw className="w-6 h-6 text-finma-primary animate-spin" />
      </div>
    )
  }

  const trades = insiderData || []
  const buys = trades.filter(d => d.transaction.toLowerCase().includes('buy') || d.transaction.toLowerCase().includes('alış'))
  const sells = trades.filter(d => d.transaction.toLowerCase().includes('sell') || d.transaction.toLowerCase().includes('satış'))

  const topBuy = buys.length > 0 ? buys.reduce((prev, current) => (prev.value > current.value) ? prev : current) : null
  const topSell = sells.length > 0 ? sells.reduce((prev, current) => (prev.value > current.value) ? prev : current) : null

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Insider İşlemleri (Piyasa Geneli)
          </span>
          <span className="text-[10px] text-finma-text-dim ml-2 uppercase">ABD Borsaları — Günlük</span>
        </div>
        <button 
          onClick={() => refetch()}
          className="text-finma-text-dim hover:text-finma-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Tespit Edilen İşlem</div>
            <div className="text-lg font-bold text-finma-text finma-number">{trades.length}</div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Alış / Satış Dağılımı</div>
            <div className="text-lg font-bold">
              <span className="text-finma-green finma-number">{buys.length}</span>
              <span className="text-finma-text-dim mx-1">/</span>
              <span className="text-finma-red finma-number">{sells.length}</span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">En Büyük Alış</div>
            <div className="text-sm font-bold text-finma-green finma-number">
              {topBuy ? `${topBuy.symbol} — ${formatCurrency(topBuy.value)}` : '-'}
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">En Büyük Satış</div>
            <div className="text-sm font-bold text-finma-red finma-number">
              {topSell ? `${topSell.symbol} — ${formatCurrency(topSell.value)}` : '-'}
            </div>
          </div>
        </Card>
      </div>

      {/* Tablo */}
      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-finma-text-dim border-b border-finma-border/30">
                <th className="text-left py-2 px-2 font-medium">Sembol</th>
                <th className="text-left py-2 px-2 font-medium">İsim</th>
                <th className="text-left py-2 px-2 font-medium">Unvan</th>
                <th className="text-center py-2 px-2 font-medium">İşlem</th>
                <th className="text-right py-2 px-2 font-medium">Adet</th>
                <th className="text-right py-2 px-2 font-medium">Değer</th>
                <th className="text-right py-2 px-2 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-finma-text-dim">
                    Henüz güncel insider verisi bulunamadı.
                  </td>
                </tr>
              ) : (
                trades.map((item, idx) => {
                  const isBuy = item.transaction.toLowerCase().includes('buy') || item.transaction.toLowerCase().includes('alış')
                  return (
                    <tr key={idx} className="border-b border-finma-border/10 hover:bg-finma-card-hover transition-colors">
                      <td className="py-2.5 px-2 font-bold text-finma-primary finma-number">{item.symbol}</td>
                      <td className="py-2.5 px-2 text-finma-text font-medium truncate max-w-[120px]">{item.insider}</td>
                      <td className="py-2.5 px-2 text-finma-text-dim truncate max-w-[150px]">{item.relation}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-bold',
                          isBuy ? 'bg-finma-green/20 text-finma-green' : 'bg-finma-red/20 text-finma-red'
                        )}>
                          {isBuy ? 'Alış' : 'Satış'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right finma-number text-finma-text">
                        {item.shares.toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2.5 px-2 text-right finma-number font-medium text-finma-text">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-2.5 px-2 text-right finma-number text-finma-text-dim">
                        {item.date}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="text-[10px] text-finma-text-dim text-right italic">
        * Veriler her gün NY saati ile 10:00'da güncellenmektedir.
      </div>
    </div>
  )
}
