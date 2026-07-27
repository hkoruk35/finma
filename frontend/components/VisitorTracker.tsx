'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const trackVisitor = () => {
      try {
        // Use GET with query param - more reliable in serverless
        const img = new Image();
        img.src = `/api/admin/visitors/track?page=${encodeURIComponent(pathname)}`;
      } catch (err) {
        // Silently fail - tracking errors shouldn't break the app
      }
    };

    trackVisitor();
  }, [pathname]);

  return null;
}
