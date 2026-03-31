/**
 * Browser Language Detection & User Language Preference
 *
 * Flow:
 * 1. Check localStorage for saved language preference
 * 2. If not found, detect browser language
 * 3. If unsupported, fallback to 'tr' (Turkish)
 * 4. Save preference to localStorage
 */

export const SUPPORTED_LANGUAGES = [
  'tr', 'en', 'es', 'pt', 'ar', 'id', 'ja',
  'de', 'fr', 'it', 'nl', 'pl', 'ru', 'ko',
  'zh', 'vi', 'th', 'hi', 'ur', 'fa', 'he',
  'uk', 'sv', 'no', 'da', 'fi', 'cs', 'hu',
  'ro', 'bg', 'hr', 'sr', 'sk', 'sl', 'et',
  'lt', 'lv', 'mk', 'sq', 'el', 'is', 'ga', 'cy'
];

const STORAGE_KEY = 'finma_language';

/**
 * Detect browser language and return supported language code
 */
export function detectBrowserLanguage(): string {
  // 1. Check localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      console.log(`✅ Using saved language: ${saved}`);
      return saved;
    }
  } catch (e) {
    console.warn('localStorage unavailable (SSR context)');
  }

  // 2. Detect from navigator.language or navigator.languages
  if (typeof navigator !== 'undefined') {
    let browserLangs: string[] = [];

    // Try navigator.languages (most reliable)
    if (navigator.languages && navigator.languages.length > 0) {
      browserLangs = navigator.languages.map((lang) =>
        lang.split('-')[0].toLowerCase()
      );
    }
    // Fallback to navigator.language
    else if (navigator.language) {
      browserLangs = [navigator.language.split('-')[0].toLowerCase()];
    }

    // Find first supported language
    for (const lang of browserLangs) {
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        console.log(`🌐 Detected browser language: ${lang}`);
        setLanguage(lang); // Save to localStorage
        return lang;
      }
    }

    console.log(`Browser language(s): ${browserLangs.join(', ')} - not supported`);
  }

  // 3. Fallback to Turkish
  console.log('ℹ️ Using fallback language: tr');
  return 'tr';
}

/**
 * Save language preference to localStorage
 */
export function setLanguage(lang: string): void {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`Language '${lang}' is not supported`);
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, lang);
    console.log(`💾 Saved language preference: ${lang}`);
  } catch (e) {
    console.warn('localStorage not available');
  }
}

/**
 * Get saved language preference or detect
 */
export function getLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }
  } catch (e) {
    // localStorage unavailable
  }

  return detectBrowserLanguage();
}

/**
 * Clear language preference (reset to browser detection)
 */
export function clearLanguagePreference(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Language preference cleared');
  } catch (e) {
    console.warn('localStorage not available');
  }
}

/**
 * Check if language is RTL (right-to-left)
 */
export function isRTL(lang: string): boolean {
  const rtlLangs = ['ar', 'ur', 'fa', 'he'];
  return rtlLangs.includes(lang);
}
