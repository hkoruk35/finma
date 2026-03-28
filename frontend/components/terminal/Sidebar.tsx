'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  ChevronDown,
  Lock,
  Crown,
  X,
  Shield,
  LogOut,
  User,
  Flame,
  BarChart3,
  Target,
  Bot,
  Archive,
  History,
  TrendingUp,
  Globe2,
  Star,
  Activity,
  Bell,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal'
import { useAuthStore } from '@/store/auth'
import { useState, useEffect } from 'react'

type Tier = 'free' | 'pro' | 'pro+' | 'admin'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  section: string
  emoji?: string
  tier?: Tier
  badge?: 'lock' | 'gem' | 'new'
  highlight?: boolean
  children?: { href: string; icon: React.ElementType; label: string }[]
}

interface NavGroup {
  category: string
  categoryColor: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  // ▾ PİYASA & ANALİZ (Ücretsiz)
  {
    category: '▾ PİYASA & ANALİZ',
    categoryColor: 'text-emerald-500/80',
    items: [
      { emoji: '🏠', label: 'Ana Sayfa', href: '/dashboard', icon: LayoutDashboard, section: 'dashboard' },
      { emoji: '⚡', label: 'Canlı Piyasa Radarı', href: '/market/radar', icon: Zap, section: 'radar' },
      { emoji: '🧭', label: 'Makro Endeksler', href: '/macro', icon: Globe2, section: 'macro' },
      { emoji: '🗺️', label: 'Para Akışı Haritası', href: '/market/flow', icon: Target, section: 'flow' },
      { emoji: '🔥', label: 'Hacim Liderleri', href: '/market/volume', icon: Flame, section: 'volume' },
      { emoji: '💸', label: 'Temettü Yıldızları', href: '/dividends', icon: Star, section: 'dividends' },
      { emoji: '🎯', label: 'AI Başarı Karnesi', href: '/finma514', icon: Shield, section: 'finma514', highlight: true },
    ],
  },
  // ▾ FinMA PRO (Kilitli Bölüm)
  {
    category: '▾ FinMA PRO',
    categoryColor: 'text-blue-500/80',
    items: [
      { emoji: '👑', label: 'Bugünün AI Fırsatları', href: '/featured', icon: Crown, section: 'featured', tier: 'pro', badge: 'lock' },
      { emoji: '🏢', label: 'Sektör Liderleri', href: '/sectors', icon: BarChart3, section: 'sectors', tier: 'pro', badge: 'lock' },
      { emoji: '🤖', label: 'Akıllı Hisse Takip', href: '/tracking', icon: Bot, section: 'tracking', tier: 'pro+', badge: 'lock' },
    ],
  },
]


const tierBadge: Record<Tier, { label: string; color: string; icon: React.ElementType }> = {
  free: { label: 'Free', color: 'text-finma-text-dim bg-white/5 border-white/10', icon: Activity },
  pro: { label: 'Pro', color: 'text-finma-primary bg-finma-primary/10 border-finma-primary/30', icon: Crown },
  'pro+': { label: 'Pro+', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', icon: Star },
  admin: { label: 'Admin', color: 'text-finma-green bg-finma-green/10 border-finma-green/30', icon: Shield },
}

const tierColors: Record<string, string> = {
  free: 'text-finma-text-dim',
  pro: 'text-finma-primary',
  'pro+': 'text-amber-500',
  admin: 'text-finma-red',
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const isLandingPage = pathname === '/'
  const { sidebarOpen, setSidebarOpen, mobileMenuOpen, setMobileMenuOpen } = useTerminalStore()
  const { user, logout } = useAuthStore()
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['0', '1', '2'])

  const isExpanded = sidebarOpen || mobileMenuOpen

  const userTier = (user?.subscription_tier || 'free') as Tier
  const isAdmin = user?.role === 'admin'

  // Tier access check
  const canAccess = (tier?: Tier): boolean => {
    if (!tier) return true // Free tier
    if (tier === 'admin') return isAdmin
    if (tier === 'pro') return userTier === 'pro' || userTier === 'pro+' || isAdmin
    if (tier === 'pro+') return userTier === 'pro+' || isAdmin
    return false
  }

  const toggleCategory = (categoryIndex: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryIndex) ? prev.filter(i => i !== categoryIndex) : [...prev, categoryIndex]
    )
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [mobileMenuOpen, setMobileMenuOpen])

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-finma-sidebar border-r border-finma-border flex flex-col transition-all duration-300',
          // Mobil: genişlik 288px, yüksek z-index, gölge
          'w-72 z-50 shadow-2xl md:shadow-none',
          // Mobil menü aç/kapat animasyonu + kapalıyken dokunma olaylarını engelle
          mobileMenuOpen
            ? 'translate-x-0 pointer-events-auto'
            : cn(
                '-translate-x-full pointer-events-none',
                'md:translate-x-0 md:pointer-events-auto'
              ),
          // Masaüstü: z-index ve genişlik
          'md:z-40',
          sidebarOpen ? 'md:w-56' : 'md:w-16'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-finma-border">
          <svg width="22" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"
              stroke="#2D7EF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {isExpanded && (
            <div className="ml-2 overflow-hidden flex-1">
              <span className="text-[17px] font-extrabold text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Fin</span>
              <span className="text-[17px] font-extrabold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#2D7EF8' }}>MA</span>
            </div>
          )}
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 text-finma-text-dim hover:text-finma-text rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {navGroups.map((group, gi) => {
            const isCategoryExpanded = expandedCategories.includes(gi.toString())

            return (
              <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
                {/* Category Header — Collapsible */}
                {isExpanded && (
                  <button
                    onClick={() => toggleCategory(gi.toString())}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-1 text-xs font-bold uppercase tracking-widest rounded-md transition-colors hover:bg-white/5"
                  >
                    <span className={cn('truncate', group.categoryColor)}>
                      {group.category}
                    </span>
                    <ChevronDown className={cn(
                      'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                      isCategoryExpanded && 'rotate-180'
                    )} />
                  </button>
                )}

                {/* Category Items — Collapsible Content */}
                {(!isExpanded || isCategoryExpanded) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href
                      const isLocked = !canAccess(item.tier)

                      return (
                        <div key={item.href + item.section}>
                          <Link
                            href={isLocked ? '#' : item.href}
                            onClick={() => {
                              if (!isLocked) setMobileMenuOpen(false)
                            }}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
                              isLocked
                                ? 'text-finma-text-dim/50 cursor-not-allowed hover:text-finma-text-dim/70 hover:bg-white/3'
                                : isActive
                                  ? 'bg-finma-primary/15 text-finma-primary border-l-2 border-finma-primary'
                                  : item.highlight
                                    ? 'text-finma-text-muted hover:text-finma-text hover:bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                                    : 'text-finma-text-muted hover:text-finma-text hover:bg-white/5',
                              !isExpanded && 'justify-center px-0'
                            )}
                            title={!isExpanded ? item.label : undefined}
                          >
                            {/* Icon or Badge */}
                            {isLocked ? (
                              item.badge === 'gem' ? (
                                <span className="text-xl">💎</span>
                              ) : (
                                <Lock className="w-4.5 h-4.5 shrink-0 opacity-50" />
                              )
                            ) : item.emoji ? (
                              <span className="text-base">{item.emoji}</span>
                            ) : (
                              <item.icon className={cn('w-4.5 h-4.5 shrink-0', isActive && 'text-finma-primary')} />
                            )}

                            {/* Label & Badges */}
                            {isExpanded && (
                              <>
                                <span className={cn('flex-1 truncate', isLocked && 'opacity-50')}>{item.label}</span>

                                {/* Tier Badge */}
                                {isLocked && item.tier === 'pro' && (
                                  <span className="text-[8px] font-bold text-finma-primary/60 bg-finma-primary/10 px-1.5 py-0.5 rounded">
                                    🔒 PRO
                                  </span>
                                )}
                                {isLocked && item.tier === 'pro+' && (
                                  <span className="text-[8px] font-bold text-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                    💎 PRO+
                                  </span>
                                )}

                                {/* New Badge */}
                                {!isLocked && item.badge === 'new' && (
                                  <span className="text-[8px] font-bold text-emerald-500/60 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    ⭐ YENI
                                  </span>
                                )}
                              </>
                            )}
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        

        {/* Bottom section */}
        <div className="border-t border-finma-border p-2 space-y-1">
          {/* Auth buttons for unauthenticated users (landing page mobile) */}
          {isExpanded && !user && (
            <div className="px-3 py-2 space-y-2">
              <button
                onClick={() => { setMobileMenuOpen(false); router.push('/login') }}
                className="flex items-center justify-center w-full px-3 py-2.5 text-xs font-medium text-finma-text-dim border border-finma-border rounded-md hover:bg-white/5 transition-colors"
              >
                Giriş Yap
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); router.push('/login?register=true') }}
                className="flex items-center justify-center w-full px-3 py-2.5 text-xs font-semibold text-white bg-finma-primary rounded-md hover:bg-finma-primary/90 transition-colors"
              >
                🚀 Ücretsiz Üye Ol
              </button>
            </div>
          )}

          {isExpanded && user && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-finma-primary/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-finma-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{user.full_name || user.username}</div>
                  <div className="text-[10px] text-finma-text-dim truncate">{user.email}</div>
                </div>
              </div>
              <div className="text-[10px] text-finma-text-dim font-mono mt-1">
                Üyelik: <span className={tierColors[userTier] || 'text-finma-text-dim'}>
                  {tierBadge[userTier]?.label || 'Free'}
                </span>
              </div>
            </div>
          )}

          {isExpanded && (
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-finma-text-dim hover:text-finma-red transition-colors rounded-md hover:bg-finma-red/5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış Yap</span>
            </button>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex items-center justify-center w-full py-2 text-finma-text-dim hover:text-finma-text transition-colors rounded-md hover:bg-white/5"
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Membership Upgrade Banner */}
          {isExpanded && (
            <div className="px-3 pt-2 border-t border-finma-border/20">
              {userTier === 'free' && (
                <Link
                  href="/pricing"
                  className="block w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-semibold py-2 px-2 rounded-md text-center transition-all duration-200 hover:shadow-lg"
                >
                  🚀 Pro'ya Geç
                </Link>
              )}
              {userTier === 'pro' && (
                <Link
                  href="/pricing"
                  className="block w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold py-2 px-2 rounded-md text-center transition-all duration-200 hover:shadow-lg"
                >
                  💎 Pro+'a Yükselt
                </Link>
              )}
              {userTier === 'pro+' && (
                <div className="text-center text-xs text-emerald-500 font-semibold">
                  ✅ Pro+ Üye
                </div>
              )}
            </div>
          )}

          {isExpanded && (
            <div className="text-center pt-1 pb-1 border-t border-finma-border/20">
              <span className="text-[8px] text-finma-text-dim/40">
                Developed by <span className="font-semibold text-finma-text-dim/60">AFK DaSYS</span>
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
