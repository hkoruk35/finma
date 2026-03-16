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
 * Tek hisse detaylı bilgi
 */
export function useQuote(ticker: string) {
  return useQuery({
    queryKey: ['quote', ticker],
    queryFn: () => api.getQuote(ticker),
    enabled: !!ticker,
    staleTime: 30_000,
  })
}

/**
 * Teknik analiz göstergeleri (RSI, EMA, MACD, Bollinger, ADX, ATR)
 */
export function useTechnicals(ticker: string) {
  return useQuery({
    queryKey: ['technicals', ticker],
    queryFn: () => api.getTechnicals(ticker),
    enabled: !!ticker,
    staleTime: 60_000,
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
    staleTime: 60_000,
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
