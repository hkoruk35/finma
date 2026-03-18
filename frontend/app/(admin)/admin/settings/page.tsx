'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { api } from '@/lib/api-client'
import { Bot, RefreshCw, Play, Square, Settings as SettingsIcon, Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminSettingsPage() {
  const [bots, setBots] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadBots()
  }, [])

  const loadBots = async () => {
    try {
      const data = await api.getBotStatus()
      setBots(data)
    } catch (err) {
      console.error('Failed to load bots:', err)
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
      setTimeout(loadBots, 2000)
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
      await loadBots()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'İşlem başarısız.' })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-finma-text-dim text-sm font-mono">Loading system status...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-finma-primary" />
          <h1 className="text-xl font-bold text-white tracking-tight">Sistem Ayarları</h1>
        </div>
        <button 
          onClick={loadBots} 
          className="text-xs text-finma-text-dim hover:text-finma-primary flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Yenile
        </button>
      </div>

      {message && (
        <div className={cn(
          "px-4 py-3 rounded-lg border text-sm flex items-center gap-3 animate-slide-up",
          message.type === 'success' ? "bg-finma-green/10 border-finma-green/30 text-finma-green" : "bg-finma-red/10 border-finma-red/30 text-finma-red"
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Bot Management Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-finma-text-dim uppercase tracking-widest flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Bot Yönetim Merkezi
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {bots && Object.entries(bots).map(([id, bot]: [string, any]) => (
            <Card key={id} padding="none" className="overflow-hidden border-l-4 border-l-finma-primary/40">
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                    bot.scheduled ? "bg-finma-green/10 text-finma-green" : "bg-finma-red/10 text-finma-red"
                  )}>
                    <Activity className={cn("w-5 h-5", bot.scheduled && "animate-pulse")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white text-base">{id}</h3>
                      <Badge variant={bot.scheduled ? 'bull' : 'bear'}>
                        {bot.scheduled ? 'ÇALIŞIYOR' : 'DURDURULDU'}
                      </Badge>
                    </div>
                    <p className="text-xs text-finma-text-dim max-w-md">{bot.name}</p>
                    <div className="mt-2 flex items-center gap-4 text-[10px] font-mono text-finma-text-dim">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Script: {bot.script}
                      </span>
                      {bot.next_run && (
                        <span className="flex items-center gap-1">
                          <Play className="w-3 h-3 text-finma-green" />
                          Next: {new Date(bot.next_run).toLocaleString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-finma-border/40">
                  <button
                    onClick={() => handleToggleBot(id, !bot.scheduled)}
                    disabled={!!actionLoading}
                    className={cn(
                      "flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                      bot.scheduled 
                        ? "bg-finma-red/10 text-finma-red border-finma-red/30 hover:bg-finma-red/20" 
                        : "bg-finma-green/10 text-finma-green border-finma-green/30 hover:bg-finma-green/20"
                    )}
                  >
                    {bot.scheduled ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    {bot.scheduled ? 'Durdur' : 'Başlat'}
                  </button>
                  
                  <button
                    onClick={() => handleRunBot(id)}
                    disabled={!!actionLoading}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-finma-primary/10 text-finma-primary border border-finma-primary/30 hover:bg-finma-primary/20 transition-all"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", actionLoading === `${id}-run` && "animate-spin")} />
                    Şimdi Çalıştır
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="pt-8 border-t border-finma-border/40">
        <h2 className="text-sm font-semibold text-finma-text-dim uppercase tracking-widest mb-4">Sistem Bilgileri</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card padding="sm" className="bg-white/5 border-white/10">
            <div className="text-[10px] text-finma-text-dim uppercase mb-1">Versiyon</div>
            <div className="text-sm font-bold text-white font-mono">v4.2.0-PRO</div>
          </Card>
          <Card padding="sm" className="bg-white/5 border-white/10">
            <div className="text-[10px] text-finma-text-dim uppercase mb-1">API Status</div>
            <div className="text-sm font-bold text-finma-green">Online</div>
          </Card>
          <Card padding="sm" className="bg-white/5 border-white/10">
            <div className="text-[10px] text-finma-text-dim uppercase mb-1">Database</div>
            <div className="text-sm font-bold text-finma-primary">Supabase Connected</div>
          </Card>
          <Card padding="sm" className="bg-white/5 border-white/10">
            <div className="text-[10px] text-finma-text-dim uppercase mb-1">Server</div>
            <div className="text-sm font-bold text-finma-cyan">Railway.app</div>
          </Card>
        </div>
      </section>
    </div>
  )
}
