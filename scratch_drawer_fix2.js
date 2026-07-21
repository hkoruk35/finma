const fs = require('fs');

let drawerCode = fs.readFileSync('frontend/components/global/CopilotDrawer.tsx', 'utf8');

const newButton = `      {!isOpen && (
        <Draggable bounds="body">
          <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-1.5 cursor-move group lg:bottom-6">
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-lg">🤖</span>
              BOGA Copilot
            </button>
            <div className="text-[9px] md:text-[10px] font-medium text-white/90 bg-[#1a2b4d]/80 px-2.5 py-1 rounded-full pointer-events-none whitespace-nowrap backdrop-blur-sm border border-[#3b82f6]/30 shadow-lg select-none">
              {locale === 'tr' ? 'Tüm ABD hisselerini ve Altını yapay zekaya sorun' : 'Ask AI about any stock / gold vs'}
            </div>
          </div>
        </Draggable>
      )}`;

const parts = drawerCode.split('      {!isOpen && (');
if (parts.length > 1) {
  const afterButtonParts = parts[1].split('      )}');
  if (afterButtonParts.length > 1) {
    afterButtonParts.shift(); // remove the old button content
    drawerCode = parts[0] + newButton + afterButtonParts.join('      )}');
    fs.writeFileSync('frontend/components/global/CopilotDrawer.tsx', drawerCode, 'utf8');
    console.log('Fixed CopilotDrawer');
  }
}
