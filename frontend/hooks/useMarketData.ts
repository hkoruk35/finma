'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * TopBar ticker strip - endeks/kripto/emtia fiyatları
 * 30sn stale, 60sn refetch
 */
export function useIndices() {
  return useQuery({
    queryKey: ['indices'],
    queryFn: () => api.getIndices(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * Tek hisse detaylı bilgi — anında yüklenir, 15sn'de bir güncellenir
 */
export function useQuote(ticker: string) {
  return useQuery({
    queryKey: ['quote', ticker],
    queryFn: () => api.getQuote(ticker),
    enabled: !!ticker,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (prev: any) => prev,
  })
}

/**
 * Teknik analiz göstergeleri — 20sn'de bir güncellenir
 */
export function useTechnicals(ticker: string) {
  return useQuery({
    queryKey: ['technicals', ticker],
    queryFn: () => api.getTechnicals(ticker),
    enabled: !!ticker,
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (prev: any) => prev,
  })
}

/**
 * Tam hisse analizi (temel + teknik)
 */
export function useFullAnalysis(ticker: string) {
  return useQuery({
    queryKey: ['full-analysis', ticker],
    queryFn: () => api.getFullAnalysis(ticker),
    enabled: !!ticker,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (prev: any) => prev,
  })
}

/**
 * Sektörel performans
 */
export function useSectors(period = '1mo') {
  return useQuery({
    queryKey: ['sectors', period],
    queryFn: () => api.getSectors(period),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/**
 * Piyasa rejimi (Bull/Bear/Cautious + VIX)
 */
export function useRegime() {
  return useQuery({
    queryKey: ['regime'],
    queryFn: () => api.getRegime(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/**
 * Haftalık/Aylık/Yıllık fiyat değişim oranları
 */
export function usePriceChanges(ticker: string) {
  return useQuery({
    queryKey: ['price-changes', ticker],
    queryFn: () => api.getPriceChanges(ticker),
    enabled: !!ticker,
    staleTime: 60_000,
    refetchInterval: 120_000,
    placeholderData: (prev: any) => prev,
  })
}

/**
 * Haber listesi
 */
export function useNews(ticker: string) {
  return useQuery({
    queryKey: ['news', ticker],
    queryFn: () => api.getNews(ticker),
    enabled: !!ticker,
    staleTime: 120_000,
    retry: 1,
  })
}

/**
 * Insider işlemleri
 */
export function useInsider(ticker: string) {
  return useQuery({
    queryKey: ['insider', ticker],
    queryFn: () => api.getInsider(ticker),
    enabled: !!ticker,
    staleTime: 120_000,
    retry: 1,
  })
}

/**
 * Bilanço takvimi
 */
export function useEarnings(ticker: string) {
  return useQuery({
    queryKey: ['earnings', ticker],
    queryFn: () => api.getEarnings(ticker),
    enabled: !!ticker,
    staleTime: 120_000,
    retry: 1,
  })
}

/**
 * Aylık/Yıllık fiyat geçmişi (5 yıl)
 */
export function usePriceHistory(ticker: string) {
  return useQuery({
    queryKey: ['price-history', ticker],
    queryFn: () => api.getPriceHistory(ticker),
    enabled: !!ticker,
    staleTime: 300_000,
    retry: 1,
  })
}

/**
 * Kurumsal sahiplik
 */
export function useHolders(ticker: string) {
  return useQuery({
    queryKey: ['holders', ticker],
    queryFn: () => api.getHolders(ticker),
    enabled: !!ticker,
    staleTime: 300_000,
    retry: 1,
  })
}
