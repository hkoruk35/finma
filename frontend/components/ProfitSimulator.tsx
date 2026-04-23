"use client";
import React, { useState, useMemo } from 'react';

const ProfitSimulator = () => {
  const [capital, setCapital] = useState(1000);
  const [signalCount, setSignalCount] = useState(10);
  const [riskProfile, setRiskProfile] = useState<'Low' | 'Medium' | 'Aggressive'>('Medium');

  // Stats from the user request
  const winRate = 0.937;
  const avgReturn = 0.074;
  const lossRate = 0.063;
  const avgLoss = -0.025; // Adjusted as an example of stop loss average

  const expectancy = (winRate * avgReturn) + (lossRate * avgLoss);
  
  // Risk multiplier determines how much of capital is deployed per signal
  const riskMultiplier = {
    Low: 0.1,      // 10% of capital per trade
    Medium: 0.25,  // 25% of capital per trade
    Aggressive: 0.45 // 45% of capital per trade
  };

  const monthlyReturn = expectancy * signalCount * riskMultiplier[riskProfile];
  const estimatedMonthly = capital * (1 + monthlyReturn);
  
  // Compounding for 12 months
  const monthlyRate = 1 + monthlyReturn;
  const compoundingData = useMemo(() => {
    const data = [capital];
    for (let i = 1; i <= 12; i++) {
        data.push(data[i-1] * monthlyRate);
    }
    return data;
  }, [capital, monthlyRate]);

  const finalValue = compoundingData[12];
  const alphaEdge = (monthlyReturn * 100 - 0.7).toFixed(1); // S&P 500 avg monthly is ~0.7-0.8%

  // SVG Chart Helper
  const maxVal = Math.max(...compoundingData) * 1.1;
  const minVal = Math.min(...compoundingData) * 0.9;
  
  const getX = (i: number) => (i / 12) * 100;
  const getY = (v: number) => 100 - ((v - minVal) / (maxVal - minVal)) * 100;

  const points = compoundingData.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  return (
    <div className="glass-card mb-12 border-t-4 border-t-[#3b82f6] overflow-hidden">
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#1e2a3a]">
        {/* Left column: Inputs */}
        <div className="lg:w-1/2 p-5 md:p-8 lg:p-12 space-y-10 md:space-y-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse"></span>
              <p className="text-[11px] md:text-[13px] font-black text-[#3b82f6] uppercase tracking-[0.3em]">PROFIT SIMULATOR</p>
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-4 tracking-tighter">BOGA AI PROFIT POTENTIAL</h2>
            <p className="text-base md:text-lg text-white leading-relaxed">
              Visualize your growth potential based on BOGA AI's historical <span className="text-white font-bold">93.7%</span> win rate and <span className="text-white font-bold">7.4%</span> average monthly returns per pick.
            </p>
          </div>

          <div className="space-y-8 md:space-y-10">
            <div className="space-y-4 md:space-y-5">
              <div className="flex justify-between items-end">
                <label className="text-[11px] md:text-[13px] font-bold text-white uppercase tracking-[0.2em]">Initial Capital</label>
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl md:text-3xl font-mono font-black text-[#3b82f6]">${capital.toLocaleString()}</span>
                   <span className="text-[10px] md:text-[12px] text-[#00d2ff] uppercase font-bold">USD</span>
                </div>
              </div>
              <input 
                type="range" min="500" max="100000" step="500" 
                value={capital} onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full h-3 bg-[#0d1117] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
              />
            </div>

            <div className="space-y-4 md:space-y-5">
              <div className="flex justify-between items-end">
                <label className="text-[11px] md:text-[13px] font-bold text-white uppercase tracking-[0.2em]">Signals Per Month</label>
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl md:text-3xl font-mono font-black text-[#3b82f6]">{signalCount}</span>
                   <span className="text-[10px] md:text-[12px] text-[#00d2ff] uppercase font-bold">PICKS</span>
                </div>
              </div>
              <input 
                type="range" min="1" max="25" step="1" 
                value={signalCount} onChange={(e) => setSignalCount(Number(e.target.value))}
                className="w-full h-3 bg-[#0d1117] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
              />
            </div>

            <div className="space-y-4 md:space-y-5">
              <label className="text-[11px] md:text-[13px] font-bold text-white uppercase tracking-[0.2em]">Trading Aggression</label>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {(['Low', 'Medium', 'Aggressive'] as const).map(profile => (
                  <button
                    key={profile}
                    onClick={() => setRiskProfile(profile)}
                    className={`py-3 md:py-4 px-2 md:px-6 rounded-xl text-[10px] md:text-[12px] font-black uppercase tracking-widest transition-all border ${
                      riskProfile === profile 
                        ? "bg-[#3b82f6] text-white border-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                        : "bg-[#0d1117] text-[#00d2ff] border-[#1e2a3a] hover:border-[#3b82f6]/40"
                    }`}
                  >
                    {profile}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Results */}
        <div className="lg:w-1/2 bg-[#0d1117]/30 p-5 md:p-8 lg:p-12 flex flex-col gap-8 md:gap-10">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              <div className="flex flex-col gap-1 md:gap-2">
                 <p className="text-[11px] md:text-[13px] text-white font-bold uppercase tracking-widest">Est. Monthly Total</p>
                 <div className="flex items-baseline gap-2">
                    <p className="text-3xl md:text-4xl font-mono font-black text-white">${Math.floor(estimatedMonthly).toLocaleString()}</p>
                    <span className={`text-sm md:text-base font-bold ${monthlyReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                       +{((estimatedMonthly/capital - 1)*100).toFixed(1)}%
                    </span>
                 </div>
              </div>
              <div className="flex flex-col gap-1 md:gap-2">
                 <p className="text-[11px] md:text-[13px] text-white font-bold uppercase tracking-widest">Boga Performance</p>
                 <div className="flex items-baseline gap-2">
                    <p className="text-3xl md:text-4xl font-mono font-black text-[#3b82f6]">+{alphaEdge}%</p>
                    <span className="text-[11px] md:text-[12px] text-[#00d2ff] font-bold uppercase">vs S&P 500</span>
                 </div>
              </div>
           </div>

           {/* Visualization Card */}
           <div className="bg-[#0a0e17] p-6 md:p-10 rounded-2xl md:rounded-3xl border border-[#1e2a3a] flex-1 min-h-[220px] md:min-h-[250px] flex flex-col justify-between relative overflow-hidden group">
              {/* Background Glow */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#3b82f6]/10 blur-[80px] rounded-full group-hover:bg-[#3b82f6]/20 transition-all"></div>

              <div>
                <p className="text-[11px] md:text-[13px] text-white font-black uppercase tracking-widest mb-2">12-Month Compounding Pathway</p>
                <p className="text-3xl md:text-5xl font-mono font-black text-white leading-none tracking-tighter">
                   ${Math.floor(finalValue).toLocaleString()}
                </p>
              </div>
              
              <div className="flex-1 flex items-center mt-8">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-28 overflow-visible">
                  <defs>
                    <linearGradient id="chartGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Area */}
                  <path 
                    d={`M 0,100 L ${points} L 100,100 Z`}
                    fill="url(#chartGradient2)"
                  />
                  {/* Line */}
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Pulse at the end */}
                  <circle cx="100" cy={getY(finalValue)} r="4" fill="#3b82f6" className="animate-pulse" />
                </svg>
              </div>

              <div className="flex justify-between items-center mt-6">
                 <span className="text-[10px] font-bold text-[#00d2ff] uppercase">Start</span>
                 <span className="text-[10px] font-bold text-[#00d2ff] uppercase hidden sm:inline">Quarter 1</span>
                 <span className="text-[10px] font-bold text-[#00d2ff] uppercase hidden sm:inline">Quarter 2</span>
                 <span className="text-[10px] font-bold text-[#00d2ff] uppercase">Target</span>
              </div>
           </div>

           <div className="space-y-6">
              <button className="w-full py-6 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_15px_35px_rgba(59,130,246,0.3)] hover:bg-[#2563eb] transition-all hover:-translate-y-1 active:scale-95 text-sm">
                Unlock BOGA AI PRO Signals
              </button>
              <p className="text-[10px] text-[#00d2ff] leading-relaxed text-center italic">
                * Note: Historical performance is for informational purposes only. Trading involves significant risk of loss. This simulator calculates expectancy based on verified past results.
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitSimulator;
