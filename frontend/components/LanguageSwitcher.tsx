'use client'

import { useState, useEffect } from 'react'
import { getLanguage, setLanguage } from '@/lib/language-detector'
import { ChevronDown } from 'lucide-react'

const LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
]

export function LanguageSwitcher() {
  const [currentLang, setCurrentLangState] = useState<string>('tr')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const detected = getLanguage()
    setCurrentLangState(detected)
  }, [])

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode)
    setCurrentLangState(langCode)
    setIsOpen(false)
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { lang: langCode } }))
  }

  const currentLanguage = LANGUAGES.find(l => l.code === currentLang)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-finma-bg border border-finma-border rounded-lg hover:border-finma-primary transition"
        >
          <span className="text-xl">{currentLanguage?.flag || '🌐'}</span>
          <span className="text-sm font-medium text-finma-text">{currentLang.toUpperCase()}</span>
          <ChevronDown className={`w-4 h-4 text-finma-text-dim transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full right-0 mb-2 bg-finma-bg border border-finma-border rounded-lg shadow-lg overflow-hidden min-w-[180px]">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-4 py-2 flex items-center gap-2 transition ${
                  currentLang === lang.code
                    ? 'bg-finma-primary/20 text-finma-primary'
                    : 'text-finma-text hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm">{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
