const fs = require('fs');
let code = fs.readFileSync('frontend/components/global/HomeWatchlistSlot.tsx', 'utf8');

code = code.replace(
  '  defaultSortLabel?: string;\n}',
  '  defaultSortLabel?: string;\n  compactMode?: boolean;\n  disableHoverChart?: boolean;\n}'
);

code = code.replace(
  'export default function HomeWatchlistSlot({ locale, defaultStocks, defaultViewAllHref, defaultSortLabel }: Props) {',
  'export default function HomeWatchlistSlot({ locale, defaultStocks, defaultViewAllHref, defaultSortLabel, compactMode, disableHoverChart }: Props) {'
);

code = code.replace(
  'const sectorNames = copy[locale].top100.sectors as Record<string, string>;',
  'const sectorNames = copy[locale].top100.sectors as Record<string, string>;\n  const gridCols = compactMode ? \'grid-cols-[1fr_56px_72px]\' : \'grid-cols-[1fr_56px_64px_72px]\';'
);

code = code.replace(
  /className=\`grid \$\{ROW_COLS\} gap-2/g,
  'className={`grid ${gridCols} gap-2'
);

code = code.replace(
  '<span className="text-center">{labels.status}</span>',
  '{!compactMode && <span className="text-center">{labels.status}</span>}'
);

code = code.replace(
  /<span\s+className="justify-self-center px-1\.5 py-0\.5 rounded text-\[9px\] font-bold uppercase whitespace-nowrap"([\s\S]*?)<\/span>/,
  `{!compactMode && (
                      <span
                        className="justify-self-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap"
$1</span>
                    )}`
);

code = code.replace(
  /<TickerHoverChart ticker=\{stock\.ticker\}>\s*<div className="font-black text-white text-sm tracking-tight\">\{stock\.ticker\}<\/div>\s*<\/TickerHoverChart>/,
  `{disableHoverChart ? (
                              <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                            ) : (
                              <TickerHoverChart ticker={stock.ticker}>
                                <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                              </TickerHoverChart>
                            )}`
);

code = code.replace(
  /font-black text-sm/g,
  'font-medium text-sm'
);

fs.writeFileSync('frontend/components/global/HomeWatchlistSlot.tsx', code, 'utf8');
console.log('Updated HomeWatchlistSlot.tsx');
