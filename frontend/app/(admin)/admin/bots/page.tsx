'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { api } from '@/lib/api-client'
import { 
  Bot, RefreshCw, Clock, Activity, Play, Square, 
  CheckCircle2, AlertCircle, Laptop, Terminal, ExternalLink, 
  FileText, X 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminBotsPage() {
  const [botStatus, setBotStatus] = useState<any>(null)
  const [signals, setSignals] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedBotLog, setSelectedBotLog] = useState<string | null>(null)
  const [logContent, setLogContent] = useState<string>('')
  const [logLoading, setLogLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statusData, signalsData] = await Promise.all([
        api.getBotStatus(),
        api.getLatestSignals()
      ])
      setBotStatus(statusData)
      setSignals(signalsData)
    } catch (err) {
      console.error('Bot data load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRunBot = async (botName: string) => {
    setActionLoading(`${botName}-run`)
    setMessage(null)
    try {
      await api.runBot(botName)
      setMessage({ type: 'success', text: `${botName} manuel olarak tetiklendi.` })
      setTimeout(loadData, 2000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Bot başlatılamadı.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleBot = async (botName: string, active: boolean) => {
    setActionLoading(`${botName}-toggle`)
    setMessage(null)
    try {
      await api.toggleBot(botName, active)
      setMessage({ type: 'success', text: `${botName} zamanlaması ${active ? 'aktif edildi' : 'durduruldu'}.` })
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'İşlem başarısız.' })
    } finally {
      setActionLoading(null)
    }
  }

  const fetchLogs = async (botName: string) => {
    setLogLoading(true)
    try {
      const res = await api.getBotLogs(botName)
      setLogContent(res.logs)
    } catch (err: any) {
      setLogContent('Loglar alınamadı: ' + err.message)
    } finally {
      setLogLoading(false)
    }
  }

  useEffect(() => {
    let interval: any
    if (selectedBotLog) {
      fetchLogs(selectedBotLog)
      interval = setInterval(() => fetchLogs(selectedBotLog), 3000)
    }
    return () => clearInterval(interval)
  }, [selectedBotLog])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-finma-text-dim text-sm font-mono tracking-widest uppercase">
          Sistem Verileri Getiriliyor...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-finma-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-finma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Bot Yönetim Merkezi</h1>
            <p className="text-[10px] text-finma-text-dim uppercase tracking-wider mt-0.5">Sistem ve Sinyal Kontrol Paneli</p>
          </div>
        </div>
        <button 
          onClick={loadData} 
          className="finma-btn-primary flex items-center gap-2 px-4 py-2 text-xs"
          disabled={loading}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Sistemi Yenile
        </button>
      </div>

      {message && (
        <div className={cn(
          "px-4 py-3 rounded-lg border text-sm flex items-center gap-3 animate-slide-up shadow-lg",
          message.type === 'success' 
            ? "bg-finma-green/10 border-finma-green/30 text-finma-green" 
            : "bg-finma-red/10 border-finma-red/30 text-finma-red"
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs hover:underline opacity-50">Kapat</button>
        </div>
      )}

      {/* Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Bots List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-finma-primary" />
              Sistem Botları Listesi
            </h2>
            <Badge variant="default" className="text-[10px]">
              {botStatus ? Object.keys(botStatus).length : 0} Bot Bulundu
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {botStatus && Object.entries(botStatus).map(([id, bot]: [string, any]) => (
              <Card key={id} padding="none" className="overflow-hidden border border-finma-border/50 hover:border-finma-primary/30 transition-all duration-300">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500",
                      bot.scheduled ? "bg-finma-green/10 text-finma-green" : "bg-finma-red/10 text-finma-red",
                      bot.scheduled && "animate-pulse"
                    )}>
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-white text-sm truncate">{id}</h3>
                        <Badge variant={bot.scheduled ? 'bull' : 'bear'} className="text-[9px] py-0 px-1.5 h-4">
                          {bot.scheduled ? 'AKTİF' : 'PASİF'}
                        </Badge>
                      </div>
                      <p className="text-xs text-finma-text-dim truncate max-w-[200px] md:max-w-md">{bot.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleBot(id, !bot.scheduled)}
                      disabled={!!actionLoading}
                      title={bot.scheduled ? 'Zamanlamayı Durdur' : 'Zamanlamayı Başlat'}
                      className={cn(
                        "p-2 rounded-lg border transition-all",
                        bot.scheduled 
                          ? "bg-finma-red/10 text-finma-red border-finma-red/30 hover:bg-finma-red/20" 
                          : "bg-finma-green/10 text-finma-green border-finma-green/30 hover:bg-finma-green/20"
                      )}
                    >
                      {bot.scheduled ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    
                    <button
                      onClick={() => handleRunBot(id)}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold bg-finma-primary/10 text-finma-primary border border-finma-primary/30 hover:bg-finma-primary/20 transition-all"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", actionLoading === `${id}-run` && "animate-spin")} />
                      Çalıştır
                    </button>

                    <button
                      onClick={() => setSelectedBotLog(id)}
                      className="p-2 rounded-lg border border-finma-border/50 text-finma-text-dim hover:text-white hover:bg-white/5 transition-all"
                      title="Logları Görüntüle"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* System Summary & Signal Status */}
        <div className="space-y-6">
          <Card padding="sm" className="bg-finma-bg/40 border-finma-border/60">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-finma-yellow" />
              Son Sinyal Durumu
            </h2>
            {signals ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/10">
                    <div className="text-[9px] text-finma-text-dim uppercase font-bold mb-1">Piyasa</div>
                    <Badge variant={signals.market_regime === 'Bull' ? 'bull' : 'bear'} className="w-full justify-center">
                      {signals.market_regime}
                    </Badge>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/10">
                    <div className="text-[9px] text-finma-text-dim uppercase font-bold mb-1">VIX Seviyesi</div>
                    <div className="text-sm font-mono font-bold text-finma-yellow">{signals.vix_level}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-finma-border/40">
                  <div className="flex justify-between text-xs">
                    <span className="text-finma-text-dim">Son Rapor Tarihi:</span>
                    <span className="text-white font-mono">{signals.timestamp?.split(' ')[1] || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-finma-text-dim">Toplam Aday:</span>
                    <span className="text-finma-primary font-bold">{signals.candidates?.length ?? 0}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[9px] text-finma-text-dim uppercase font-bold mb-2">Sektör Liderleri</div>
                  <div className="flex flex-wrap gap-1.5">
                    {signals.sector_leaders?.map((s: string) => (
                      <span key={s} className="px-2 py-1 rounded bg-finma-green/10 text-finma-green text-[10px] border border-finma-green/20">
                        {s}
                      </span>
                    )) || <span className="text-xs text-finma-text-muted italic">Veri yok</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-finma-text-dim/30 mx-auto mb-2" />
                <p className="text-xs text-finma-text-dim">Sinyal verisi bulunamadı.</p>
              </div>
            )}
          </Card>

          <Card padding="sm" className="border-l-4 border-l-finma-primary">
            <h2 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-finma-cyan" />
              Altyapı Durumu
            </h2>
            <div className="space-y-2.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-finma-text-dim">Server Location</span>
                <span className="text-finma-text">Railway (US-East)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-finma-text-dim">Database Status</span>
                <span className="text-finma-green font-bold">READY (Supabase)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-finma-text-dim">Scheduler Status</span>
                <span className="text-finma-primary font-bold">ACTIVE</span>
              </div>
              <div className="pt-2">
                <a 
                  href="https://railway.app" 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Sistem Loglarını Gör
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Candidates Detail View */}
      {signals?.candidates && signals.candidates.length > 0 && (
        <Card padding="none" className="overflow-hidden border border-finma-border/50">
          <div className="px-4 py-3 border-b border-finma-border/50 bg-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-finma-green" />
              Sinyal Detayları (Son Rapor)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-finma-border text-finma-text-dim bg-finma-bg/20">
                  <th className="text-left px-4 py-3">Sembol</th>
                  <th className="text-left px-4 py-3">Aksiyon</th>
                  <th className="text-right px-4 py-3">Skor</th>
                  <th className="text-right px-4 py-3">Fiyat</th>
                  <th className="text-right px-4 py-3">Hedef / Stop</th>
                  <th className="text-right px-4 py-3">Potansiyel</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Sektör</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-finma-border/30">
                {signals.candidates.map((c: any) => (
                  <tr key={c.ticker} className="hover:bg-finma-card-hover transition-colors group">
                    <td className="px-4 py-4 font-bold text-finma-primary finma-number text-sm">{c.ticker}</td>
                    <td className="px-4 py-4">
                      <Badge variant={c.action === 'BUY' ? 'buy' : c.action === 'HOLD' ? 'hold' : 'sell'} className="text-[10px] px-2">
                        {c.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-xs font-bold text-finma-text finma-number bg-white/5 px-2 py-1 rounded border border-white/10">
                        {c.score?.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right finma-number text-white font-medium">${c.price?.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-finma-green font-bold finma-number">${c.target?.toFixed(2) || c.tp2?.toFixed(2)}</span>
                        <span className="text-[10px] text-finma-red/70 finma-number">${c.stop_loss?.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-4 text-right finma-number font-bold text-sm ${c.potential_pct >= 0 ? 'text-finma-green' : 'text-finma-red'}`}>
                      {c.potential_pct >= 0 ? '+' : ''}{c.potential_pct?.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-finma-text-dim hidden md:table-cell italic">{c.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {/* Log Modal */}
      {selectedBotLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border-finma-primary/30 shadow-2xl">
            <div className="p-4 border-b border-finma-border flex items-center justify-between bg-finma-card">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-finma-primary" />
                <h3 className="font-bold text-white uppercase tracking-wider">{selectedBotLog} - Canlı Log Akışı</h3>
                {logLoading && <RefreshCw className="w-3 h-3 animate-spin text-finma-primary" />}
              </div>
              <button 
                onClick={() => setSelectedBotLog(null)}
                className="p-1 px-2 rounded-md hover:bg-white/10 text-finma-text-dim hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 bg-black/50 overflow-y-auto font-mono text-[11px] leading-relaxed text-finma-green/90 whitespace-pre-wrap selection:bg-finma-primary/30">
              {logContent || 'Log bekleniyor...'}
              <div id="logs-end"></div>
            </div>
            <div className="p-3 border-t border-finma-border bg-finma-card/50 flex justify-between items-center">
              <span className="text-[10px] text-finma-text-dim">Her 3 saniyede bir güncellenir</span>
              <button 
                onClick={() => setLogContent('')}
                className="text-[10px] text-finma-text-dim hover:text-white"
              >
                Temizle
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
