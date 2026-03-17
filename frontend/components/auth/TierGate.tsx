'use client'

import { useAuthStore } from '@/store/auth'
import { UpgradePrompt } from './UpgradePrompt'
import { TrialExpiredPrompt } from './TrialExpiredPrompt'

interface TierGateProps {
  tier: 'pro' | 'admin'
  children: React.ReactNode
}

export function TierGate({ tier, children }: TierGateProps) {
  const { canAccess, isTrialExpired } = useAuthStore()

  if (!canAccess(tier)) {
    return <UpgradePrompt requiredTier={tier} />
  }

  if (isTrialExpired()) {
    return <TrialExpiredPrompt />
  }

  return <>{children}</>
}
