'use client'

import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Settings, User, Bell, Key, Globe, CreditCard, Send, Ticket, Crown, Gem } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleRedeemInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setInviteLoading(true)
    setInviteMsg(null)
    try {
      await api.redeemInvite(inviteCode.trim())
      setInviteMsg({ type: 'success', text: 'Premium üyelik aktif! Sayfa yenileniyor...' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setInviteMsg({ type: 'error', text: err.message || 'Davet kodu geçersiz' })
    } finally {
      setInviteLoading(false)
    }
  }

  const tierLabel =
    user?.subscription_tier === 'admin' ? 'Admin' :
    user?.subscription_tier === 'premium' ? 'Premium' :
    user?.subscription_tier === 'pro' ? 'Pro' : 'Free'

  const tierColor =
    user?.subscription_tier === 'admin' ? 'text-finma-green' :
    user?.subscription_tier === 'premium' ? 'text-purple-400' :
    user?.subscription_tier === 'pro' ? 'text-finma-primary' : 'text-finma-text-dim'

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-finma-primary" />
        <h1 className="text-lg font-bold text-white">Ayarlar</h1>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold">Profil</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Kullanıcı Adı</label>
            <input type="text" value={user?.username || ''} readOnly className="finma-input w-full opacity-70" />
          </div>
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">E-posta</label>
            <input type="email" value={user?.email || ''} readOnly className="finma-input w-full opacity-70" />
          </div>
        </div>
      </Card>

      {/* Subscription */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold">Abonelik</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-semibold ${tierColor} flex items-center gap-1.5`}>
              {user?.subscription_tier === 'premium' ? <Gem className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
              {tierLabel}
            </div>
            <div className="text-[10px] text-finma-text-dim mt-0.5">
              {user?.subscription_tier === 'admin' ? 'Tüm özelliklere erişim' :
               user?.subscription_tier === 'premium' ? 'Premium — Tüm Pro + Sinyaller + Takip Listeleri' :
               user?.subscription_tier === 'pro' ? 'Pro — Hisse Analiz, İşlemler, Portföy, AI Analiz' :
               'Free — Dashboard + Piyasa verileri'}
            </div>
            {user?.subscription_tier === 'pro' && user?.trial_start_date && (
              <div className="text-[10px] text-finma-yellow mt-1">
                Deneme süresi: {new Date(user.trial_start_date).toLocaleDateString('tr-TR')} tarihinde başladı
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Invite Code — only for non-premium users */}
      {user?.subscription_tier !== 'premium' && user?.subscription_tier !== 'admin' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Ticket className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold">Davet Kodu</span>
          </div>
          <p className="text-xs text-finma-text-dim mb-3">
            Premium üyelik için davet kodunuzu girin.
          </p>
          <form onSubmit={handleRedeemInvite} className="flex items-center gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="DAVET KODU"
              className="finma-input flex-1 text-center tracking-widest font-mono"
              maxLength={8}
            />
            <button
              type="submit"
              disabled={inviteLoading || !inviteCode.trim()}
              className="finma-btn-primary text-xs py-2 px-4 disabled:opacity-50"
            >
              {inviteLoading ? 'Kontrol...' : 'Kullan'}
            </button>
          </form>
          {inviteMsg && (
            <div className={`text-xs mt-2 px-3 py-2 rounded-md ${
              inviteMsg.type === 'success'
                ? 'text-finma-green bg-finma-green/10 border border-finma-green/30'
                : 'text-finma-red bg-finma-red/10 border border-finma-red/30'
            }`}>
              {inviteMsg.text}
            </div>
          )}
        </Card>
      )}

      {/* API Keys */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-finma-yellow" />
          <span className="text-sm font-semibold">API Anahtarları</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Gemini API Key</label>
            <input type="password" defaultValue="••••••••••••" className="finma-input w-full" />
          </div>
        </div>
      </Card>

      {/* Telegram */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4 text-finma-cyan" />
          <span className="text-sm font-semibold">Telegram Bildirimler</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Bot Token</label>
            <input type="password" placeholder="Telegram bot token" className="finma-input w-full" />
          </div>
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Chat ID</label>
            <input type="text" placeholder="Telegram chat ID" className="finma-input w-full" />
          </div>
          <button className="finma-btn-primary text-xs">Test Mesajı Gönder</button>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-finma-green" />
          <span className="text-sm font-semibold">Bildirimler</span>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Yeni sinyal bildirimi', defaultChecked: true },
            { label: 'Stop-loss tetikleme uyarısı', defaultChecked: true },
            { label: 'Piyasa özeti (günlük)', defaultChecked: false },
            { label: 'Telegram bildirimleri', defaultChecked: true },
          ].map((item) => (
            <label key={item.label} className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-finma-text">{item.label}</span>
              <input type="checkbox" defaultChecked={item.defaultChecked} className="rounded" />
            </label>
          ))}
        </div>
      </Card>

      {/* Language */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-finma-purple" />
          <span className="text-sm font-semibold">Dil</span>
        </div>
        <select className="finma-input w-full">
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </Card>
    </div>
  )
}
