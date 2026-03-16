'use client'

import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function Card({ children, className, hover = false, padding = 'md', onClick }: CardProps) {
  const paddings = { none: 'p-0', sm: 'p-2 md:p-3', md: 'p-3 md:p-4', lg: 'p-4 md:p-5' }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-finma-card border border-finma-border rounded-lg',
        paddings[padding],
        hover && 'transition-colors duration-200 hover:bg-finma-card-hover hover:border-finma-border-light cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
