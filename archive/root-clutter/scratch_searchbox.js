const fs = require('fs');
let code = fs.readFileSync('frontend/components/public/TickerSearchBox.tsx', 'utf8');

code = code.replace(
  'export default function TickerSearchBox({ locale = "en" }: { locale?: string }) {',
  'export default function TickerSearchBox({ locale = "en", onSelect }: { locale?: string, onSelect?: (ticker: string) => void }) {'
);

code = code.replace(
  'router.push(`/global/${locale}/graphic/${ticker.toUpperCase()}`);',
  'if (onSelect) { onSelect(ticker.toUpperCase()); } else { router.push(`/global/${locale}/graphic/${ticker.toUpperCase()}`); }'
);

fs.writeFileSync('frontend/components/public/TickerSearchBox.tsx', code, 'utf8');
console.log('Updated TickerSearchBox');
