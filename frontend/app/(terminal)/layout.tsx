'use client'

import { Sidebar } from '@/components/terminal/Sidebar'
import { TopBar } from '@/components/terminal/TopBar'
import { LegalFooter } from '@/components/terminal/LegalFooter'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
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
          // Mobilde: sidebar overlay, padding yok
          'pl-0',
          // Masaüstünde: sidebar genişliğine göre padding
          sidebarOpen ? 'md:pl-56' : 'md:pl-16'
        )}
      >
        <div className="p-3 md:p-4 flex-1">
          {children}
        </div>
        <LegalFooter />
      </main>
      <InstallPrompt />
    </div>
  )
}
