export default function AdminMembers() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-black text-white mb-2">Member Management</h1>
            <p className="text-sm text-[#64748b]">View, filter, and manage registered FinMA members.</p>
         </div>
         <button className="px-6 py-3 bg-[#141924] border border-[#1e2a3a] text-white rounded-xl text-sm font-bold hover:bg-[#1a2030] transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
         </button>
      </div>

      {/* Member Table */}
      <div className="glass-card overflow-hidden">
         <div className="px-6 py-4 bg-[#141924]/30 border-b border-[#1e2a3a] flex items-center justify-between">
            <div className="flex gap-4">
               <input 
                  type="text" 
                  placeholder="Search by email..."
                  className="bg-[#0a0e17] border border-[#1e2a3a] rounded-lg px-4 py-1.5 text-xs text-white focus:outline-none focus:border-[#3b82f6] w-64"
               />
               <select className="bg-[#0a0e17] border border-[#1e2a3a] rounded-lg px-4 py-1.5 text-xs text-[#94a3b8] focus:outline-none focus:border-[#3b82f6]">
                  <option>All Tiers</option>
                  <option>Free Members</option>
                  <option>Admin</option>
               </select>
            </div>
            <span className="text-[10px] text-[#64748b] uppercase tracking-widest font-bold">1,284 Total Members</span>
         </div>
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-[#141924]/10 border-b border-[#1e2a3a]">
                  <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase">Email / User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase">Joined Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase">Watchlist</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#64748b] uppercase text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3a]">
               {[
                  { email: "user1@example.com", date: "2026-04-01", watchlist: 8, status: "Active" },
                  { email: "trader_joe@gmail.com", date: "2026-03-28", watchlist: 10, status: "Active" },
                  { email: "support@finmasmart.com", date: "2026-03-25", watchlist: 0, status: "Staff" },
                  { email: "spam_bot@badsite.com", date: "2026-04-05", watchlist: 1, status: "Suspended" },
               ].map((user, i) => (
                  <tr key={i} className="hover:bg-[#141924]/30 transition-colors">
                     <td className="px-6 py-4">
                        <span className="text-sm font-medium text-white">{user.email}</span>
                     </td>
                     <td className="px-6 py-4 text-xs text-[#94a3b8] font-mono">{user.date}</td>
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="w-20 h-1 bg-[#0a0e17] rounded-full">
                              <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: `${(user.watchlist / 10) * 100}%` }}></div>
                           </div>
                           <span className="text-[10px] font-bold text-[#64748b]">{user.watchlist}/10</span>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                           user.status === 'Active' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 
                           user.status === 'Staff' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 
                           'bg-[#ef4444]/10 text-[#ef4444]'
                        }`}>
                           {user.status}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <button className="text-[10px] font-bold text-[#3b82f6] hover:underline px-2">Edit</button>
                        <button className="text-[10px] font-bold text-[#ef4444] hover:underline px-2">Ban</button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}
