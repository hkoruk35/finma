'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface Finma514UpdateEvent {
  event_type:    'FINMA514_UPDATED'
  market_date:   string
  run_timestamp: string
  run_time_ny:   string
  stock_count:   number
  market_regime: string
  vix:           number
}

interface UseFinma514EventsReturn {
  connected:   boolean
  lastEvent:   Finma514UpdateEvent | null
  lastUpdated: Date | null
}

function getEventsUrl(): string {
  if (typeof window === 'undefined') return ''
  const base = window.location.hostname !== 'localhost'
    ? '/api/proxy'
    : (process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app')
  return `${base}/api/events/stream?user_id=global`
}

/**
 * FinMA514 SSE dinleyicisi.
 * FINMA514_UPDATED geldiğinde React Query cache'ini otomatik geçersiz kılar.
 *
 * Kullanım:
 *   const { connected, lastEvent, lastUpdated } = useFinma514Events()
 */
export function useFinma514Events(): UseFinma514EventsReturn {
  const queryClient = useQueryClient()
  const [connected,   setConnected]   = useState(false)
  const [lastEvent,   setLastEvent]   = useState<Finma514UpdateEvent | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const esRef         = useRef<EventSource | null>(null)
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  const connect = useCallback(() => {
    const url = getEventsUrl()
    if (!url) return

    // Mevcut bağlantıyı kapat
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      retryCountRef.current = 0
    }

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'FINMA514_UPDATED') {
          const payload = msg.data as Finma514UpdateEvent
          setLastEvent(payload)
          setLastUpdated(new Date())

          // React Query cache'ini geçersiz kıl → otomatik yeniden fetch
          queryClient.invalidateQueries({ queryKey: ['finma514-insights'] })
          queryClient.invalidateQueries({ queryKey: ['finma514-categories'] })
          queryClient.invalidateQueries({ queryKey: ['finma514-status'] })
          // Stock-level cache: tüm finma514-stock sorgularını geçersiz kıl
          queryClient.invalidateQueries({ queryKey: ['finma514-stock'] })
        }
      } catch (_) {
        // JSON parse hatası — sessizce geç
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      esRef.current = null

      // Üstel geri çekilme ile yeniden bağlan (max 60s)
      const delay = Math.min(5_000 * 2 ** retryCountRef.current, 60_000)
      retryCountRef.current += 1
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [queryClient])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [connect])

  return { connected, lastEvent, lastUpdated }
}
