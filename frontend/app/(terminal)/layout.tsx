'use client'

import { Sidebar } from '@/components/terminal/Sidebar'
import { TopBar } from '@/components/terminal/TopBar'
import { LegalFooter } from '@/components/terminal/LegalFooter'
import { useTerminalStore } from '@/store/terminal'
import { cn } from '@/lib/utils'

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sidebarOpen } = useTerminalStore()

  return (
    <div className="min-h-screen bg-finma-bg">
      <Sidebar />
      <TopBar />
      <main
        className={cn(
          'pt-14 min-h-screen transition-all duration-300 flex flex-col',
          sidebarOpen ? 'pl-56' : 'pl-16'
        )}
      >
        <div className="p-4 flex-1">
          {children}
        </div>
        <LegalFooter />
      </main>
    </div>
  )
}
