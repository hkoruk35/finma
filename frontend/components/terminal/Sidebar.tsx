'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  Radio,
  Briefcase,
  List,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  BarChart3,
  Eye,
  DollarSign,
  LineChart,
  Map,
  ChevronDown,
  Star,
  Search,
  Lock,
  Crown,
  Gem,
  X,
  Shield,
  LogOut,
  User,
  Globe2,
  Newspaper,
  UserCheck,
  History,
  Bot,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal'
import { useAuthStore } from '@/store/auth'
import { useState, useEffect } from 'react'

type Tier = 'free' | 'pro' | 'admin'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  section: string
  tier?: Tier
  children?: { href: string; icon: React.ElementType; label: string }[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Anasayfa', section: 'dashboard' },
  {
    href: '/market', icon: TrendingUp, label: 'Piyasa', section: 'market',
    children: [
      { href: '/market', icon: Eye, label: 'Genel Bakış' },
      { href: '/market/valuation', icon: DollarSign, label: 'Değerleme' },
      { href: '/market/performance', icon: BarChart3, label: 'Performans' },
      { href: '/market/charts', icon: LineChart, label: 'Grafikler' },
      { href: '/market/maps', icon: Map, label: 'Haritalar' },
    ],
  },
  {
    href: '/featured', icon: Star, label: 'Öne Çıkanlar', section: 'featured',
    children: [
      { href: '/featured', icon: Star, label: 'Günlük Seçimler' },
      { href: '/featured/backtest', icon: History, label: 'Backtest' },
    ],
  },
  { href: '/insider', icon: UserCheck, label: 'Insider', section: 'insider' },
  { href: '/news', icon: Newspaper, label: 'Şirket Haberleri', section: 'news' },
  { href: '/world-markets', icon: Globe2, label: 'Dünya Borsaları', section: 'world-markets' },
  { href: '/stock-analysis', icon: Search, label: 'Hisse Analiz', section: 'stock-analysis', tier: 'pro' },
  { href: '/operations', icon: Zap, label: 'İşlemler', section: 'operations', tier: 'pro' },
  { href: '/portfolio', icon: Briefcase, label: 'Portföy', section: 'portfolio', tier: 'pro' },
  { href: '/watchlists', icon: List, label: 'Takip Listeleri', section: 'watchlists', tier: 'pro' },
  { href: '/signals', icon: Radio, label: 'Sinyaller', section: 'signals', tier: 'pro' },
  { href: '/ai', icon: Brain, label: 'AI Analiz', section: 'ai', tier: 'pro' },
  { href: '/settings', icon: Settings, label: 'Ayarlar', section: 'settings' },
]

const tierBadge: Record<Tier, { label: string; color: string; icon: React.ElementType }> = {
  free: { label: 'Free', color: 'text-finma-text-dim bg-white/5 border-white/10', icon: Activity },
  pro: { label: 'Pro', color: 'text-finma-primary bg-finma-primary/10 border-finma-primary/30', icon: Crown },
  admin: { label: 'Admin', color: 'text-finma-green bg-finma-green/10 border-finma-green/30', icon: Shield },
}

const tierColors: Record<string, string> = {
  free: 'text-finma-text-dim',
  pro: 'text-finma-primary',
  admin: 'text-finma-red',
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, mobileMenuOpen, setMobileMenuOpen } = useTerminalStore()
  const { user, canAccess, logout } = useAuthStore()
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['market'])

  const isExpanded = sidebarOpen || mobileMenuOpen

  const userTier = (user?.subscription_tier || 'free') as Tier
  const isAdmin = user?.role === 'admin'

  const toggleMenu = (section: string) => {
    setExpandedMenus(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
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
          'fixed top-0 h-screen bg-finma-sidebar border-r border-finma-border flex flex-col transition-all duration-300',
          'max-md:w-72 max-md:z-50 max-md:shadow-2xl',
          mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
          'md:z-40 md:left-0',
          sidebarOpen ? 'md:w-56' : 'md:w-16'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-finma-border">
          <Activity className="w-6 h-6 text-finma-primary shrink-0" />
          {isExpanded && (
            <div className="ml-2.5 overflow-hidden flex-1">
              <span className="text-lg font-bold text-white tracking-tight">Fin</span>
              <span className="text-lg font-bold text-finma-primary tracking-tight">MA</span>
              <span className="text-[10px] text-finma-text-dim ml-1.5 font-mono">v4.0</span>
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
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            // Hide specific items if necessary (currently all items shown for their respective tiers)

            const isActive = pathname === item.href || (item.children && pathname.startsWith(item.href + '/'))
            const isMenuExpanded = expandedMenus.includes(item.section)
            const hasChildren = item.children && item.children.length > 0
            const badge = item.tier ? tierBadge[item.tier] : null
            // Pro kullanıcılar her zaman erişebilir — isLocked sadece free kullanıcılar için
            const isLocked = item.tier ? !canAccess(item.tier) : false

            return (
              <div key={item.href + item.section}>
                <div className="flex items-center">
                  <Link
                    href={hasChildren && isExpanded ? '#' : item.href}
                    onClick={(e) => {
                      if (hasChildren && isExpanded) {
                        e.preventDefault()
                        toggleMenu(item.section)
                      } else {
                        setMobileMenuOpen(false)
                      }
                    }}
                    className={cn(
                      'flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
                      isLocked
                        ? 'text-finma-text-dim/50 hover:text-finma-text-dim/70 hover:bg-white/3'
                        : isActive
                          ? 'bg-finma-primary/15 text-finma-primary border-l-2 border-finma-primary'
                          : 'text-finma-text-muted hover:text-finma-text hover:bg-white/5',
                      !isExpanded && 'justify-center px-0'
                    )}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {isLocked ? (
                      <Lock className="w-4.5 h-4.5 shrink-0 opacity-50" />
                    ) : (
                      <item.icon className={cn('w-4.5 h-4.5 shrink-0', isActive && 'text-finma-primary')} />
                    )}
                    {isExpanded && (
                      <>
                        <span className={cn('flex-1 truncate', isLocked && 'opacity-50')}>{item.label}</span>
                        {hasChildren && (
                          <ChevronDown className={cn(
                            'w-3.5 h-3.5 transition-transform duration-200',
                            isMenuExpanded && 'rotate-180'
                          )} />
                        )}
                      </>
                    )}
                  </Link>
                </div>

                {hasChildren && isExpanded && isMenuExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-finma-border/40 pl-2">
                    {item.children!.map((child) => {
                      const isChildActive = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all duration-150',
                            isChildActive
                              ? 'text-finma-primary bg-finma-primary/10'
                              : 'text-finma-text-dim hover:text-finma-text hover:bg-white/5'
                          )}
                        >
                          <child.icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

        </nav>
        
        {/* Admin Quick Access */}
        {isAdmin && isExpanded && (
          <div className="px-2 pb-2 mt-2 pt-2 border-t border-finma-border/30">
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-finma-primary/70 uppercase tracking-widest">Yönetim</span>
            </div>
            <Link
              href="/admin/bots"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200',
                pathname.startsWith('/admin/bots')
                  ? 'bg-finma-primary/15 text-finma-primary'
                  : 'text-finma-text-muted hover:text-finma-text hover:bg-white/5'
              )}
            >
              <Bot className="w-4 h-4" />
              <span>Bot Yönetimi</span>
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 mt-0.5',
                pathname === '/admin'
                  ? 'bg-finma-primary/15 text-finma-primary'
                  : 'text-finma-text-muted hover:text-finma-text hover:bg-white/5'
              )}
            >
              <Shield className="w-4 h-4" />
              <span>Yönetim Paneli</span>
            </Link>
          </div>
        )}

        {/* Admin Quick Access Icon-only (Collapsed) */}
        {isAdmin && !isExpanded && (
          <div className="py-2 border-t border-finma-border/30 flex flex-col items-center gap-2">
             <Link href="/admin/bots" className="p-2 text-finma-primary hover:bg-white/5 rounded-md" title="Bot Yönetimi">
               <Bot className="w-4.5 h-4.5" />
             </Link>
          </div>
        )}

        {/* Bottom section */}
        <div className="border-t border-finma-border p-2 space-y-1">
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
                  {userTier === 'admin' ? 'Admin' : tierBadge[userTier]?.label || 'Free'}
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
