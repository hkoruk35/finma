'use client'

import { create } from 'zustand'
import { api } from '@/lib/api-client'

export interface User {
  id: string
  username: string
  email: string
  role: string
  subscription_tier: string
  full_name?: string
  trial_start_date?: string
  created_at?: string
}

const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  pro: 1,
  admin: 2,
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean

  login: (token: string, user: User) => void
  logout: () => void
  initialize: () => Promise<void>
  refreshUser: () => Promise<void>
  isTrialExpired: () => boolean
  canAccess: (tier: 'free' | 'pro' | 'admin') => boolean
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: (token: string, user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finma_token', token)
      setCookie('finma_token', token, 30) // 30 days — kullanıcı oturumu kalıcı
    }
    set({ user, token, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finma_token')
      deleteCookie('finma_token')
      window.location.href = '/login'
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false })
  },

  initialize: async () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false })
      return
    }

    const token = localStorage.getItem('finma_token')
    if (!token) {
      set({ isLoading: false })
      return
    }

    try {
      const user = await api.getMe() as User
      set({ user, token, isAuthenticated: true, isLoading: false })
      // Her girişte çerezi 30 gün uzat
      setCookie('finma_token', token, 30)
    } catch (err: any) {
      // Yalnızca gerçek auth hatası (401) durumunda oturumu kapat
      // Ağ hatası / timeout / backend kapalı ise oturumu KAPATMA
      const isAuthError =
        err?.message?.includes('Oturum süresi') ||
        err?.message?.includes('401') ||
        err?.message?.includes('unauthorized') ||
        err?.message?.includes('Unauthorized')

      if (isAuthError) {
        localStorage.removeItem('finma_token')
        deleteCookie('finma_token')
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      } else {
        // Network error or backend down - keep the token and state as is
        // We'll retry later or let other requests handle it
        setCookie('finma_token', token, 30) // Ensure cookie exists for next load
        set({ token, isAuthenticated: true, isLoading: false })
        console.error('Initialization error (non-auth):', err)
      }
    }
  },

  refreshUser: async () => {
    try {
      const user = await api.getMe() as User
      set({ user })
    } catch (err: any) {
      // SADECE 401 hatasında oturumu kapat — ağ hatalarında kullanıcıyı SİSTEMDEN ATMA
      const isAuthError = 
        err?.message?.includes('401') || 
        err?.message?.includes('unauthorized') || 
        err?.message?.includes('Unauthorized') ||
        err?.message?.includes('Oturum süresi')
        
      if (isAuthError) {
        get().logout()
      } else {
        console.warn('User refresh failed (non-auth):', err)
      }
    }
  },

  isTrialExpired: () => {
    const { user } = get()
    if (!user || user.subscription_tier !== 'pro' || !user.trial_start_date) return false
    const trialStart = new Date(user.trial_start_date)
    const trialEnd = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000)
    return new Date() > trialEnd
  },

  canAccess: (tier: 'free' | 'pro' | 'admin') => {
    const { user } = get()
    if (!user) return tier === 'free'
    
    // Legacy support: premium/gold -> pro
    let currentTier = (user.subscription_tier || user.role || 'free').toLowerCase()
    if (currentTier === 'premium' || currentTier === 'gold') currentTier = 'pro'
    
    const userLevel = TIER_HIERARCHY[currentTier] ?? 0
    const requiredLevel = TIER_HIERARCHY[tier] ?? 0
    return userLevel >= requiredLevel
  },
}))
