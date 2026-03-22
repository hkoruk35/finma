'use client'

import { useEffect, useRef, useState } from 'react'
import { useTerminalStore } from '@/store/terminal'
import { MarketTicker } from './MarketTicker'
import { Bell, Search, User, Menu, Settings, LogOut, ChevronRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

// ─── Types ───
interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  created_at: string
}

interface UserInfo {
  username: string
  email?: string
  tier?: string
  full_name?: string
}

// ─── Notification Dropdown ───
function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('finma_token')
    if (!token) { setLoading(false); return }
    fetch(`${API_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.notifications) setNotifications(data.notifications)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const markRead = async (id: string) => {
    const token = localStorage.getItem('finma_token')
    if (!token) return
    await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    const token = localStorage.getItem('finma_token')
    if (!token) return
    await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-finma-surface border border-finma-border rounded-lg shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-finma-border">
        <span className="text-sm font-semibold text-finma-text">
          Bildirimler {unread > 0 && <span className="ml-1 text-xs bg-finma-red text-white rounded-full px-1.5 py-0.5">{unread}</span>}
        </span>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-finma-primary hover:underline">
              Tümünü oku
            </button>
          )}
          <button onClick={onClose} className="text-finma-text-dim hover:text-finma-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-finma-text-dim text-sm">Yükleniyor...</div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-finma-text-dim text-sm">Bildirim yok</div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={cn(
                'px-4 py-3 border-b border-finma-border/50 flex gap-3 cursor-pointer hover:bg-finma-border/20 transition-colors',
                !n.is_read && 'bg-finma-primary/5'
              )}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className={cn(
                'w-2 h-2 rounded-full mt-1.5 shrink-0',
                n.type === 'success' ? 'bg-finma-green' :
                n.type === 'warning' ? 'bg-yellow-400' :
                n.type === 'error' ? 'bg-finma-red' : 'bg-finma-primary'
              )} />
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-medium', n.is_read ? 'text-finma-text-muted' : 'text-finma-text')}>
                  {n.title}
                </div>
                <div className="text-xs text-finma-text-dim mt-0.5 line-clamp-2">{n.message}</div>
                <div className="text-[10px] text-finma-text-dim/60 mt-1">
                  {new Date(n.created_at).toLocaleString('tr-TR')}
                </div>
              </div>
              {!n.is_read && <Check className="w-3.5 h-3.5 text-finma-primary shrink-0 mt-1" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── User Dropdown ───
function UserDropdown({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('finma_token')
    if (!token) return
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const logout = () => {
    localStorage.removeItem('finma_token')
    router.push('/login')
  }

  const tierBadge: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    pro: 'bg-finma-primary/20 text-finma-primary border-finma-primary/40',
    free: 'bg-finma-text-dim/20 text-finma-text-muted border-finma-border',
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-60 bg-finma-surface border border-finma-border rounded-lg shadow-2xl z-50 overflow-hidden"
    >
      {/* User info */}
      <div className="px-4 py-3 border-b border-finma-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-finma-primary/20 flex items-center justify-center text-finma-primary font-bold text-sm">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-finma-text truncate">
              {user?.full_name || user?.username || 'Kullanıcı'}
            </div>
            <div className="text-xs text-finma-text-dim truncate">{user?.email || ''}</div>
          </div>
        </div>
        {user?.tier && (
          <div className={cn(
            'mt-2 text-xs font-medium px-2 py-0.5 rounded-full border w-fit',
            tierBadge[user.tier] || tierBadge.free
          )}>
            {user.tier.toUpperCase()}
          </div>
        )}
      </div>
      {/* Menu */}
      <div className="py-1">
        <button
          onClick={() => { router.push('/settings'); onClose() }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-finma-text-muted hover:text-finma-text hover:bg-finma-border/20 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Ayarlar
          <ChevronRight className="w-3.5 h-3.5 ml-auto" />
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-finma-red hover:bg-finma-red/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}

// ─── Main TopBar ───
export function TopBar() {
  const { sidebarOpen, setMobileMenuOpen } = useTerminalStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread count on mount
  useEffect(() => {
    const token = localStorage.getItem('finma_token')
    if (!token) return
    fetch(`${API_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.unread_count) setUnreadCount(data.unread_count) })
      .catch(() => {})
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-14 bg-finma-bg/95 backdrop-blur-sm border-b border-finma-border z-30 flex items-center transition-all duration-300',
        'left-0',
        sidebarOpen ? 'md:left-56' : 'md:left-16'
      )}
    >
      {/* Hamburger — mobilde */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden flex items-center justify-center w-12 h-14 text-finma-text-muted hover:text-finma-text transition-colors shrink-0"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Market Ticker */}
      <div className="flex-1 overflow-hidden h-full">
        <MarketTicker />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1.5 md:gap-3 px-2 md:px-4 shrink-0">
        {/* World clocks */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-finma-text-dim">
          <WorldClock label="NEW YORK" tz="America/New_York" />
          <WorldClock label="LONDON" tz="Europe/London" />
          <WorldClock label="İSTANBUL" tz="Europe/Istanbul" />
          <WorldClock label="TOKYO" tz="Asia/Tokyo" />
        </div>

        <div className="hidden lg:block w-px h-6 bg-finma-border mx-1" />

        <button className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-finma-text-dim hover:text-finma-text transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(v => !v); setUserOpen(false) }}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-finma-text-dim hover:text-finma-text transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-finma-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(v => !v); setNotifOpen(false) }}
            className="p-1.5 rounded-full bg-finma-primary/20 text-finma-primary hover:bg-finma-primary/30 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <User className="w-4 h-4" />
          </button>
          {userOpen && <UserDropdown onClose={() => setUserOpen(false)} />}
        </div>
      </div>
    </header>
  )
}

function WorldClock({ label, tz }: { label: string; tz: string }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      try {
        setTime(new Date().toLocaleTimeString('tr-TR', {
          timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
        }))
      } catch { setTime('--:--') }
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [tz])
  return (
    <div className="text-center">
      <div className="text-[9px] text-finma-text-dim/60 tracking-wider">{label}</div>
      <div className="text-finma-text-muted font-mono">{time || '--:--'}</div>
    </div>
  )
}
