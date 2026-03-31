'use client'

import { Shield } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'

export function LegalFooter() {
  const { t } = useTranslation()

  return (
    <footer className="mt-8 border-t border-finma-border/30 pt-6 pb-12">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <p className="text-[11px] leading-relaxed text-finma-text-dim/60 font-medium">
          {t('FinMA yapay zeka destekli piyasa analiz platformudur. Sunulan içerikler yalnızca bilgilendirme amaçlıdır; yatırım tavsiyesi niteliği taşımaz. Nihai karar kullanıcıya aittir.')}
          <br className="my-2" />
          © 2026 FinMA NY/USA — Powered by <span className="text-finma-text-dim/80">AFK DaSYS</span>
        </p>
      </div>
    </footer>
  )
}
