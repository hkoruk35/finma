const fs = require('fs');
const path = 'frontend/components/charts/BogaChartEngine.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const newButtons = `                <button
                  onClick={toggleFullscreen}
                  className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all"
                  title={t.fullscreen || "Tam Ekran"}
                >
                  {isFullscreen ? "⛶" : "⛶"}
                </button>
                <button
                  onClick={() => {}}
                  className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all ml-1"
                  title="Çoklu Grafik Ekranı"
                >
                  2 / 4 / 6 / 9
                </button>`;

lines.splice(974, 6, newButtons);
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed BogaChartEngine.tsx');
