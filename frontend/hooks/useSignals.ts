'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * En son bot sinyal raporu (tüm adaylar)
 */
export function useLatestSignals() {
  return useQuery({
    queryKey: ['signals-latest'],
    queryFn: () => api.getLatestSignals(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/**
 * Öne çıkan top N sinyal (Featured sayfası)
 */
export function useFeaturedSignals(limit = 5) {
  return useQuery({
    queryKey: ['signals-featured', limit],
    queryFn: () => api.getFeaturedSignals(limit),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/**
 * Filtrelenmiş sinyal adayları
 */
export function useCandidates(params?: {
  sector?: string; action?: string; min_score?: number; limit?: number
}) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: () => api.getCandidates(params),
    staleTime: 60_000,
  })
}

/**
 * Bot çalışma durumları
 */
export function useBotStatus() {
  return useQuery({
    queryKey: ['bot-status'],
    queryFn: () => api.getBotStatus(),
    staleTime: 30_000,
  })
}
