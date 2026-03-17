'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { api } from '@/lib/api-client'
import { Users, Search, ChevronDown } from 'lucide-react'

interface UserRow {
  id: string
  username: string
  email: string
  full_name?: string
  role: string
  subscription_tier: string
  trial_start_date?: string
  created_at?: string
}

const TIER_OPTIONS = ['free', 'pro', 'admin']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await api.listUsers(1000, 0)
      setUsers(data)
    } catch (err) {
      console.error('Users load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTierChange = async (userId: string, username: string, newTier: string) => {
    setUpdating(userId)
    try {
      await api.updateUserTier(username, newTier)
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, subscription_tier: newTier, role: newTier } : u
      ))
    } catch (err: any) {
      alert(err.message || 'Tier güncellenemedi')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchTier = tierFilter === 'all' || u.subscription_tier === tierFilter
    return matchSearch && matchTier
  })

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'admin': return <Badge variant="bull">Admin</Badge>
      case 'pro': return <Badge variant="buy">Pro</Badge>
      default: return <span className="text-[10px] px-2 py-0.5 rounded-full bg-finma-bg text-finma-text-dim border border-finma-border font-medium">Free</span>
    }
  }

  const getTrialStatus = (u: UserRow) => {
    if (u.subscription_tier !== 'pro' || !u.trial_start_date) return null
    const trialEnd = new Date(u.trial_start_date)
    trialEnd.setDate(trialEnd.getDate() + 7)
    const now = new Date()
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return <span className="text-[10px] text-finma-yellow">{daysLeft} gün kaldı</span>
    }
    return <span className="text-[10px] text-finma-red">Süresi doldu</span>
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">Kullanıcı Yönetimi</h1>
          <span className="text-xs text-finma-text-dim finma-number">({filtered.length})</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-finma-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kullanıcı ara..."
            className="finma-input w-full pl-9"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="finma-input text-xs"
        >
          <option value="all">Tüm Tierlar</option>
          {TIER_OPTIONS.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="text-left px-3 py-2">Kullanıcı</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Email</th>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Trial</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Kayıt</th>
                <th className="text-left px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-finma-border/50 hover:bg-finma-card-hover transition-colors">
                  <td className="px-3 py-2.5">
                    <div>
                      <div className="font-semibold text-white">{u.full_name || u.username}</div>
                      <div className="text-[10px] text-finma-text-dim md:hidden">{u.email}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-finma-text-muted hidden md:table-cell">{u.email}</td>
                  <td className="px-3 py-2.5">{getTierBadge(u.subscription_tier)}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell">{getTrialStatus(u) || '—'}</td>
                  <td className="px-3 py-2.5 text-finma-text-dim hidden lg:table-cell finma-number">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={u.subscription_tier}
                      onChange={(e) => handleTierChange(u.id, u.username, e.target.value)}
                      disabled={updating === u.id}
                      className="finma-input text-[11px] py-1 px-2 disabled:opacity-50"
                    >
                      {TIER_OPTIONS.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-finma-text-dim">
                    Kullanıcı bulunamadı
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
