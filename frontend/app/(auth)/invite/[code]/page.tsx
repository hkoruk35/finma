'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import { Crown, CheckCircle, XCircle, Loader2, Activity } from 'lucide-react'

export default function InvitePage() {
  const params = useParams()
  const code = params.code as string
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'needs_login'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated || !user) {
      // Store code and redirect to login
      sessionStorage.setItem('pending_invite_code', code)
      setStatus('needs_login')
      setTimeout(() => {
        window.location.href = `/login?redirect=/invite/${code}`
      }, 2000)
      return
    }

    // Already Pro or Admin
    if (user.subscription_tier === 'pro' || user.role === 'admin') {
      setStatus('success')
      setError('Zaten Pro üyesiniz!')
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
      return
    }

    // Redeem the code
    redeemCode()
  }, [authLoading, isAuthenticated, user, code])

  const redeemCode = async () => {
    try {
      await api.redeemInvite(code)
      setStatus('success')
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2500)
    } catch (err: any) {
      setStatus('error')
      setError(err.message || 'Davet kodu geçersiz veya kullanılmış')
    }
  }

  return (
    <div className="min-h-screen bg-finma-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-8 h-8 text-finma-primary" />
          <div>
            <span className="text-2xl font-bold text-white">Fin</span>
            <span className="text-2xl font-bold text-finma-primary">MA</span>
          </div>
        </div>

        <div className="bg-finma-card border border-finma-border rounded-xl p-8">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">Davet Kodu Doğrulanıyor</h2>
              <p className="text-xs text-finma-text-dim">
                Kod: <span className="font-mono font-bold tracking-wider text-finma-primary">{code}</span>
              </p>
            </>
          )}

          {status === 'needs_login' && (
            <>
              <Crown className="w-12 h-12 text-finma-primary mx-auto mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">Giriş Yapmanız Gerekiyor</h2>
              <p className="text-xs text-finma-text-dim mb-4">
                Davet kodunu kullanmak için önce giriş yapmanız gerekiyor. Yönlendiriliyorsunuz...
              </p>
              <Loader2 className="w-5 h-5 text-finma-primary animate-spin mx-auto" />
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-finma-primary/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-finma-primary" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">
                {error || 'Pro Üyelik Aktif!'}
              </h2>
              <p className="text-xs text-finma-text-dim mb-4">
                Tüm Pro özelliklere erişebilirsiniz. Dashboard'a yönlendiriliyorsunuz...
              </p>
              <Loader2 className="w-5 h-5 text-finma-green animate-spin mx-auto" />
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-finma-red/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-finma-red" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Hata</h2>
              <p className="text-xs text-finma-red mb-4">{error}</p>
              <a
                href="/dashboard"
                className="finma-btn-primary inline-block text-xs py-2 px-4"
              >
                Dashboard'a Git
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
