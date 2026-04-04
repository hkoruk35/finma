/**
 * FinMA V6+ Internationalization Configuration
 * next-intl setup for 8 target languages with URL-based locale routing
 *
 * Supported languages:
 * - tr (Türkçe) - Default locale
 * - en (English) - Global fallback
 * - es (Español)
 * - pt-BR (Português do Brasil)
 * - de (Deutsch)
 * - fr (Français)
 * - id (Bahasa Indonesia)
 * - ms (Bahasa Melayu)
 */

export const defaultLocale = 'tr' as const;

export const locales = [
  'tr',
  'en',
  'es',
  'pt-BR',
  'de',
  'fr',
  'id',
  'ms',
] as const;

export type Locale = (typeof locales)[number];

/**
 * Human-readable locale names for language selector UI
 */
export const localeNames: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português',
  de: 'Deutsch',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
};

/**
 * Native language names (in their own language)
 */
export const localeNamesNative: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  de: 'Deutsch',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
};

/**
 * Flag emojis for language selector
 */
export const localeFlags: Record<Locale, string> = {
  tr: '🇹🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  'pt-BR': '🇧🇷',
  de: '🇩🇪',
  fr: '🇫🇷',
  id: '🇮🇩',
  ms: '🇲🇾',
};

/**
 * Supported number formats per locale
 * Used by LocaleFormatter component
 */
export const numberFormats: Record<
  Locale,
  Intl.NumberFormatOptions
> = {
  tr: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  en: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  es: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  'pt-BR': {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  de: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  fr: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  id: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  ms: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
};

/**
 * RTL (Right-to-Left) languages
 * CSS layout should mirror for these locales
 */
export const rtlLocales: Locale[] = [];

// Note: Add 'ar', 'he', 'fa', 'ur' to rtlLocales if adding those languages in future

/**
 * Locale detection order in middleware
 */
export const detectionOrder = [
  'pathname', // /[locale]/path
  'acceptLanguage', // Accept-Language header
  'localStorage', // Saved preference
  'default', // Fallback to defaultLocale
] as const;

/**
 * Map Accept-Language header values to supported locales
 */
export const acceptLanguageMap: Record<string, Locale> = {
  tr: 'tr',
  'tr-TR': 'tr',
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'en-AU': 'en',
  es: 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  'es-AR': 'es',
  pt: 'pt-BR',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-BR',
  de: 'de',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
  fr: 'fr',
  'fr-FR': 'fr',
  'fr-CA': 'fr',
  'fr-BE': 'fr',
  id: 'id',
  'id-ID': 'id',
  ms: 'ms',
  'ms-MY': 'ms',
};

/**
 * Check if a locale is valid
 */
export function isValidLocale(locale: unknown): locale is Locale {
  return typeof locale === 'string' && locales.includes(locale as Locale);
}

/**
 * Get best matching locale from Accept-Language header
 */
export function getLocaleFromAcceptLanguage(
  acceptLanguageHeader: string
): Locale {
  if (!acceptLanguageHeader) return defaultLocale;

  // Parse Accept-Language header: en-US,en;q=0.9,es;q=0.8
  const languages = acceptLanguageHeader
    .split(',')
    .map((lang) => {
      const [code, q = 'q=1'] = lang.trim().split(';');
      const quality = parseFloat(q.replace('q=', ''));
      return { code: code.trim(), quality: isNaN(quality) ? 1 : quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { code } of languages) {
    // Exact match
    if (isValidLocale(acceptLanguageMap[code])) {
      return acceptLanguageMap[code];
    }

    // Prefix match (e.g., 'en' matches 'en-US')
    const prefix = code.split('-')[0];
    for (const [key, locale] of Object.entries(acceptLanguageMap)) {
      if (key.startsWith(prefix) && isValidLocale(locale)) {
        return locale as Locale;
      }
    }
  }

  return defaultLocale;
}

/**
 * Validate and normalize locale
 */
export function normalizeLocale(locale: string): Locale {
  if (isValidLocale(locale)) {
    return locale;
  }

  // Try to map similar locales
  if (locale.startsWith('pt')) return 'pt-BR';
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('de')) return 'de';
  if (locale.startsWith('fr')) return 'fr';
  if (locale.startsWith('tr')) return 'tr';
  if (locale.startsWith('id')) return 'id';
  if (locale.startsWith('ms')) return 'ms';

  return defaultLocale;
}
