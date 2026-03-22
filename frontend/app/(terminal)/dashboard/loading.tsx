import React from 'react';
import { Card } from '@/components/shared/Card';

export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* HUD Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-finma-card/40 rounded-lg border border-finma-border/30" />
        ))}
      </div>

      {/* AI Brain Skeleton */}
      <Card padding="sm">
        <div className="h-6 w-48 bg-finma-border/50 rounded-md mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-finma-bg rounded-lg border border-finma-border/20" />
          ))}
        </div>
      </Card>

      {/* Hero Chart Skeleton */}
      <div className="h-[320px] bg-finma-card/40 rounded-xl border border-finma-border/40" />

      {/* Grid Sections Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="sm" className="h-[400px]">
          <div className="h-6 w-32 bg-finma-border/50 rounded-md mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-finma-bg rounded-md" />
            ))}
          </div>
        </Card>
        <Card padding="sm" className="h-[400px]">
          <div className="h-6 w-32 bg-finma-border/50 rounded-md mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-finma-bg rounded-md" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
