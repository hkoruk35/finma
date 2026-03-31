'use client';

/**
 * Language Selector Component
 * Minimal header dropdown showing 43 languages
 *
 * Features:
 * - Fetches language list from API
 * - Dropdown menu
 * - localStorage persistence
 * - Browser detection fallback
 */

import { useState, useEffect } from 'react';
import { getLanguage, setLanguage, isRTL } from '@/lib/language-detector';

interface LanguageOption {
  flag: string;
  name: string;
  direction: 'ltr' | 'rtl';
}

export function LanguageSelector() {
  const [currentLang, setCurrentLang] = useState<string>('tr');
  const [languages, setLanguages] = useState<Record<string, LanguageOption>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load available languages from API
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch('/api/v1/translation/languages');
        const data = await response.json();
        setLanguages(data);
        console.log(`✅ Loaded ${Object.keys(data).length} languages`);
      } catch (error) {
        console.error('Failed to load languages:', error);
        // Fallback to all 43 languages
        setLanguages({
          tr: { flag: '🇹🇷', name: 'Türkçe', direction: 'ltr' },
          en: { flag: '🇬🇧', name: 'English', direction: 'ltr' },
          es: { flag: '🇪🇸', name: 'Español', direction: 'ltr' },
          pt: { flag: '🇧🇷', name: 'Português', direction: 'ltr' },
          ar: { flag: '🇸🇦', name: 'العربية', direction: 'rtl' },
          id: { flag: '🇮🇩', name: 'Bahasa Indonesia', direction: 'ltr' },
          ja: { flag: '🇯🇵', name: '日本語', direction: 'ltr' },
          de: { flag: '🇩🇪', name: 'Deutsch', direction: 'ltr' },
          fr: { flag: '🇫🇷', name: 'Français', direction: 'ltr' },
          it: { flag: '🇮🇹', name: 'Italiano', direction: 'ltr' },
          nl: { flag: '🇳🇱', name: 'Nederlands', direction: 'ltr' },
          pl: { flag: '🇵🇱', name: 'Polski', direction: 'ltr' },
          ru: { flag: '🇷🇺', name: 'Русский', direction: 'ltr' },
          ko: { flag: '🇰🇷', name: '한국어', direction: 'ltr' },
          zh: { flag: '🇨🇳', name: '简体中文', direction: 'ltr' },
          vi: { flag: '🇻🇳', name: 'Tiếng Việt', direction: 'ltr' },
          th: { flag: '🇹🇭', name: 'ไทย', direction: 'ltr' },
          hi: { flag: '🇮🇳', name: 'हिन्दी', direction: 'ltr' },
          ur: { flag: '🇵🇰', name: 'اردو', direction: 'rtl' },
          fa: { flag: '🇮🇷', name: 'فارسی', direction: 'rtl' },
          he: { flag: '🇮🇱', name: 'עברית', direction: 'rtl' },
          uk: { flag: '🇺🇦', name: 'Українська', direction: 'ltr' },
          sv: { flag: '🇸🇪', name: 'Svenska', direction: 'ltr' },
          no: { flag: '🇳🇴', name: 'Norsk', direction: 'ltr' },
          da: { flag: '🇩🇰', name: 'Dansk', direction: 'ltr' },
          fi: { flag: '🇫🇮', name: 'Suomi', direction: 'ltr' },
          cs: { flag: '🇨🇿', name: 'Čeština', direction: 'ltr' },
          hu: { flag: '🇭🇺', name: 'Magyar', direction: 'ltr' },
          ro: { flag: '🇷🇴', name: 'Română', direction: 'ltr' },
          bg: { flag: '🇧🇬', name: 'Български', direction: 'ltr' },
          hr: { flag: '🇭🇷', name: 'Hrvatski', direction: 'ltr' },
          sr: { flag: '🇷🇸', name: 'Српski', direction: 'ltr' },
          sk: { flag: '🇸🇰', name: 'Slovenčina', direction: 'ltr' },
          sl: { flag: '🇸🇮', name: 'Slovenščina', direction: 'ltr' },
          et: { flag: '🇪🇪', name: 'Eesti', direction: 'ltr' },
          lt: { flag: '🇱🇹', name: 'Lietuvių', direction: 'ltr' },
          lv: { flag: '🇱🇻', name: 'Latviešu', direction: 'ltr' },
          mk: { flag: '🇲🇰', name: 'Македонски', direction: 'ltr' },
          sq: { flag: '🇦🇱', name: 'Shqip', direction: 'ltr' },
          el: { flag: '🇬🇷', name: 'Ελληνικά', direction: 'ltr' },
          is: { flag: '🇮🇸', name: 'Íslenska', direction: 'ltr' },
          ga: { flag: '🇮🇪', name: 'Gaeilge', direction: 'ltr' },
          cy: { flag: '🇬🇧', name: 'Cymraeg', direction: 'ltr' },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  // Initialize language on mount
  useEffect(() => {
    const detected = getLanguage();
    setCurrentLang(detected);

    // Apply text direction to HTML
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL(detected) ? 'rtl' : 'ltr';
      document.documentElement.lang = detected;
    }
  }, []);

  // Handle language change
  const handleLanguageChange = (lang: string) => {
    setCurrentLang(lang);
    setLanguage(lang);
    setOpen(false);

    // Update HTML
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }

    // Emit event for other components to listen
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { lang } }));

    console.log(`🌐 Language changed to: ${lang}`);
  };

  const current = languages[currentLang];

  if (loading) {
    return (
      <button className="px-3 py-1.5 text-sm text-gray-400">
        🌐 ...
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white transition rounded-lg hover:bg-gray-800"
        title="Change language"
      >
        <span className="text-lg">{current?.flag || '🌐'}</span>
        <span className="hidden sm:inline">{currentLang.toUpperCase()}</span>
        <svg
          className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <>
          {/* Backdrop (mobile) */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div
            className={`absolute top-full ${
              isRTL(currentLang) ? 'left-0' : 'right-0'
            } mt-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden`}
          >
            {/* Scrollable container */}
            <div className="max-h-96 overflow-y-auto">
              {Object.entries(languages)
                .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                .map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => handleLanguageChange(code)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-3 ${
                      currentLang === code
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">{lang.flag}</span>
                    <span className="flex-1">{lang.name}</span>
                    {currentLang === code && (
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
            </div>

            {/* Footer info */}
            <div className="border-t border-gray-700 px-4 py-2 bg-gray-800/50 text-xs text-gray-400">
              {Object.keys(languages).length} languages available
            </div>
          </div>
        </>
      )}
    </div>
  );
}
