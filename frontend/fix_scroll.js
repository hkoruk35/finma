const fs = require('fs');
const path = require('path');

const root = 'C:/Users/afksm/finma/frontend';

// 1. Update SectorHeatMap.tsx
const sectorPath = path.join(root, 'components/SectorHeatMap.tsx');
let sectorCode = fs.readFileSync(sectorPath, 'utf8');
sectorCode = sectorCode.replace(
  '<div className="overflow-x-auto md:overflow-x-visible">\n        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-max md:min-w-0">',
  '<div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide md:overflow-x-visible">\n        <div className="flex flex-row md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:min-w-0">'
);
sectorCode = sectorCode.replace(
  'className="glass-card overflow-hidden flex flex-col border border-[#1e2a3a] hover:border-[#3b82f6]/30 transition-all duration-300 group flex-shrink-0 md:flex-shrink md:w-auto w-[calc(100vw-40px)]"',
  'className="glass-card overflow-hidden flex flex-col border border-[#1e2a3a] hover:border-[#3b82f6]/30 transition-all duration-300 group flex-shrink-0 w-[calc(100vw-40px)] snap-center md:flex-shrink md:w-auto md:snap-align-none"'
);
fs.writeFileSync(sectorPath, sectorCode);
console.log('Updated SectorHeatMap.tsx');

// 2. Update HomeGridCard.tsx
const cardPath = path.join(root, 'components/global/HomeGridCard.tsx');
let cardCode = fs.readFileSync(cardPath, 'utf8');
cardCode = cardCode.replace(
  '<div className="glass-card border-2 border-[#1e2a3a]/50 rounded-2xl overflow-hidden flex flex-col h-full">',
  '<div className="glass-card border-2 border-[#1e2a3a]/50 rounded-2xl overflow-hidden flex flex-col h-full min-w-[85vw] snap-center flex-shrink-0 md:min-w-0 md:flex-shrink-1 md:w-auto md:snap-align-none">'
);
fs.writeFileSync(cardPath, cardCode);
console.log('Updated HomeGridCard.tsx');

// 3. Update all page.tsx
const langs = ['en', 'es', 'fr', 'pt', 'tr'];
for (const lang of langs) {
  const pagePath = path.join(root, `app/global/${lang}/home/page.tsx`);
  if (fs.existsSync(pagePath)) {
    let pageCode = fs.readFileSync(pagePath, 'utf8');
    pageCode = pageCode.replace(
      '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">',
      '<div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 gap-4 md:gap-6 pb-2 md:pb-0">'
    );
    fs.writeFileSync(pagePath, pageCode);
    console.log(`Updated app/global/${lang}/home/page.tsx`);
  }
}
