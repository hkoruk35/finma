'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const trackVisitor = async () => {
      try {
        await fetch('/api/admin/visitors/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: pathname }),
        });
      } catch (err) {
        // Silently fail - tracking errors shouldn't break the app
      }
    };

    trackVisitor();
  }, [pathname]);

  return null;
}
