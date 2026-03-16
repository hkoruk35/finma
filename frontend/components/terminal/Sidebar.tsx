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
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal'
import { useState } from 'react'

type Tier = 'free' | 'gold' | 'premium'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  section: string
  tier?: Tier // minimum üyelik seviyesi
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
  { href: '/featured', icon: Star, label: 'Öne Çıkanlar', section: 'featured' },
  { href: '/stock-analysis', icon: Search, label: 'Hisse Analiz', section: 'stock-analysis', tier: 'gold' },
  { href: '/operations', icon: Zap, label: 'İşlemler', section: 'operations', tier: 'gold' },
  { href: '/portfolio', icon: Briefcase, label: 'Portföy', section: 'portfolio', tier: 'gold' },
  { href: '/watchlists', icon: List, label: 'Takip Listeleri', section: 'watchlists', tier: 'premium' },
  { href: '/signals', icon: Radio, label: 'Sinyaller', section: 'signals', tier: 'premium' },
  { href: '/ai', icon: Brain, label: 'AI Analiz', section: 'ai', tier: 'gold' },
  { href: '/settings', icon: Settings, label: 'Ayarlar', section: 'settings' },
]

const tierBadge: Record<Tier, { label: string; color: string; icon: React.ElementType }> = {
  free: { label: '', color: '', icon: Activity },
  gold: { label: 'Gold', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' , icon: Crown },
  premium: { label: 'Premium', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30', icon: Gem },
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useTerminalStore()
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['market'])

  const toggleMenu = (section: string) => {
    setExpandedMenus(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-finma-sidebar border-r border-finma-border z-40 flex flex-col transition-all duration-300',
        sidebarOpen ? 'w-56' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-finma-border">
        <Activity className="w-6 h-6 text-finma-primary shrink-0" />
        {sidebarOpen && (
          <div className="ml-2.5 overflow-hidden">
            <span className="text-lg font-bold text-white tracking-tight">Fin</span>
            <span className="text-lg font-bold text-finma-primary tracking-tight">MA</span>
            <span className="text-[10px] text-finma-text-dim ml-1.5 font-mono">v4.0</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.children && pathname.startsWith(item.href + '/'))
            || pathname === item.href
          const isExpanded = expandedMenus.includes(item.section)
          const hasChildren = item.children && item.children.length > 0
          const badge = item.tier ? tierBadge[item.tier] : null

          return (
            <div key={item.href + item.section}>
              {/* Ana menü öğesi */}
              <div className="flex items-center">
                <Link
                  href={hasChildren && sidebarOpen ? '#' : item.href}
                  onClick={hasChildren && sidebarOpen ? (e) => { e.preventDefault(); toggleMenu(item.section) } : undefined}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-finma-primary/15 text-finma-primary border-l-2 border-finma-primary'
                      : 'text-finma-text-muted hover:text-finma-text hover:bg-white/5',
                    !sidebarOpen && 'justify-center px-0'
                  )}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon className={cn('w-4.5 h-4.5 shrink-0', isActive && 'text-finma-primary')} />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge && (
                        <span className={cn(
                          'text-[8px] font-bold px-1.5 py-0.5 rounded border leading-none',
                          badge.color
                        )}>
                          {badge.label}
                        </span>
                      )}
                      {hasChildren && (
                        <ChevronDown className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )} />
                      )}
                    </>
                  )}
                </Link>
              </div>

              {/* Alt menüler */}
              {hasChildren && sidebarOpen && isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-finma-border/40 pl-2">
                  {item.children!.map((child) => {
                    const isChildActive = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
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

      {/* Bottom section */}
      <div className="border-t border-finma-border p-2 space-y-1">
        {sidebarOpen && (
          <div className="px-3 py-2">
            <div className="text-xs text-finma-text-dim">
              <span className="text-finma-green font-mono text-[10px]">●</span> Bağlı
            </div>
            <div className="text-[10px] text-finma-text-dim font-mono mt-0.5">
              Üyelik: <span className="text-yellow-400">Gold</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center w-full py-2 text-finma-text-dim hover:text-finma-text transition-colors rounded-md hover:bg-white/5"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
