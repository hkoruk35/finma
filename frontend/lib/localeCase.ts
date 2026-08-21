import type { Locale } from "@/lib/i18n/copy";

// CSS'in `text-transform: uppercase` kuralı, tarayıcı/SSR ortamının dil
// etiketi ayarlanmamışsa harfleri jenerik (Türkçe-dışı) kurallarla
// büyütür: küçük "i" (U+0069) → "I" (noktasız) olur, oysa Türkçede
// "SAATLİK" gibi noktalı "İ" (U+0130) doğru olan. Bu, 2026-08-20
// kullanıcı bildirimindeki "genel diğer sayfalarda türkçe karakter
// sorunu var" şikayetinin kök nedeni — mojibake değil, CSS'in "Turkish I
// problem"i. Çözüm: metni CSS'e vermeden ÖNCE `toLocaleUpperCase` ile
// (ICU tabanlı, SSR+tarayıcıda tutarlı) doğru şekilde büyütüp, `uppercase`
// CSS sınıfını kaldırmak — böylece çifte dönüşüm riski de olmaz.
const INTL_TAG: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-PT",
  id: "id-ID",
};

export function localeUpperCase(str: string, locale: Locale): string {
  return str.toLocaleUpperCase(INTL_TAG[locale] ?? "en-US");
}
