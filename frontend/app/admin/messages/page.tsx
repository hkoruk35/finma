"use client";

import { useEffect, useState } from "react";

interface Message {
  id: number;
  date: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/admin/messages");
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    await fetch("/api/admin/messages", { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }) 
    });
    setMessages(messages.map(m => m.id === id ? { ...m, isRead: true } : m));
  };

  const deleteMessage = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    await fetch("/api/admin/messages", { 
      method: "DELETE", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }) 
    });
    setMessages(messages.filter(m => m.id !== id));
  };

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex justify-between items-end">
         <div>
            <h1 className="text-2xl font-black text-white mb-2">Message Inbox</h1>
            <p className="text-sm text-[#64748b]">Manage contact form submissions and professional inquiries.</p>
         </div>
         <div className="bg-[#3b82f6]/10 px-4 py-2 rounded-xl border border-[#3b82f6]/20">
            <span className="text-xs font-bold text-[#3b82f6] uppercase tracking-widest">{unreadCount} UNREAD</span>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Sidebar filters */}
         <div className="lg:col-span-1 space-y-2">
            {[
               { label: "All Messages", count: messages.length, active: true },
               { label: "General", count: messages.filter(m => m.subject === "General").length },
               { label: "Bug Reports", count: messages.filter(m => m.subject === "Bug Report").length },
               { label: "Partnerships", count: messages.filter(m => m.subject === "Partnership").length },
               { label: "Advertising", count: messages.filter(m => m.subject === "Advertising").length },
            ].map((cat, i) => (
               <button 
                  key={i} 
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                     cat.active ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/10' : 'bg-[#141924] text-[#94a3b8] border border-[#1e2a3a] hover:bg-[#1a2030] hover:text-white'
                   }`}
               >
                  {cat.label}
                  <span className={`text-[10px] font-bold ${cat.active ? 'text-[#e0e7ff]' : 'text-[#64748b]'}`}>({cat.count})</span>
               </button>
            ))}
         </div>

         {/* Message Feed */}
         <div className="lg:col-span-3 space-y-4">
            {loading ? (
              <p className="text-[#94a3b8]">Loading messages...</p>
            ) : messages.length === 0 ? (
              <div className="glass-card p-12 text-center text-[#64748b]">
                 No messages in your inbox.
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  onClick={() => !msg.isRead && markAsRead(msg.id)}
                  className={`glass-card p-6 border-l-4 transition-all group ${msg.isRead ? 'border-l-transparent' : 'border-l-[#3b82f6] bg-[#141924]'}`}
                >
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                         <span className={`text-sm font-bold ${msg.isRead ? 'text-[#94a3b8]' : 'text-white'}`}>{msg.name}</span>
                         <span className="text-[10px] text-[#3b82f6] font-mono">({msg.email})</span>
                      </div>
                      <span className="text-[10px] text-[#64748b] font-mono">{new Date(msg.date).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-start mb-4">
                      <h4 className={`text-sm font-bold ${msg.isRead ? 'text-[#64748b]' : 'text-white'}`}>{msg.subject}</h4>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <a 
                           href={`mailto:${msg.email}?subject=Re: ${msg.subject}`}
                           className="p-1.5 rounded bg-[#1e2a3a] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white transition-all"
                           title="Reply"
                           onClick={(e) => e.stopPropagation()}
                         >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                         </a>
                         <button 
                           onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                           className="p-1.5 rounded bg-[#1e2a3a] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-all"
                           title="Delete"
                         >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                         </button>
                      </div>
                   </div>
                   <p className={`text-xs leading-relaxed ${msg.isRead ? 'text-[#64748b]' : 'text-[#94a3b8]'}`}>
                      {msg.message}
                   </p>
                </div>
              ))
            )}
         </div>
      </div>
    </div>
  );
}
