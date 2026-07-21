const fs = require('fs');

// 1. MemberHeader.tsx
let headerCode = fs.readFileSync('frontend/components/public/MemberHeader.tsx', 'utf8');
headerCode = headerCode.replace(
  /<span className="hidden md:inline text-\[9px\] text-\[\#3b82f6\] md:ml-2 font-black uppercase tracking-\[0\.2em\]">\s*TERMINAL\s*<\/span>/,
  '<span className="hidden md:inline text-[11px] text-[#3b82f6] md:ml-2 font-black uppercase tracking-[0.2em]">TERMINAL</span>'
);
fs.writeFileSync('frontend/components/public/MemberHeader.tsx', headerCode, 'utf8');

// 2. GlobalLandingPage.tsx
let landingCode = fs.readFileSync('frontend/components/global/GlobalLandingPage.tsx', 'utf8');

// Move TickerSearchBox
// Remove it from its original place:
const searchBoxDiv = /<div className="mb-4">\s*<TickerSearchBox locale=\{locale\} onSelect=\{\(t\) => \{ setSelectedTicker\(t\); setSelectedYSymbol\(t\); \}\} \/>\s*<\/div>/;
landingCode = landingCode.replace(searchBoxDiv, '');

// Insert it in the header right before the Watchlist toggle
const rightSidebarToggle = /<button\s*onClick=\{\(\) => setShowRightSidebar\(!showRightSidebar\)\}\s*className="hidden md:flex p-1\.5 text-slate-400 hover:text-white bg-\[\#141924\] border border-\[\#1e2a3a\] rounded transition-colors"/;

const newSearchBoxHtml = `<div className="hidden md:block w-64 mr-2">
                <TickerSearchBox locale={locale} onSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }} />
              </div>
              <button 
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-white bg-[#141924] border border-[#1e2a3a] rounded transition-colors"`;

landingCode = landingCode.replace(rightSidebarToggle, newSearchBoxHtml);
fs.writeFileSync('frontend/components/global/GlobalLandingPage.tsx', landingCode, 'utf8');

console.log('Fixed Header and LandingPage');
