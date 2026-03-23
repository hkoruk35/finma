import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';

export type SSEEvent = {
  type: 'PRICE_UPDATE' | 'SIGNAL_CREATED' | 'SYSTEM_ALERT';
  data: any;
  timestamp: number;
};

export function useEventStream() {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const { user } = useAuthStore();
  const userId = user?.id || 'global';

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app';
    const sseUrl = `${apiUrl}/api/events/stream?user_id=${userId}`;

    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent(payload);
      } catch (err) {
        console.error('❌ SSE Parse Error:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('❌ SSE Connection Error:', err);
      eventSource.close();
      // Browser automatically retries EventSource, but we can log it
    };

    return () => {
      eventSource.close();
    };
  }, [userId]);

  return { lastEvent };
}
