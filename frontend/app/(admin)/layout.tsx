'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Shield, Users, Bot, Ticket, LayoutDashboard,
  ArrowLeft, Activity, Menu, X
} from 'lucide-react'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
  { href: '/admin/bots', label: 'Botlar', icon: Bot },
  { href: '/admin/invites', label: 'Davet Kodları', icon: Ticket },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      window.location.href = '/dashboard'
    }
  }, [user, isLoading])

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-finma-bg flex items-center justify-center">
        <div className="animate-pulse text-finma-text-dim text-sm">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-finma-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-56 bg-finma-card border-r border-finma-border z-50 flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Brand */}
        <div className="p-4 border-b border-finma-border">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-finma-primary" />
            <div>
              <span className="text-sm font-bold text-white">Fin</span>
              <span className="text-sm font-bold text-finma-primary">MA</span>
              <span className="text-xs text-finma-text-dim ml-1.5">Admin</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'bg-finma-primary/15 text-finma-primary'
                    : 'text-finma-text-muted hover:text-finma-text hover:bg-finma-bg/50'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-finma-border">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-finma-text-muted hover:text-finma-text hover:bg-finma-bg/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Terminale Dön
          </Link>
          <div className="mt-2 px-3 text-[10px] text-finma-text-dim">
            {user.email}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="md:pl-56">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-finma-card/80 backdrop-blur-md border-b border-finma-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-finma-text-dim hover:text-finma-text"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Activity className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-white">Admin Panel</span>
        </header>

        {/* Content */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
