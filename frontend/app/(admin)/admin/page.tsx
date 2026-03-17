'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { api } from '@/lib/api-client'
import { Users, Crown, Gem, UserCheck, Activity, Server } from 'lucide-react'

interface UserStats {
  total: number
  free: number
  pro: number
  admin: number
  activeTrial: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersRes, healthRes] = await Promise.allSettled([
        api.listUsers(1000, 0),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`).then(r => r.json()),
      ])

      if (usersRes.status === 'fulfilled') {
        const users = usersRes.value
        const now = new Date()
        setStats({
          total: users.length,
          free: users.filter((u: any) => u.subscription_tier === 'free').length,
          pro: users.filter((u: any) => u.subscription_tier === 'pro').length,
          admin: users.filter((u: any) => u.subscription_tier === 'admin' || u.role === 'admin').length,
          activeTrial: users.filter((u: any) => {
            if (u.subscription_tier !== 'pro' || !u.trial_start_date) return false
            const trialEnd = new Date(u.trial_start_date)
            trialEnd.setDate(trialEnd.getDate() + 7)
            return trialEnd > now
          }).length,
        })
      }

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value)
      }
    } catch (err) {
      console.error('Admin data load error:', err)
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
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-finma-primary" />
            <span className="text-[10px] text-finma-text-dim uppercase">Toplam</span>
          </div>
          <span className="finma-number text-2xl font-bold text-white">{stats?.total ?? 0}</span>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-finma-text-dim" />
            <span className="text-[10px] text-finma-text-dim uppercase">Free</span>
          </div>
          <span className="finma-number text-2xl font-bold text-finma-text-muted">{stats?.free ?? 0}</span>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-finma-primary" />
            <span className="text-[10px] text-finma-text-dim uppercase">Pro</span>
          </div>
          <span className="finma-number text-2xl font-bold text-finma-primary">{stats?.pro ?? 0}</span>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-finma-green" />
            <span className="text-[10px] text-finma-text-dim uppercase">Aktif Trial</span>
          </div>
          <span className="finma-number text-2xl font-bold text-finma-green">{stats?.activeTrial ?? 0}</span>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-finma-cyan" />
            <span className="text-[10px] text-finma-text-dim uppercase">Sistem</span>
          </div>
          <span className={`text-sm font-bold ${health?.status === 'ok' ? 'text-finma-green' : 'text-finma-red'}`}>
            {health?.status === 'ok' ? 'Çalışıyor' : 'Bağlantı Yok'}
          </span>
        </Card>
      </div>

      {/* System Info */}
      {health && (
        <Card padding="sm">
          <h2 className="text-sm font-semibold text-white mb-3">Sistem Bilgisi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
              <span className="text-finma-text-dim">Veritabanı</span>
              <div className={`font-semibold mt-1 ${health.database === 'connected' ? 'text-finma-green' : 'text-finma-yellow'}`}>
                {health.database === 'connected' ? 'Bağlı' : health.database || 'Bilinmiyor'}
              </div>
            </div>
            <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
              <span className="text-finma-text-dim">Son Sinyal</span>
              <div className="font-semibold mt-1 text-finma-text">
                {health.last_signal_date || 'Veri yok'}
              </div>
            </div>
            <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
              <span className="text-finma-text-dim">API Versiyon</span>
              <div className="font-semibold mt-1 text-finma-text">
                {health.version || 'v4.0'}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
