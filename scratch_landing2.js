const fs = require('fs');
let code = fs.readFileSync('frontend/components/global/GlobalLandingPage.tsx', 'utf8');

// Remove double ai text
code = code.replace('<p className="mt-2 text-xs text-slate-500">{aiText}</p>', '');

// Add onSelect to TickerSearchBox
code = code.replace(
  '<TickerSearchBox locale={locale} />',
  '<TickerSearchBox locale={locale} onSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }} />'
);

// Add onTickerSelect to HomeWatchlistSlot
code = code.replace(
  'disableHoverChart={true}',
  'disableHoverChart={true}\n            onTickerSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }}'
);

// Remove duplicate Terminal Title from right side
code = code.replace(
  '<h1 className="text-sm md:text-lg font-black text-white tracking-tight">{selectedTicker} <span className="text-slate-500 font-medium">Terminal</span></h1>',
  ''
);

fs.writeFileSync('frontend/components/global/GlobalLandingPage.tsx', code, 'utf8');
console.log('Updated GlobalLandingPage');
