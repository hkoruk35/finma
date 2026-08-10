export function formatNumber(val: number | string | null | undefined, decimals = 2): string {
    if (val == null) return "-";
    
    // Parse it as a number in case it's a string
    const num = typeof val === 'string' ? parseFloat(val) : val;
    
    if (isNaN(num)) return "-";

    // Use tr-TR locale which formats as 10.000,00
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}
