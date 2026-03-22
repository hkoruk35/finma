'use client'

import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Settings, User, Bell, Globe, CreditCard, Crown, Gem, CheckCircle2, Mail } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import { SubscriptionAgreement } from '@/components/auth/SubscriptionAgreement'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAgreement, setShowAgreement] = useState(false)

  const handleUpgrade = () => {
    setShowAgreement(true)
  }

  const handleAgreementAccept = async () => {
    setShowAgreement(false)
    setUpgradeLoading(true)
    setUpgradeMsg(null)
    try {
      await api.startTrial()
      setUpgradeMsg({ type: 'success', text: 'Pro üyeliğiniz aktif! Sayfa yenileniyor...' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setUpgradeMsg({ type: 'error', text: err.message || 'Üyelik başlatılamadı' })
    } finally {
      setUpgradeLoading(false)
    }
  }

  const tierLabel =
    user?.subscription_tier === 'admin' ? 'Admin' :
    user?.subscription_tier === 'pro' ? 'Pro' : 'Free'

  const tierColor =
    user?.subscription_tier === 'admin' ? 'text-finma-green' :
    user?.subscription_tier === 'pro' ? 'text-finma-primary' : 'text-finma-text-dim'

  const isFreeTier = !user?.subscription_tier || user.subscription_tier === 'free'
  const isPro = user?.subscription_tier === 'pro'

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

        <div className="mb-4">
          <div className={`text-sm font-semibold ${tierColor} flex items-center gap-1.5`}>
            <Crown className="w-4 h-4" />
            {tierLabel}
          </div>
          <div className="text-[10px] text-finma-text-dim mt-0.5">
            {user?.subscription_tier === 'admin' ? 'Tüm özelliklere erişim' :
             user?.subscription_tier === 'pro' ? 'Pro — Hisse Analiz, İşlemler, Portföy, AI, Sinyaller' :
             'Free — Sadece temel piyasa verileri'}
          </div>
        </div>

        {/* Pro subscription info */}
        {isPro && (
          <div className="bg-finma-primary/5 border border-finma-primary/20 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-finma-primary" />
              <span className="text-xs font-semibold text-finma-primary">Pro Üyelik Aktif</span>
            </div>
            <p className="text-[10px] text-finma-text-dim">
              Aylık abonelik: <span className="text-white font-medium">$19 USD/ay</span>
            </p>
            <p className="text-[10px] text-finma-text-dim mt-1">
              Aboneliğinizi istediğiniz zaman iptal edebilirsiniz. İptal durumunda erişiminiz dönem sonuna kadar devam eder.
            </p>
          </div>
        )}

        {/* Pro upgrade for Free users */}
        {isFreeTier && (
          <div className="bg-gradient-to-r from-finma-primary/5 to-finma-primary/10 border border-finma-primary/20 rounded-lg p-4">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-finma-primary" />
              Pro Seviyesine Yükselt
            </h4>
            <p className="text-xs text-finma-text-dim mb-3">
              Tüm Pro özelliklerine erişim sağlayın.
            </p>

            <div className="space-y-2 mb-4">
              {[
                'AI destekli hisse analizi',
                'İşlem açma/kapama & portföy yönetimi',
                'Piyasa istihbaratı & rejim analizi',
                'Profesyonel interaktif grafikler',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-finma-green shrink-0" />
                  <span className="text-xs text-finma-text">{feat}</span>
                </div>
              ))}
            </div>

            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-white">$19</span>
              <span className="text-xs text-finma-text-dim">/ay</span>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="finma-btn-primary w-full text-sm py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" />
              {upgradeLoading ? 'Başlatılıyor...' : 'Pro Üyeliğe Geç — $19/ay'}
            </button>

            <p className="text-[9px] text-finma-text-dim text-center mt-2">
              İstediğiniz zaman iptal edebilirsiniz.
            </p>
          </div>
        )}

        {upgradeMsg && (
          <div className={`text-xs mt-3 px-3 py-2 rounded-md ${
            upgradeMsg.type === 'success'
              ? 'text-finma-green bg-finma-green/10 border border-finma-green/30'
              : 'text-finma-red bg-finma-red/10 border border-finma-red/30'
          }`}>
            {upgradeMsg.text}
          </div>
        )}
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-finma-green" />
          <span className="text-sm font-semibold">Bildirimler</span>
        </div>
        <div className="space-y-3">
          {[
            { label: 'E-posta bildirimleri', defaultChecked: true },
            { label: 'Yeni sinyal bildirimi', defaultChecked: true },
            { label: 'Stop-loss tetikleme uyarısı', defaultChecked: true },
            { label: 'Piyasa özeti (günlük)', defaultChecked: false },
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

      {/* Subscription Agreement Modal */}
      {showAgreement && (
        <SubscriptionAgreement
          onAccept={handleAgreementAccept}
          onClose={() => setShowAgreement(false)}
        />
      )}
    </div>
  )
}
