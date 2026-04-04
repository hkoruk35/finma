const path = require('path');

module.exports = {
  i18n: {
    defaultLocale: 'tr',
    locales: [
      'tr', 'en', 'es', 'pt', 'ar', 'id', 'ja',
      'de', 'fr', 'it', 'nl', 'pl', 'ru', 'ko',
      'zh', 'vi', 'th', 'hi', 'ur', 'fa', 'he',
      'uk', 'sv', 'no', 'da', 'fi', 'cs', 'hu',
      'ro', 'bg', 'hr', 'sr', 'sk', 'sl', 'et',
      'lt', 'lv', 'mk', 'sq', 'el', 'is', 'ga', 'cy'
    ],
  },
  ns: ['common', 'landing', 'market', 'auth', 'finma514'],
  defaultNS: 'common',
  localePath: path.resolve('./public/locales'),
  detection: {
    order: ['localStorage', 'htmlTag'],
    caches: ['localStorage'],
  },
};
