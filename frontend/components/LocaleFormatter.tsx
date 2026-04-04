/**
 * LocaleFormatter Component
 * Formats numbers, currencies, and dates according to user's locale
 * Uses Intl API for browser-native formatting (no extra libraries needed)
 *
 * Usage:
 * ```tsx
 * <LocaleFormatter value={1250.50} type="currency" locale="tr" />
 * // Turkish: "₺1.250,50"
 *
 * <LocaleFormatter value={1250.50} type="currency" locale="de" />
 * // German: "1.250,50 €"
 *
 * <LocaleFormatter value={0.0542} type="percent" locale="en" />
 * // English: "5.42%"
 *
 * <LocaleFormatter value={new Date()} type="date" locale="es" />
 * // Spanish: "4/3/2026"
 * ```
 */

import React from 'react';
import { Locale, numberFormats } from '@/i18n';

export interface LocaleFormatterProps {
  /**
   * Value to format
   */
  value: number | Date;

  /**
   * Format type
   */
  type: 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'time';

  /**
   * Locale code (e.g., 'en', 'tr', 'de')
   */
  locale: Locale;

  /**
   * Currency code for currency type (e.g., 'USD', 'EUR', 'TRY', 'BRL')
   * Defaults to 'USD' if not provided
   */
  currency?: string;

  /**
   * CSS class for styling
   */
  className?: string;

  /**
   * Additional Intl.NumberFormatOptions for number/currency types
   */
  options?: Intl.NumberFormatOptions;

  /**
   * Additional Intl.DateTimeFormatOptions for date/time types
   */
  dateOptions?: Intl.DateTimeFormatOptions;

  /**
   * If true, component renders as-is without formatting (for fallback)
   */
  asString?: boolean;
}

/**
 * Locale-specific currency symbols
 */
const currencySymbols: Record<Locale, string> = {
  tr: '₺',
  en: '$',
  es: '€',
  'pt-BR': 'R$',
  de: '€',
  fr: '€',
  id: 'Rp',
  ms: 'RM',
};

/**
 * Locale-specific currency codes
 */
const defaultCurrencies: Record<Locale, string> = {
  tr: 'TRY',
  en: 'USD',
  es: 'EUR',
  'pt-BR': 'BRL',
  de: 'EUR',
  fr: 'EUR',
  id: 'IDR',
  ms: 'MYR',
};

/**
 * Map Locale to Intl.LocaleString
 * next-intl uses 'tr', 'en', 'pt-BR' but Intl uses 'tr-TR', 'en-US', 'pt-BR'
 */
function getIntlLocale(locale: Locale): string {
  const localeMap: Record<Locale, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    es: 'es-ES',
    'pt-BR': 'pt-BR',
    de: 'de-DE',
    fr: 'fr-FR',
    id: 'id-ID',
    ms: 'ms-MY',
  };
  return localeMap[locale];
}

/**
 * Format a number value according to locale
 */
function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  const intlLocale = getIntlLocale(locale);
  const defaults = numberFormats[locale] || {};
  const mergedOptions = { ...defaults, ...options };

  try {
    return new Intl.NumberFormat(intlLocale, mergedOptions).format(value);
  } catch (error) {
    console.warn(`Failed to format number for locale ${locale}:`, error);
    return value.toString();
  }
}

/**
 * Format a currency value according to locale
 */
function formatCurrency(
  value: number,
  locale: Locale,
  currency?: string,
  options?: Intl.NumberFormatOptions
): string {
  const intlLocale = getIntlLocale(locale);
  const currencyCode = currency || defaultCurrencies[locale];

  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  };

  try {
    return new Intl.NumberFormat(intlLocale, mergedOptions).format(value);
  } catch (error) {
    console.warn(`Failed to format currency for locale ${locale}:`, error);
    return `${currencySymbols[locale]}${value.toFixed(2)}`;
  }
}

/**
 * Format a percentage value according to locale
 */
function formatPercent(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  const intlLocale = getIntlLocale(locale);
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  };

  try {
    return new Intl.NumberFormat(intlLocale, mergedOptions).format(value);
  } catch (error) {
    console.warn(`Failed to format percent for locale ${locale}:`, error);
    return `${(value * 100).toFixed(2)}%`;
  }
}

/**
 * Format a date value according to locale
 */
function formatDate(
  value: Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const intlLocale = getIntlLocale(locale);
  const mergedOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(intlLocale, mergedOptions).format(value);
  } catch (error) {
    console.warn(`Failed to format date for locale ${locale}:`, error);
    return value.toLocaleDateString();
  }
}

/**
 * Format a datetime value according to locale
 */
function formatDateTime(
  value: Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const intlLocale = getIntlLocale(locale);
  const mergedOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(intlLocale, mergedOptions).format(value);
  } catch (error) {
    console.warn(`Failed to format datetime for locale ${locale}:`, error);
    return value.toLocaleString();
  }
}

/**
 * Format a time value according to locale
 */
function formatTime(
  value: Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const intlLocale = getIntlLocale(locale);
  const mergedOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(intlLocale, mergedOptions).format(value);
  } catch (error) {
    console.warn(`Failed to format time for locale ${locale}:`, error);
    return value.toLocaleTimeString();
  }
}

/**
 * Main LocaleFormatter Component
 */
export function LocaleFormatter({
  value,
  type,
  locale,
  currency,
  className,
  options,
  dateOptions,
  asString = false,
}: LocaleFormatterProps): React.ReactNode {
  let formatted: string;

  try {
    switch (type) {
      case 'currency':
        if (typeof value !== 'number') {
          throw new Error('Currency type requires a number value');
        }
        formatted = formatCurrency(value, locale, currency, options);
        break;

      case 'percent':
        if (typeof value !== 'number') {
          throw new Error('Percent type requires a number value');
        }
        formatted = formatPercent(value, locale, options);
        break;

      case 'number':
        if (typeof value !== 'number') {
          throw new Error('Number type requires a number value');
        }
        formatted = formatNumber(value, locale, options);
        break;

      case 'date':
        if (!(value instanceof Date)) {
          throw new Error('Date type requires a Date value');
        }
        formatted = formatDate(value, locale, dateOptions);
        break;

      case 'datetime':
        if (!(value instanceof Date)) {
          throw new Error('DateTime type requires a Date value');
        }
        formatted = formatDateTime(value, locale, dateOptions);
        break;

      case 'time':
        if (!(value instanceof Date)) {
          throw new Error('Time type requires a Date value');
        }
        formatted = formatTime(value, locale, dateOptions);
        break;

      default:
        throw new Error(`Unknown format type: ${type}`);
    }
  } catch (error) {
    console.warn('LocaleFormatter error:', error);
    // Fallback: return raw value
    return asString ? String(value) : <span className={className}>{String(value)}</span>;
  }

  if (asString) {
    return formatted;
  }

  return <span className={className}>{formatted}</span>;
}

/**
 * Hook for programmatic formatting (returns string, not JSX)
 */
export function useLocaleFormatter() {
  return {
    formatNumber,
    formatCurrency,
    formatPercent,
    formatDate,
    formatDateTime,
    formatTime,
    getIntlLocale,
  };
}

/**
 * Utility functions for direct use
 */
export const localeFormatters = {
  number: formatNumber,
  currency: formatCurrency,
  percent: formatPercent,
  date: formatDate,
  dateTime: formatDateTime,
  time: formatTime,
};
