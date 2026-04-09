"use client";

import { useState } from "react";

export default function AdminContent() {
  const [ticker, setTicker] = useState("");
  
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
         <h1 className="text-2xl font-black text-white mb-2">Content Management</h1>
         <p className="text-sm text-[#64748b]">Edit site terminology and override AI-generated summaries.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* AI Summary Override */}
         <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-6">AI Summary Override</h3>
            <div className="space-y-6">
               <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">Ticker Symbol</label>
                  <div className="flex gap-2">
                     <input 
                        type="text" 
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder="e.g. AAPL"
                        className="flex-1 bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6]"
                     />
                     <button className="px-6 bg-[#141924] border border-[#1e2a3a] text-white rounded-xl text-sm font-bold hover:bg-[#1a2030]">Load Current</button>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">Custom Analysis Card</label>
                  <textarea 
                     rows={6}
                     className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6] text-sm"
                     placeholder="Type override summary here... Max 150 words."
                  ></textarea>
               </div>

               <button className="w-full py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb] transition-all">
                  Save Override
               </button>
            </div>
         </div>

         {/* Site Text Components */}
         <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-6">Site Text Components</h3>
            <div className="space-y-4">
               {[
                  { label: "Homepage Hero Title", value: "Discover the Strongest US Stocks with AI" },
                  { label: "Announcement Bar", value: "Limited Time: Free archive access for early adopters!", enabled: true },
                  { label: "Newsletter CTA", value: "Join 5,000+ traders receiving daily FinMA signals." },
               ].map((item, i) => (
                  <div key={i} className="bg-[#141924] p-4 rounded-xl border border-[#1e2a3a]">
                     <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-[#64748b] uppercase tracking-widest font-bold">{item.label}</p>
                        {item.enabled !== undefined && (
                           <div className={`w-8 h-4 rounded-full relative ${item.enabled ? 'bg-[#3b82f6]' : 'bg-[#2c3e50]'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${item.enabled ? 'left-4.5' : 'left-0.5'}`}></div>
                           </div>
                        )}
                     </div>
                     <p className="text-sm text-[#94a3b8]">{item.value}</p>
                     <button className="mt-3 text-[10px] text-[#3b82f6] font-bold uppercase hover:underline">Edit Content</button>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
