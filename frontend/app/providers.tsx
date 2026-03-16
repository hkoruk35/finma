'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { Activity } from 'lucide-react'

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { initialize, isLoading, refreshUser } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Periodic refresh every 5 minutes (trial expiry check)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUser()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshUser])

  // Listen for trial-expired event from API client
  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('trial-expired', handler)
    return () => window.removeEventListener('trial-expired', handler)
  }, [refreshUser])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-finma-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-finma-primary animate-pulse" />
          <div className="text-sm text-finma-text-dim">Yükleniyor...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchInterval: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        {children}
      </AuthInitializer>
    </QueryClientProvider>
  )
}
