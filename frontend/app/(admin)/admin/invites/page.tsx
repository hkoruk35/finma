'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { api } from '@/lib/api-client'
import { Ticket, Plus, Copy, Check, RefreshCw } from 'lucide-react'

interface InviteCode {
  id?: string
  code: string
  created_by?: string
  used_by?: string
  used_at?: string
  expires_at?: string
  created_at?: string
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    loadInvites()
  }, [])

  const loadInvites = async () => {
    try {
      const data = await api.listInvites()
      setInvites(data)
    } catch (err) {
      console.error('Invites load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await api.generateInvite()
      setInvites(prev => [result, ...prev])
    } catch (err: any) {
      alert(err.message || 'Kod oluşturulamadı')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = (code: string) => {
    const inviteUrl = `${window.location.origin}/invite/${code}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-finma-text-dim text-sm">Yükleniyor...</div>
      </div>
    )
  }

  const unusedCount = invites.filter(i => !i.used_by).length
  const usedCount = invites.filter(i => i.used_by).length

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Ticket className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">Davet Kodları</h1>
          <span className="text-xs text-finma-text-dim">
            {unusedCount} kullanılmamış / {usedCount} kullanılmış
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadInvites} className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5 !bg-finma-card !text-finma-text-muted !border-finma-border hover:!text-white">
            <RefreshCw className="w-3 h-3" />
            Yenile
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5 disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            {generating ? 'Oluşturuluyor...' : 'Yeni Kod Oluştur'}
          </button>
        </div>
      </div>

      {/* Table */}
      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="text-left px-3 py-2">Kod</th>
                <th className="text-left px-3 py-2">Durum</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Kullanan</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Kullanım Tarihi</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Oluşturulma</th>
                <th className="text-left px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id || inv.code} className="border-b border-finma-border/50 hover:bg-finma-card-hover transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="finma-number font-mono font-bold text-finma-primary tracking-wider">
                      {inv.code}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {inv.used_by ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-finma-text-dim/10 text-finma-text-dim border border-finma-border font-medium">
                        Kullanıldı
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-finma-green/15 text-finma-green border border-finma-green/30 font-medium">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-finma-text-muted hidden md:table-cell">
                    {inv.used_by || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-finma-text-dim hidden md:table-cell finma-number">
                    {inv.used_at ? new Date(inv.used_at).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-finma-text-dim hidden lg:table-cell finma-number">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {!inv.used_by && (
                      <button
                        onClick={() => handleCopy(inv.code)}
                        className="flex items-center gap-1 text-finma-text-dim hover:text-finma-primary transition-colors"
                        title="Davet linkini kopyala"
                      >
                        {copiedCode === inv.code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-finma-green" />
                            <span className="text-finma-green">Kopyalandı</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Kopyala</span>
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-finma-text-dim">
                    Henüz davet kodu oluşturulmamış
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
