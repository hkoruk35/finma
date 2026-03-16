'use client'

import { useState } from 'react'
import { Crown, Gem, Zap, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'

interface UpgradePromptProps {
  requiredTier: 'pro' | 'premium'
}

export function UpgradePrompt({ requiredTier }: UpgradePromptProps) {
  const { login } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const handleStartTrial = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.startTrial()
      login(result.access_token, result.user as any)
    } catch (err: any) {
      setError(err.message || 'Deneme başlatılamadı')
    } finally {
      setLoading(false)
    }
  }

  const handleRedeemInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setInviteLoading(true)
    setError('')
    try {
      await api.redeemInvite(inviteCode.trim())
      // Refresh user data
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Davet kodu geçersiz')
    } finally {
      setInviteLoading(false)
    }
  }

  if (requiredTier === 'premium') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full bg-finma-card border border-finma-border rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gem className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Premium Özellik</h2>
          <p className="text-sm text-finma-text-dim mb-6">
            Bu özellik sadece Premium üyelere açıktır. Premium üyelik için davet kodu gereklidir.
          </p>

          <form onSubmit={handleRedeemInvite} className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Davet kodunuzu girin"
              className="finma-input w-full text-center tracking-widest text-lg"
              maxLength={8}
            />
            <button
              type="submit"
              disabled={inviteLoading || !inviteCode.trim()}
              className="finma-btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {inviteLoading ? 'Kontrol ediliyor...' : 'Kodu Kullan'}
            </button>
          </form>

          {error && (
            <div className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2 mt-3">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Pro tier upgrade prompt
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-finma-card border border-finma-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-finma-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Crown className="w-8 h-8 text-finma-primary" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Pro Özellik</h2>
        <p className="text-sm text-finma-text-dim mb-6">
          Bu özelliğe erişmek için Pro üyelik gereklidir.
        </p>

        <div className="bg-finma-bg/50 rounded-lg p-4 mb-6 text-left">
          <div className="text-xs font-semibold text-finma-primary mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Pro Üyelik Avantajları
          </div>
          <ul className="text-xs text-finma-text-dim space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-finma-green">✓</span> Hisse Analiz — Detaylı teknik analiz
            </li>
            <li className="flex items-center gap-2">
              <span className="text-finma-green">✓</span> İşlemler — Trade yönetimi
            </li>
            <li className="flex items-center gap-2">
              <span className="text-finma-green">✓</span> Portföy — Tam portföy takibi
            </li>
            <li className="flex items-center gap-2">
              <span className="text-finma-green">✓</span> AI Analiz — Yapay zeka destekli öneriler
            </li>
            <li className="flex items-center gap-2">
              <span className="text-finma-green">✓</span> Komuta Merkezi — Dashboard'da tam erişim
            </li>
          </ul>
        </div>

        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="finma-btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Başlatılıyor...' : '7 Gün Ücretsiz Deneyin'}
        </button>

        {error && (
          <div className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2 mt-3">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
