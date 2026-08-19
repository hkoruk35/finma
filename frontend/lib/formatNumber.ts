export function formatNumber(val: number | string | null | undefined, decimals = 2, locale = 'en-US'): string {
    if (val == null) return "-";
    
    // Parse it as a number in case it's a string
    const num = typeof val === 'string' ? parseFloat(val) : val;
    
    if (isNaN(num)) return "-";

    const mappedLocale = locale === 'tr' ? 'tr-TR' 
        : locale === 'es' ? 'es-ES' 
        : locale === 'fr' ? 'fr-FR' 
        : locale === 'pt' ? 'pt-BR' 
        : locale === 'id' ? 'id-ID' 
        : 'en-US';

    return new Intl.NumberFormat(mappedLocale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}
