const fs = require('fs');
let code = fs.readFileSync('frontend/components/global/CopilotDrawer.tsx', 'utf8');

// Add import Draggable if not present
if (!code.includes('import Draggable from')) {
  code = code.replace(
    'import React, { useRef, useEffect, useState } from "react";',
    'import React, { useRef, useEffect, useState } from "react";\nimport Draggable from "react-draggable";'
  );
}

// Replace the button
const buttonRegex = /\{\!isOpen && \([\s\S]*?<button[\s\S]*?onClick=\{\(\) => setIsOpen\(true\)\}[\s\S]*?className="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500\/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-6"[\s\S]*?>[\s\S]*?<span className="text-lg">.*?<\/span>[\s\S]*?BOGA Copilot[\s\S]*?<\/button>\n\s*\)\}/;

const replacement = `{!isOpen && (
        <Draggable>
          <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-1.5 lg:bottom-6 cursor-move">
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95"
            >
              <span className="text-lg">✨</span>
              BOGA Copilot
            </button>
            <span className="text-[10px] font-medium bg-black/60 backdrop-blur-sm text-white/90 px-3 py-1 rounded-full pointer-events-none text-center max-w-[200px] leading-tight">
              {locale === 'tr' ? 'Herhangi bir hisse veya emtia hakkında AI\\'a danışın'
               : locale === 'es' ? 'Pregúntale a la IA sobre cualquier acción o materia prima'
               : locale === 'fr' ? 'Demandez à l\\'IA sur n\\'importe quelle action ou matière première'
               : locale === 'pt' ? 'Pergunte à IA sobre qualquer ação ou commodity'
               : 'Ask AI about any stock or commodity'}
            </span>
          </div>
        </Draggable>
      )}`;

code = code.replace(buttonRegex, replacement);

fs.writeFileSync('frontend/components/global/CopilotDrawer.tsx', code, 'utf8');
console.log('Updated CopilotDrawer.tsx');
