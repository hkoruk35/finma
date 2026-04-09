export default function AdminAds() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-black text-white mb-2">Ad Management</h1>
            <p className="text-sm text-[#64748b]">Configure banner placements and direct advertising scripts.</p>
         </div>
         <div className="flex gap-2">
            <button className="px-4 py-2 bg-[#141924] border border-[#1e2a3a] text-white rounded-lg text-xs font-bold hover:bg-[#1a2030]">Pause All Ads</button>
            <button className="px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-xs font-bold hover:bg-[#2563eb]">New Direct Ad</button>
         </div>
      </div>

      <div className="space-y-6">
         {[
            { id: "AD-H1", pos: "Home - Leaderboard Top", size: "728x90", status: "Active", revenue: "$42.50" },
            { id: "AD-S1", pos: "Stock Detail - Sidebar", size: "300x250", status: "Active", revenue: "$18.20" },
            { id: "AD-H2", pos: "Home - Leaderboard Bottom", size: "728x90", status: "Inactive", revenue: "$0.00" },
            { id: "AD-C1", pos: "Category - Feed Middle", size: "336x280", status: "Active", revenue: "$9.45" },
         ].map((ad) => (
            <div key={ad.id} className="glass-card p-6 flex flex-col md:flex-row md:items-center gap-6">
               <div className="w-full md:w-32 h-20 bg-[#141924] border border-[#1e2a3a] flex items-center justify-center text-[10px] text-[#64748b]">
                  {ad.size} Preview
               </div>
               
               <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                     <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">ID / Position</p>
                     <p className="text-sm font-bold text-white">{ad.id}</p>
                     <p className="text-[10px] text-[#94a3b8]">{ad.pos}</p>
                  </div>
                  <div>
                     <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Status</p>
                     <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${ad.status === 'Active' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                        {ad.status}
                     </span>
                  </div>
                  <div>
                     <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Today's Est.</p>
                     <p className="text-sm font-mono font-bold text-white">{ad.revenue}</p>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                     <button className="p-2 text-[#64748b] hover:text-[#3b82f6] transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                     </button>
                     <button className="p-2 text-[#64748b] hover:text-[#ef4444] transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                     </button>
                  </div>
               </div>
            </div>
         ))}
      </div>

      <div className="mt-8 glass-card p-6">
         <h3 className="font-bold text-white mb-6">Global Ad Scripts (Header)</h3>
         <textarea 
            rows={5}
            className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 font-mono text-xs text-[#94a3b8] focus:outline-none focus:border-[#3b82f6]"
            placeholder="<!-- Paste Google AdSense or Meta script here -->"
         ></textarea>
         <div className="mt-4 flex justify-end">
            <button className="px-8 py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb]">Save Global Settings</button>
         </div>
      </div>
    </div>
  );
}
