'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { api } from '@/lib/api-client'
import { Bot, RefreshCw, Clock, Activity } from 'lucide-react'

export default function AdminBotsPage() {
  const [botStatus, setBotStatus] = useState<any>(null)
  const [signals, setSignals] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const [statusRes, signalsRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/signals/bot-status`).then(r => r.json()),
        fetch(`${baseUrl}/api/signals/latest`).then(r => r.json()),
      ])

      if (statusRes.status === 'fulfilled') setBotStatus(statusRes.value)
      if (signalsRes.status === 'fulfilled') setSignals(signalsRes.value)
    } catch (err) {
      console.error('Bot data load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-finma-text-dim text-sm">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">Bot Yönetimi</h1>
        </div>
        <button onClick={loadData} className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5">
          <RefreshCw className="w-3 h-3" />
          Yenile
        </button>
      </div>

      {/* Bot Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="sm">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-finma-green" />
            Bot Durumu
          </h2>
          {botStatus ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">Durum</span>
                <span className={botStatus.status === 'active' ? 'text-finma-green font-semibold' : 'text-finma-red'}>
                  {botStatus.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">Son Çalışma</span>
                <span className="text-finma-text finma-number">
                  {botStatus.last_run ? new Date(botStatus.last_run).toLocaleString('tr-TR') : 'Bilinmiyor'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">Bot Adı</span>
                <span className="text-finma-text">{botStatus.bot_name || 'inday312'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-finma-text-dim">Versiyon</span>
                <span className="text-finma-text finma-number">{botStatus.version || '3.1.2'}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-finma-text-dim">Bot durumu alınamadı</div>
          )}
        </Card>

        <Card padding="sm">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-finma-yellow" />
            Son Sinyal Raporu
          </h2>
          {signals ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">Tarih</span>
                <span className="text-finma-text finma-number">{signals.report_date || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">Piyasa Rejimi</span>
                <Badge variant={signals.market_regime === 'Bull' ? 'bull' : 'bear'}>
                  {signals.market_regime}
                </Badge>
              </div>
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">VIX</span>
                <span className="text-finma-yellow finma-number">{signals.vix_level}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-finma-border/30">
                <span className="text-finma-text-dim">Toplam Aday</span>
                <span className="text-finma-text finma-number">{signals.candidates?.length ?? 0}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-finma-text-dim">Sektör Liderleri</span>
                <span className="text-finma-green">{signals.sector_leaders?.join(', ') || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-finma-text-dim">Sinyal verisi bulunamadı</div>
          )}
        </Card>
      </div>

      {/* Candidates Summary */}
      {signals?.candidates && signals.candidates.length > 0 && (
        <Card padding="sm">
          <h2 className="text-sm font-semibold text-white mb-3">Sinyal Adayları ({signals.candidates.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-finma-border text-finma-text-dim">
                  <th className="text-left px-3 py-2">Ticker</th>
                  <th className="text-left px-3 py-2">Aksiyon</th>
                  <th className="text-right px-3 py-2">Skor</th>
                  <th className="text-right px-3 py-2">Fiyat</th>
                  <th className="text-right px-3 py-2">Potansiyel</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Sektör</th>
                </tr>
              </thead>
              <tbody>
                {signals.candidates.map((c: any) => (
                  <tr key={c.ticker} className="border-b border-finma-border/50 hover:bg-finma-card-hover transition-colors">
                    <td className="px-3 py-2 font-semibold text-finma-primary finma-number">{c.ticker}</td>
                    <td className="px-3 py-2">
                      <Badge variant={c.action === 'BUY' ? 'buy' : c.action === 'HOLD' ? 'hold' : 'sell'}>
                        {c.action}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right finma-number text-finma-primary">{c.score?.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right finma-number">${c.price?.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right finma-number ${c.potential_pct >= 0 ? 'text-finma-green' : 'text-finma-red'}`}>
                      {c.potential_pct >= 0 ? '+' : ''}{c.potential_pct?.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-finma-text-dim hidden md:table-cell">{c.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
