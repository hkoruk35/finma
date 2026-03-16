'use client'

import { useTerminalStore } from '@/store/terminal'
import { MarketTicker } from './MarketTicker'
import { Bell, Search, User, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TopBar() {
  const { sidebarOpen, setMobileMenuOpen } = useTerminalStore()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-14 bg-finma-bg/95 backdrop-blur-sm border-b border-finma-border z-30 flex items-center transition-all duration-300',
        // Mobilde: full-width (left-0), sidebar overlay olduğu için padding yok
        'left-0',
        // Masaüstünde: sidebar genişliğine göre offset
        sidebarOpen ? 'md:left-56' : 'md:left-16'
      )}
    >
      {/* Hamburger — sadece mobilde */}
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

      {/* Right section: clocks + actions */}
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
        <button className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-finma-text-dim hover:text-finma-text transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-finma-red rounded-full" />
        </button>
        <button className="p-1.5 rounded-full bg-finma-primary/20 text-finma-primary hover:bg-finma-primary/30 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
          <User className="w-4 h-4" />
        </button>
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
  const now = new Date()
  try {
    const time = now.toLocaleTimeString('tr-TR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return <>{time}</>
  } catch {
    return <>--:--</>
  }
}
