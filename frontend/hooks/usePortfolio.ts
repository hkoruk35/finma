'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Portföy özeti (NAV, PnL, nakit, marj)
 */
export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => api.getPortfolioSummary(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * Trade listesi
 */
export function useTrades(status?: string) {
  return useQuery({
    queryKey: ['trades', status],
    queryFn: () => api.getTrades(status),
    staleTime: 30_000,
  })
}

/**
 * Yeni trade oluştur
 */
export function useCreateTrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (trade: {
      ticker: string; direction: string; entry_price: number;
      stop_loss: number; target_price: number; qty: number;
      type?: string; strategy?: string; notes?: string;
    }) => api.createTrade(trade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}

/**
 * Trade kapat
 */
export function useCloseTrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tradeId, exitPrice }: { tradeId: string; exitPrice: number }) =>
      api.closeTrade(tradeId, exitPrice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}
