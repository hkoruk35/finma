'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'

export interface IntelligenceReport {
  regime: string
  regime_tr: string
  vix: number
  spy_price: number
  spy_ema20: number
  sector_rotation: string
  sector_leaders: string
  money_flow: string
  money_flow_details: Array<{
    label: string
    value: string
    color: string
  }>
  daily_summary: string[]
  economic_calendar: Array<{
    time: string
    event: string
    hot: boolean
  }>
  ai_analysis: string[]
  technical_levels: Array<[string, string, string, string]>
  created_at?: string
}

export function useIntelligence() {
  const [data, setData] = useState<IntelligenceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchIntelligence() {
      try {
        setLoading(true)
        const response = await api.getIntelligence()
        if (response && response.payload) {
          setData({
            ...response.payload,
            created_at: response.created_at
          })
        }
      } catch (err: any) {
        console.error('Failed to fetch intelligence:', err)
        setError(err.message || 'Haberleşme hatası')
      } finally {
        setLoading(false)
      }
    }

    fetchIntelligence()
    const interval = setInterval(fetchIntelligence, 1000 * 60 * 5)
    return () => clearInterval(interval)
  }, [])

  return { data, loading, error }
}
