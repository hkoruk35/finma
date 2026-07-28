const fs = require('fs');

// 1. Fix GlobalLandingPage fetch
let landingCode = fs.readFileSync('frontend/components/global/GlobalLandingPage.tsx', 'utf8');
landingCode = landingCode.replace(
  /fetch\(\`\/api\/tickers\/search\?q=\$\{selectedTicker\}\`\)[\s\S]*?\.catch\(\(\) => \{\}\);/,
  `fetch(\`/api/watchlist-data?tickers=\${selectedTicker}\`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0) {
            const match = data[0];
            if (match) {
              setCurrentCompany(match.company || "");
              setCurrentGroup(match.sector || "");
            }
          }
        }).catch(() => {});`
);
fs.writeFileSync('frontend/components/global/GlobalLandingPage.tsx', landingCode, 'utf8');


// 2. Fix HomeWatchlistSlot layout
let watchlistCode = fs.readFileSync('frontend/components/global/HomeWatchlistSlot.tsx', 'utf8');

// Use a nice grid
watchlistCode = watchlistCode.replace(
  /const gridCols = 'grid-cols-\[1fr_56px_64px_72px\]';/,
  `const gridCols = compactMode ? 'grid-cols-[1fr_48px_64px]' : 'grid-cols-[1fr_56px_64px_72px]';`
);

const colLabelsRegex = /<div className=\{compactMode \? "flex items-center justify-between[\s\S]*?<\/div>/;
const replacementColLabels = `
            <div className={\`grid \${gridCols} gap-2 px-5 py-2 border-b border-[#1e2a3a] text-[9px] font-bold uppercase tracking-wider text-white/60\`}>
              <span>{labels.stock}</span>
              <span />
              {!compactMode && <span className="text-center">{labels.status}</span>}
              <span className="text-right">{labels.price}</span>
            </div>`;
watchlistCode = watchlistCode.replace(colLabelsRegex, replacementColLabels);

const rowsRegex = /<div\s+key=\{stock\.ticker\}[\s\S]*?className=\{compactMode \? \`flex items-center justify-between[\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}\)/;
const replacementRows = `<div
                    key={stock.ticker}
                    className={\`grid \${gridCols} gap-2 items-center px-4 md:px-5 py-3 transition-colors duration-150 group \${locked ? 'cursor-pointer' : (onTickerSelect ? 'cursor-pointer hover:bg-white/[0.03]' : '')}\`}
                    onClick={locked ? () => setShowModal(true) : (onTickerSelect ? () => onTickerSelect(stock.ticker) : undefined)}
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-white/50 w-3 shrink-0">{idx + 1}</span>
                      <div className="min-w-0 flex flex-col justify-center">
                        {locked ? (
                          <>
                            <div className="font-medium text-sm tracking-tight select-none flex items-center gap-1" style={{ color: '#f59e0b' }}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                              <span style={{ fontSize: 11, fontWeight: 700 }}>Premium</span>
                            </div>
                            <div className="text-[10px] text-white/60 leading-tight line-clamp-2" title={sectorNames[stock.sector] ?? stock.sector}>{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        ) : (
                          <>
                            {disableHoverChart ? (
                              <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                            ) : (
                              <TickerHoverChart ticker={stock.ticker}>
                                <div className="font-medium text-white text-sm tracking-tight">{stock.ticker}</div>
                              </TickerHoverChart>
                            )}
                            <div className="text-[10px] text-white/60 leading-tight line-clamp-2" title={sectorNames[stock.sector] ?? stock.sector}>{sectorNames[stock.sector] ?? stock.sector}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="justify-self-center">
                      <Sparkline data={stock.sparkline} color={stock.change_pct >= 0 ? '#22c55e' : '#ef4444'} changePct={stock.change_pct} />
                    </div>

                    {!compactMode && (
                      <span
                        className="justify-self-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap"
                        style={{ background: \`\${st.color}26\`, color: st.color }}
                      >
                        {slabel}
                      </span>
                    )}

                    <div className="text-right shrink-0">
                      <div className="font-mono text-[13px] font-semibold text-white/90">
                        {stock.price > 0 ? \`$\${stock.price.toFixed(2)}\` : '—'}
                      </div>
                      <span
                        className={\`inline-block mt-0.5 px-1.5 py-[1px] rounded text-[10px] font-bold font-mono \${
                          stock.change_pct >= 0 ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'
                        }\`}
                      >
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })`;
watchlistCode = watchlistCode.replace(rowsRegex, replacementRows);
fs.writeFileSync('frontend/components/global/HomeWatchlistSlot.tsx', watchlistCode, 'utf8');

console.log('Done fixes');
