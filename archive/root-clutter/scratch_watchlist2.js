const fs = require('fs');
let code = fs.readFileSync('frontend/components/global/HomeWatchlistSlot.tsx', 'utf8');

code = code.replace(
  '  disableHoverChart?: boolean;\n}',
  '  disableHoverChart?: boolean;\n  onTickerSelect?: (ticker: string) => void;\n}'
);

code = code.replace(
  'export default function HomeWatchlistSlot({ locale, defaultStocks, defaultViewAllHref, defaultSortLabel, compactMode, disableHoverChart }: Props) {',
  'export default function HomeWatchlistSlot({ locale, defaultStocks, defaultViewAllHref, defaultSortLabel, compactMode, disableHoverChart, onTickerSelect }: Props) {'
);

code = code.replace(
  'const gridCols = compactMode ? \'grid-cols-[1fr_56px_72px]\' : \'grid-cols-[1fr_56px_64px_72px]\';',
  'const gridCols = compactMode ? \'grid-cols-[minmax(0,1fr)_48px_64px]\' : \'grid-cols-[1fr_56px_64px_72px]\';'
);

code = code.replace(
  'onClick={locked ? () => setShowModal(true) : undefined}',
  'onClick={locked ? () => setShowModal(true) : (onTickerSelect ? () => onTickerSelect(stock.ticker) : undefined)}'
);

fs.writeFileSync('frontend/components/global/HomeWatchlistSlot.tsx', code, 'utf8');
console.log('Updated HomeWatchlistSlot');
