const fs = require('fs');

let engineCode = fs.readFileSync('frontend/components/charts/BogaChartEngine.tsx', 'utf8');

if (!engineCode.includes('const [multiChartOpen, setMultiChartOpen]')) {
  engineCode = engineCode.replace(
    'const [shareOpen, setShareOpen] = useState(false);',
    `const [shareOpen, setShareOpen] = useState(false);
  const [multiChartOpen, setMultiChartOpen] = useState(false);`
  );
}

const targetButton = `<button
                  onClick={() => {}}
                  className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all ml-1"
                  title="Çoklu Grafik Ekranı"
                >
                  2 / 4 / 6 / 9
                </button>`;

const replacementButton = `<div className="relative">
                  <button
                    onClick={() => setMultiChartOpen(v => !v)}
                    className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all ml-1"
                    title="Çoklu Grafik Ekranı"
                  >
                    2 / 4 / 6 / 9
                  </button>
                  {multiChartOpen && (
                    <div className="absolute right-0 mt-1 w-24 rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl overflow-hidden z-50">
                      {[2, 3, 4, 6, 9].map(num => (
                        <button
                          key={num}
                          onClick={() => { setMultiChartOpen(false); alert("Multi-chart " + num + " layout (Coming Soon)"); }}
                          className="block w-full text-center px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-[#1e2a3a] hover:text-white"
                        >
                          {num} Grafik
                        </button>
                      ))}
                    </div>
                  )}
                </div>`;

engineCode = engineCode.replace(targetButton, replacementButton);

fs.writeFileSync('frontend/components/charts/BogaChartEngine.tsx', engineCode, 'utf8');
console.log('Fixed Multi-Chart button');
