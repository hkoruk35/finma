'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Card } from '@/components/shared/Card'
import { cn, formatCurrency } from '@/lib/utils'
import { UserCheck, RefreshCw, ExternalLink, Filter } from 'lucide-react'

export default function InsiderPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { data: insiderData, isLoading, refetch } = useQuery({
    queryKey: ['insider-latest-v2'],
    queryFn: () => api.getLatestInsiderTransactions(),
    staleTime: 1000 * 60 * 30, // 30 dk
  })

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await api.refreshInsiderData()
      await refetch()
    } catch (err) {
      console.error("Manual refresh failed:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Format helper for large numbers
  const formatCompact = (val: number) => {
    if (val === 0) return '-'
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`
    return `$${val.toFixed(0)}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <RefreshCw className="w-6 h-6 text-finma-primary animate-spin" />
      </div>
    )
  }

  const trades = insiderData || []

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-finma-primary" />
            <h1 className="text-sm font-bold text-finma-text uppercase tracking-widest">
              Gelişmiş Insider Takibi
            </h1>
          </div>
          <p className="text-[10px] text-finma-text-dim mt-1">
            ABD Borsaları — En Son Bildirilen Form 4 İşlemleri
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-[9px] text-finma-text-dim hidden md:block">
            Son Güncelleme: {new Date().toLocaleTimeString('tr-TR')}
          </div>
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border shadow-lg active:scale-95",
              isRefreshing 
                ? "bg-finma-primary/20 border-finma-primary/40 text-finma-primary cursor-wait" 
                : "bg-finma-primary hover:bg-finma-primary-light border-finma-primary text-white"
            )}
            title="SEC EDGAR sisteminden canlı veri çek"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? 'SEC Verileri Çekiliyor...' : "SEC'den Güncelle"}
          </button>
        </div>
      </div>

      {/* Finviz Style Table */}
      <Card padding="none" className="overflow-hidden border-finma-border/40 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse leading-tight">
            <thead>
              <tr className="bg-[#1a1c22] text-[#8fa2b8] border-b border-finma-border/50 font-semibold">
                <th className="py-2.5 px-3 text-left border-r border-finma-border/20">Ticker</th>
                <th className="py-2.5 px-3 text-left border-r border-finma-border/20">Owner</th>
                <th className="py-2.5 px-3 text-left border-r border-finma-border/20">Relationship</th>
                <th className="py-2.5 px-3 text-center border-r border-finma-border/20">Date</th>
                <th className="py-2.5 px-3 text-left border-r border-finma-border/20">Transaction</th>
                <th className="py-2.5 px-3 text-right border-r border-finma-border/20">Cost</th>
                <th className="py-2.5 px-3 text-right border-r border-finma-border/20">#Shares</th>
                <th className="py-2.5 px-3 text-right border-r border-finma-border/20">Value ($)</th>
                <th className="py-2.5 px-3 text-right border-r border-finma-border/20">#Shares Total</th>
                <th className="py-2.5 px-3 text-center">SEC</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr className="bg-finma-card">
                  <td colSpan={10} className="py-20 text-center text-finma-text-dim text-sm italic">
                    Güncel veri bulunamadı.
                  </td>
                </tr>
              ) : (
                trades.map((item, idx) => {
                  const tx = item.transaction.toLowerCase()
                  const isBuy = tx.includes('buy') || tx.includes('alış')
                  const isSell = tx.includes('sell') || tx.includes('satış')
                  const isOption = tx.includes('option') || tx.includes('exercise')
                  
                  return (
                    <tr 
                      key={idx} 
                      className={cn(
                        "border-b border-finma-border/10 transition-colors uppercase font-medium",
                        isBuy ? "bg-[#003300]/30 hover:bg-[#003300]/50 text-[#00ff00]" : 
                        isSell ? "bg-[#330000]/30 hover:bg-[#330000]/50 text-[#ff4d4d]" : 
                        "bg-[#11141a] hover:bg-finma-card-hover text-[#8fa2b8]"
                      )}
                    >
                      <td className="py-2 px-3 font-bold text-finma-primary border-r border-finma-border/10">
                        {item.symbol}
                      </td>
                      <td className="py-2 px-3 border-r border-finma-border/10 truncate max-w-[140px]" title={item.owner}>
                        {item.owner}
                      </td>
                      <td className="py-2 px-3 border-r border-finma-border/10 text-[9px] truncate max-w-[120px]" title={item.relationship}>
                        {item.relationship}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-finma-border/10 whitespace-nowrap opacity-80">
                        {item.date}
                      </td>
                      <td className="py-2 px-3 border-r border-finma-border/10 text-[9px] font-bold">
                        {item.transaction}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-finma-border/10 finma-number">
                        {item.cost > 0 ? item.cost.toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-finma-border/10 finma-number">
                        {item.shares.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-finma-border/10 finma-number font-bold">
                        {formatCompact(item.value)}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-finma-border/10 finma-number opacity-80">
                        {item.shares_total > 0 ? item.shares_total.toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3 text-center opacity-40 hover:opacity-100 transition-opacity">
                        {item.sec_form_4_url ? (
                          <a href={item.sec_form_4_url} target="_blank" rel="noreferrer" className="text-finma-text hover:text-white">
                            <ExternalLink className="w-3 h-3 mx-auto" />
                          </a>
                        ) : (
                          <span className="text-[9px]">DOC</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-col md:flex-row justify-between items-center gap-2 px-1">
        <div className="flex gap-4 text-[9px] text-finma-text-dim lg:flex-row flex-col">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#00ff00]"></div>
            <span>İçeriden Alış (Bully)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#ff4d4d]"></div>
            <span>İçeriden Satış (Bearish)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#1a1c22] border border-finma-border"></div>
            <span>Opsiyon / Bonus / Diğer</span>
          </div>
        </div>
        
        <div className="text-[9px] text-finma-text-dim italic text-right">
          * Kaynak: SEC Form 4 (Alpha Vantage & FMP & yf) | Güncelleme: 10:00 NY
        </div>
      </div>
    </div>
  )
}
