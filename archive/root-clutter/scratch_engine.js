const fs = require('fs');
let code = fs.readFileSync('frontend/components/charts/BogaChartEngine.tsx', 'utf8');

// The block to replace
const targetBlock = `<button
                    onClick={toggleFullscreen}
                    className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all"
                  >
                    {isFullscreen ? "⛶ " : "⛶ "}
                  </button>`;

const replacementBlock = `<button
                    onClick={toggleFullscreen}
                    className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all"
                    title={t.fullscreen || "Tam Ekran"}
                  >
                    {isFullscreen ? "⛶ " : "⛶ "}
                  </button>
                  <button
                    onClick={() => {}}
                    className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all ml-1.5"
                    title="Çoklu Grafik Ekranı"
                  >
                    2 / 4 / 6 / 9
                  </button>`;

code = code.replace(targetBlock, replacementBlock);

fs.writeFileSync('frontend/components/charts/BogaChartEngine.tsx', code, 'utf8');
console.log('Updated BogaChartEngine');
