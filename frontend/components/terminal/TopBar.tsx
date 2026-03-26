'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useTerminalStore } from '@/store/terminal'
import { MarketTicker } from './MarketTicker'
import { Bell, Search, User, Menu, LogOut, Settings, DollarSign, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  message: string
  category: string
  is_read: boolean
  created_at: string
  action_url?: string
}

export function TopBar() {
  const router = useRouter()
  const { sidebarOpen, setMobileMenuOpen } = useTerminalStore()
  const { user, logout } = useAuthStore()
  const [notificationDropdown, setNotificationDropdown] = useState(false)
  const [userDropdown, setUserDropdown] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null)

  // PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setPwaInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  // Bildirimleri getir
  useEffect(() => {
    if (!user) return
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('finma_token')
        const [notifRes, countRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'}/api/notifications?limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'}/api/notifications/unread-count`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])
        if (notifRes.ok) setNotifications(await notifRes.json())
        if (countRes.ok) {
          const data = await countRes.json()
          setUnreadCount(data.unread_count || 0)
        }
      } catch (error) {
        console.error('Bildirim yükleme hatası:', error)
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('finma_token')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications((n) => n.map((x) => (x.id === notificationId ? { ...x, is_read: true } : x)))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch (error) {
      console.error('Mark read hatası:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('finma_token')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications((n) => n.map((x) => ({ ...x, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Mark all read hatası:', error)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const tierColors = {
    free: 'bg-gray-500',
    pro: 'bg-blue-500',
    admin: 'bg-purple-500',
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-14 bg-finma-bg/95 backdrop-blur-sm border-b border-finma-border z-30 flex items-center transition-all duration-300',
        'left-0',
        sidebarOpen ? 'md:left-56' : 'md:left-16'
      )}
    >
      {/* Hamburger — mobilde (CSS ile gizle/göster, JS hook yok) */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="flex md:hidden items-center justify-center w-12 h-14 text-finma-text-muted hover:text-finma-text active:text-finma-primary transition-colors shrink-0"
        style={{ touchAction: 'manipulation' }}
        title="Menüyü aç"
        aria-label="Menüyü aç"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Market Ticker */}
      <div className="flex-1 overflow-hidden h-full">
        <MarketTicker />
      </div>

      {/* Sağ taraf: Actions */}
      <div className="flex items-center gap-1.5 md:gap-3 px-2 md:px-4 shrink-0">
        {/* World clocks */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-finma-text-dim">
          <WorldClock label="NY" tz="America/New_York" />
          <WorldClock label="LON" tz="Europe/London" />
          <WorldClock label="IST" tz="Europe/Istanbul" />
          <WorldClock label="TYO" tz="Asia/Tokyo" />
        </div>

        <div className="hidden lg:block w-px h-6 bg-finma-border mx-1" />

        {/* Search */}
        <button className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-finma-text-dim hover:text-finma-text transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* PWA Install Button (Mobile only) */}
        {pwaInstallPrompt && (
          <button
            onClick={async () => {
              if (pwaInstallPrompt) {
                pwaInstallPrompt.prompt()
                const { outcome } = await pwaInstallPrompt.userChoice
                if (outcome === 'accepted') {
                  setPwaInstallPrompt(null)
                }
              }
            }}
            className="md:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-finma-text-dim hover:text-finma-text transition-colors"
            title="Ana Ekrana Ekle"
          >
            <Download className="w-4 h-4" />
          </button>
        )}

        {/* Notifications dropdown */}
        <div className="relative">
          <button
            onClick={() => setNotificationDropdown(!notificationDropdown)}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-finma-text-dim hover:text-finma-text transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-finma-red rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown menu */}
          {notificationDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-finma-bg border border-finma-border rounded-lg shadow-xl z-50">
              {/* Header */}
              <div className="px-4 py-3 border-b border-finma-border flex items-center justify-between">
                <span className="text-xs font-semibold text-finma-text uppercase">Bildirimler</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-finma-primary hover:underline"
                  >
                    Hepsini Okundu
                  </button>
                )}
              </div>

              {/* Notifications list */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-finma-text-dim text-xs">
                    Bildirim yok
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'px-4 py-3 border-b border-finma-border/30 cursor-pointer hover:bg-finma-bg/50 transition-colors',
                        !notif.is_read && 'bg-finma-primary/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-finma-text">{notif.title}</span>
                            {!notif.is_read && (
                              <span className="w-2 h-2 bg-finma-primary rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-finma-text-dim mt-1 line-clamp-2">{notif.message}</p>
                          <span className="text-[9px] text-finma-text-dim/50 mt-1 block">
                            {new Date(notif.created_at).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {!notif.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="text-[10px] text-finma-primary hover:text-finma-primary/80 flex-shrink-0"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-finma-border/30 text-center">
                <button className="text-[10px] text-finma-primary hover:underline" onClick={() => setNotificationDropdown(false)}>
                  Kapat
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdown(!userDropdown)}
            className="p-1.5 rounded-full bg-finma-primary/20 text-finma-primary hover:bg-finma-primary/30 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <User className="w-4 h-4" />
          </button>

          {/* User dropdown menu */}
          {userDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-finma-bg border border-finma-border rounded-lg shadow-xl z-50">
              {/* User info */}
              {user && (
                <div className="px-4 py-3 border-b border-finma-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-finma-text">{user.full_name || user.username}</p>
                      <p className="text-[10px] text-finma-text-dim">{user.email}</p>
                    </div>
                    <span
                      className={cn(
                        'text-[8px] px-2 py-1 rounded text-white font-semibold uppercase',
                        tierColors[(user.subscription_tier || 'free') as keyof typeof tierColors] || 'bg-gray-500'
                      )}
                    >
                      {user.subscription_tier || 'free'}
                    </span>
                  </div>
                </div>
              )}

              {/* Menu items */}
              <div className="py-2">
                <button
                  onClick={() => {
                    router.push('/settings')
                    setUserDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-xs text-finma-text hover:bg-finma-bg/50 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-3 h-3" />
                  Ayarlar
                </button>
                <button
                  onClick={() => {
                    router.push('/account')
                    setUserDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-xs text-finma-text hover:bg-finma-bg/50 transition-colors flex items-center gap-2"
                >
                  <DollarSign className="w-3 h-3" />
                  Üyelik & Ödeme
                </button>
              </div>

              {/* Logout */}
              <div className="px-4 py-2 border-t border-finma-border/30">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-xs text-finma-red hover:bg-finma-red/10 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3 h-3" />
                  Çıkış Yap
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function WorldClock({ label, tz }: { label: string; tz: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-finma-text-dim/60 tracking-wider">{label}</div>
      <div className="text-finma-text-muted font-mono">
        <ClockTime tz={tz} />
      </div>
    </div>
  )
}

function ClockTime({ tz }: { tz: string }) {
  const [time, setTime] = useState<string>('--:--')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      try {
        const formatted = now.toLocaleTimeString('tr-TR', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        setTime(formatted)
      } catch {
        setTime('--:--')
      }
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [tz])

  return <>{time}</>
}
