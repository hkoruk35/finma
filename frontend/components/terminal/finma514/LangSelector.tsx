'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LANG_OPTIONS } from '@/types/finma514'
import type { FinmaLang } from '@/types/finma514'

interface LangSelectorProps {
  value: FinmaLang
  onChange: (lang: FinmaLang) => void
}

export function LangSelector({ value, onChange }: LangSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANG_OPTIONS.find(l => l.code === value) ?? LANG_OPTIONS[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-finma-card border border-finma-border
                   text-xs text-finma-text hover:border-finma-border-light transition-colors"
      >
        <Globe2 className="w-3.5 h-3.5 text-finma-text-dim" />
        <span>{current.flag} {current.label}</span>
        <ChevronDown className={cn('w-3 h-3 text-finma-text-dim transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-finma-card border border-finma-border
                        rounded-lg shadow-xl overflow-hidden min-w-[140px] animate-fade-in">
          {LANG_OPTIONS.map(lang => (
            <button
              key={lang.code}
              onClick={() => { onChange(lang.code); setOpen(false) }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left',
                lang.code === value
                  ? 'bg-finma-primary/15 text-finma-primary'
                  : 'text-finma-text hover:bg-white/5'
              )}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
