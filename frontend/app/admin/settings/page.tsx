export default function AdminSettings() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
         <h1 className="text-2xl font-black text-white mb-2">Platform Settings</h1>
         <p className="text-sm text-[#64748b]">Configure global parameters, security, and API integrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* General Config */}
         <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-6">General Configuration</h3>
            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2">Site Title</label>
                     <input type="text" defaultValue="FinMA Daily 100" className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-sm" />
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2">Admin Email</label>
                     <input type="email" defaultValue="contact@finmasmart.com" className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-sm" />
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2">Maintenance Mode</label>
                  <div className="flex items-center gap-4 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a]">
                     <div className="w-10 h-5 bg-[#2c3e50] rounded-full relative cursor-pointer">
                        <div className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full"></div>
                     </div>
                     <span className="text-xs text-[#94a3b8]">Redirect all traffic to maintenance landing page.</span>
                  </div>
               </div>
               
               <button className="w-full py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb]">Update General Settings</button>
            </div>
         </div>

         {/* Security & API */}
         <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-6">Security & API Keys</h3>
            <div className="space-y-6">
               <div>
                  <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1">Gemini AI Model</label>
                  <select className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-sm text-white">
                     <option>gemini-1.5-flash</option>
                     <option>gemini-1.5-pro</option>
                  </select>
               </div>

               <div className="relative">
                  <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1">JWT Secret Key</label>
                  <input type="password" value="••••••••••••••••••••••••" readOnly className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-sm text-[#3b82f6] font-mono" />
                  <button className="absolute right-4 top-10 text-[10px] text-[#3b82f6] font-bold uppercase hover:underline">Rotate</button>
               </div>

               <div className="pt-4 flex gap-4">
                  <button className="flex-1 py-3 bg-[#1e2a3a] text-white rounded-xl text-xs font-bold hover:bg-[#2c3e50]">Purge Cache</button>
                  <button className="flex-1 py-3 bg-[#7f1d1d]/20 text-[#ef4444] border border-[#ef4444]/30 rounded-xl text-xs font-bold hover:bg-[#ef4444]/10">Hard Reset Bot</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
