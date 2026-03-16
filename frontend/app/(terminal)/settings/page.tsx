'use client'

import { Card } from '@/components/shared/Card'
import { Settings, User, Bell, Key, Globe, CreditCard, Send } from 'lucide-react'

export default function SettingsPage() {
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Kullanıcı Adı</label>
            <input type="text" defaultValue="admin" className="finma-input w-full" />
          </div>
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">E-posta</label>
            <input type="email" defaultValue="admin@finma.com" className="finma-input w-full" />
          </div>
        </div>
      </Card>

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

      {/* Subscription */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold">Abonelik</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-finma-green">Admin</div>
            <div className="text-[10px] text-finma-text-dim">Tüm özelliklere erişim</div>
          </div>
          <button className="finma-btn-primary text-xs">Planı Yönet</button>
        </div>
      </Card>
    </div>
  )
}
