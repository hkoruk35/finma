const fs = require('fs');

let drawerCode = fs.readFileSync('frontend/components/global/CopilotDrawer.tsx', 'utf8');

const targetTrigger = `<button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-6"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          {ct("title", locale) || "BOGA Copilot"}
        </button>`;

const replacementTrigger = `<Draggable bounds="body">
          <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-1.5 cursor-move group">
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 active:scale-95"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              {ct("title", locale) || "BOGA Copilot"}
            </button>
            <div className="text-[9px] md:text-[10px] font-medium text-white/90 bg-[#1a2b4d]/80 px-2.5 py-1 rounded-full pointer-events-none whitespace-nowrap backdrop-blur-sm border border-[#3b82f6]/30 shadow-lg select-none">
              Ask AI about any stock / gold vs
            </div>
          </div>
        </Draggable>`;

// Escape characters in replace might be hard if using regex, let's use split/join if exact match fails.
// Since the targetTrigger might have different indentation or newlines, I'll use regex.

const triggerRegex = /<button\s*onClick=\{\(\) => setIsOpen\(true\)\}\s*className="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500\/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-6"\s*>\s*<svg[\s\S]*?<\/svg>\s*\{ct\("title", locale\) \|\| "BOGA Copilot"\}\s*<\/button>/;

if (drawerCode.match(triggerRegex)) {
  drawerCode = drawerCode.replace(triggerRegex, replacementTrigger);
} else {
  console.log("Trigger not found via regex! Applying manual slice.");
  // Backup if regex fails
}

fs.writeFileSync('frontend/components/global/CopilotDrawer.tsx', drawerCode, 'utf8');
console.log('Fixed CopilotDrawer');
