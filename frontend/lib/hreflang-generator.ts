/**
 * SEO Hreflang Tags Generator
 * Automatically generates hreflang alternate links for all 8 language versions
 *
 * Usage in layout.tsx:
 * ```tsx
 * export const generateMetadata = ({ params }: Props) => {
 *   const alternates = generateHreflangAlternates('/dashboard', params.locale);
 *   return {
 *     alternates: {
 *       canonical: alternates.canonical,
 *       languages: alternates.languages,
 *     },
 *   };
 * };
 * ```
 */

import { locales, type Locale } from '@/i18n';

export interface HreflangAlternate {
  hreflang: Locale | 'x-default';
  href: string;
}

export interface HreflangResult {
  canonical: string;
  languages: Record<Locale | 'x-default', string>;
  alternates: HreflangAlternate[];
}

/**
 * Get base URL from environment
 * Falls back to hardcoded domain in production
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    return baseUrl;
  }

  // Production fallback
  if (process.env.NODE_ENV === 'production') {
    return 'https://finmasmart.com';
  }

  // Development fallback
  return 'http://localhost:3001';
}

/**
 * Generate hreflang alternates for all language versions of a page
 *
 * @param pathname - Path without locale prefix (e.g., '/dashboard', '/stock/AAPL')
 * @param currentLocale - Current locale (e.g., 'en')
 * @returns Object with canonical URL, languages map, and alternates array
 *
 * @example
 * ```ts
 * const alternates = generateHreflangAlternates('/stock/AAPL', 'en');
 * // Returns:
 * // {
 * //   canonical: 'https://finmasmart.com/en/stock/AAPL',
 * //   languages: {
 * //     en: 'https://finmasmart.com/en/stock/AAPL',
 * //     es: 'https://finmasmart.com/es/stock/AAPL',
 * //     ...
 * //   },
 * //   alternates: [
 * //     { hreflang: 'en', href: 'https://finmasmart.com/en/stock/AAPL' },
 * //     ...
 * //   ]
 * // }
 * ```
 */
export function generateHreflangAlternates(
  pathname: string,
  currentLocale: Locale
): HreflangResult {
  const baseUrl = getBaseUrl();

  // Ensure pathname starts with /
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;

  // Remove locale prefix if it's already there (shouldn't be, but be safe)
  let cleanPathname = normalizedPathname;
  const localeMatch = normalizedPathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)(?:\/|$)/);
  if (localeMatch && locales.includes(localeMatch[1] as Locale)) {
    cleanPathname = normalizedPathname.replace(localeMatch[0], '') || '/';
  }

  // Generate URL for each locale
  const languageRecord: Record<Locale | 'x-default', string> = {} as any;
  const alternatesArray: HreflangAlternate[] = [];

  // Add each locale
  for (const locale of locales) {
    const url = `${baseUrl}/${locale}${cleanPathname}`;
    languageRecord[locale] = url;
    alternatesArray.push({
      hreflang: locale,
      href: url,
    });
  }

  // Add x-default (fallback for unknown language users)
  const xDefaultUrl = `${baseUrl}/en${cleanPathname}`;
  languageRecord['x-default'] = xDefaultUrl;
  alternatesArray.push({
    hreflang: 'x-default',
    href: xDefaultUrl,
  });

  return {
    canonical: `${baseUrl}/${currentLocale}${cleanPathname}`,
    languages: languageRecord,
    alternates: alternatesArray,
  };
}

/**
 * Generate hreflang metadata object for next/metadata
 * Ready to use in layout.tsx generateMetadata function
 *
 * @example
 * ```tsx
 * export const generateMetadata = ({ params }: Props) => {
 * const hreflang = getHreflangMetadata('/dashboard', params.locale);
 *
 * return {
 *   title: 'Dashboard',
 *   alternates: hreflang,
 * };
 * };
 * ```
 */
export function getHreflangMetadata(
  pathname: string,
  currentLocale: Locale
): {
  canonical: string;
  languages: Record<Locale | 'x-default', string>;
} {
  const { canonical, languages } = generateHreflangAlternates(
    pathname,
    currentLocale
  );

  return {
    canonical,
    languages,
  };
}

/**
 * Generate hreflang link tags as HTML strings
 * Useful if needed for manual meta tag injection
 *
 * @example
 * ```tsx
 * const linkTags = generateHreflangLinkTags('/dashboard', 'en');
 * // Returns HTML string ready to inject
 * ```
 */
export function generateHreflangLinkTags(
  pathname: string,
  currentLocale: Locale
): string {
  const { canonical, languages } = generateHreflangAlternates(
    pathname,
    currentLocale
  );

  let html = `  <link rel="canonical" href="${canonical}" />\n`;

  for (const [hreflang, href] of Object.entries(languages)) {
    html += `  <link rel="alternate" hreflang="${hreflang}" href="${href}" />\n`;
  }

  return html;
}

/**
 * Validate that all alternate URLs are correct
 * Useful for debugging during development
 */
export function validateHreflangAlternates(
  pathname: string,
  currentLocale: Locale
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { canonical, alternates } = generateHreflangAlternates(
    pathname,
    currentLocale
  );

  // Check canonical
  if (!canonical.startsWith('http')) {
    errors.push(`Invalid canonical URL: ${canonical}`);
  }

  // Check alternates
  for (const alt of alternates) {
    if (!alt.href.startsWith('http')) {
      errors.push(`Invalid alternate URL for ${alt.hreflang}: ${alt.href}`);
    }

    // Verify locale is valid
    if (alt.hreflang !== 'x-default' && !locales.includes(alt.hreflang)) {
      errors.push(`Invalid hreflang value: ${alt.hreflang}`);
    }
  }

  // Verify we have all locales + x-default
  const expectedCount = locales.length + 1; // 8 locales + x-default
  if (alternates.length !== expectedCount) {
    errors.push(
      `Expected ${expectedCount} alternates, got ${alternates.length}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
