'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { FinmaLang } from '@/types/finma514'

/**
 * Günlük 54 hisse listesi
 */
export function useFinma514Insights(lang: FinmaLang = 'tr', date?: string) {
  return useQuery({
    queryKey: ['finma514-insights', lang, date],
    queryFn:  () => api.getFinma514Insights(lang, date),
    staleTime: 5 * 60_000,
    // Veri yoksa 30sn'de bir dene, veri varsa 10 dk'da bir kontrol et
    refetchInterval: (query) =>
      !query.state.data || (query.state.data as any)?.stocks?.length === 0
        ? 30_000
        : 10 * 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    refetchOnWindowFocus: true,
  })
}

/**
 * Tek hisse detayı + AI metin
 */
export function useFinma514Stock(ticker: string, lang: FinmaLang = 'tr', date?: string) {
  return useQuery({
    queryKey: ['finma514-stock', ticker, lang, date],
    queryFn:  () => api.getFinma514Stock(ticker, lang, date),
    staleTime: 5 * 60_000,
    enabled: !!ticker,
    retry: 2,
  })
}

/**
 * Kategori bazlı liste
 */
export function useFinma514Categories(lang: FinmaLang = 'tr', date?: string) {
  return useQuery({
    queryKey: ['finma514-categories', lang, date],
    queryFn:  () => api.getFinma514Categories(lang, date),
    staleTime: 5 * 60_000,
    retry: 2,
  })
}

/**
 * Bot çalışma durumu
 */
export function useFinma514Status() {
  return useQuery({
    queryKey: ['finma514-status'],
    queryFn:  () => api.getFinma514Status(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
