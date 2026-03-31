'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLanguage } from '@/lib/language-detector';

interface TranslationCache {
  [lang: string]: {
    [key: string]: string;
  };
}

const translationCache: TranslationCache = {};

/**
 * useTranslation hook for dynamic AI-powered translation.
 * 
 * Usage:
 * const { t } = useTranslation();
 * <span>{t('Dün Gece Neler Oldu?')}</span>
 */
export function useTranslation() {
  const [lang, setLang] = useState<string>('tr');
  const [refresh, setRefresh] = useState(0);

  // Sync with global language state
  useEffect(() => {
    const currentLang = getLanguage();
    setLang(currentLang);

    const handleLangChange = (e: any) => {
      setLang(e.detail.lang);
      setRefresh(prev => prev + 1);
    };

    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  /**
   * Translate a single string or return from cache
   */
  const t = useCallback((text: string, context: string = 'ui'): string => {
    if (!text || lang === 'tr') return text;

    // Check cache
    if (translationCache[lang] && translationCache[lang][text]) {
      return translationCache[lang][text];
    }

    // Trigger async translation (will update component once finished)
    // For now, we return translated if exists, or fetch once
    fetchTranslation(text, lang, context).then(result => {
      if (result && result !== text) {
        if (!translationCache[lang]) translationCache[lang] = {};
        translationCache[lang][text] = result;
        setRefresh(prev => prev + 1); // Re-render once translated
      }
    });

    return translationCache[lang]?.[text] || text;
  }, [lang]);

  return { t, lang };
}

/**
 * useTranslationMap translates a whole object or array of strings.
 * Perfect for menus and navigation items.
 */
export function useTranslationMap<T extends Record<string, any>>(
  data: T[],
  labelKey: keyof T = 'label' as keyof T
) {
  const { lang } = useTranslation();
  const [translatedData, setTranslatedData] = useState<T[]>(data);

  useEffect(() => {
    if (lang === 'tr') {
      setTranslatedData(data);
      return;
    }

    const labels = data.map(item => item[labelKey] as string);
    
    // Batch fetch (POST /api/v1/translation/batch)
    fetchBatchTranslation(labels, lang).then(results => {
      if (results && results.length === data.length) {
        const newData = data.map((item, idx) => ({
          ...item,
          [labelKey]: results[idx]
        }));
        setTranslatedData(newData);
      }
    });
  }, [lang, data, labelKey]);

  return translatedData;
}

// --- Internal Helpers ---

async function fetchTranslation(text: string, targetLang: string, context: string): Promise<string> {
  try {
    const res = await fetch(`/api/v1/translation/translate?text=${encodeURIComponent(text)}&target_lang=${targetLang}&context=${context}`);
    const data = await res.json();
    return data.translated || text;
  } catch (err) {
    return text;
  }
}

async function fetchBatchTranslation(texts: string[], targetLang: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/v1/translation/batch?target_lang=${targetLang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts })
    });
    const data = await res.json();
    return data.translations || texts;
  } catch (err) {
    return texts;
  }
}
