"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "General",
    message: ""
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState)
      });

      if (res.ok) {
        setStatus("success");
        setFormState({ name: "", email: "", subject: "General", message: "" });
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} logoHref="/global/en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Get in Touch</h1>
            <p className="text-white text-lg font-medium">Questions about signals? Partnership inquiry? We're here to help.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-4">
               <div className="glass-card p-6">
                  <p className="text-[10px] text-[#00d2ff] uppercase tracking-widest mb-1">Email Us</p>
                  <p className="text-sm font-bold text-white">contact@bogastock.com</p>
               </div>
               <div className="glass-card p-6">
                  <p className="text-[10px] text-[#00d2ff] uppercase tracking-widest mb-1">Social</p>
                  <p className="text-sm font-bold text-white">@BOGADaily100</p>
               </div>
               <div className="glass-card p-6">
                  <p className="text-[10px] text-[#00d2ff] uppercase tracking-widest mb-1">Location</p>
                  <p className="text-sm font-bold text-white font-mono uppercase">New York, USA</p>
               </div>
            </div>

            <div className="md:col-span-2">
               {status === "success" ? (
                 <div className="glass-card p-12 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-[#22c55e]/10 text-[#22c55e] rounded-full flex items-center justify-center mx-auto mb-6">
                       <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                       </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Message Sent!</h2>
                    <p className="text-white mb-8">We've received your inquiry and will get back to you within 24 hours.</p>
                    <button 
                      onClick={() => setStatus("idle")}
                      className="px-6 py-2 bg-[#1e2a3a] text-white rounded-lg font-bold hover:bg-[#1a2030] transition-colors"
                    >
                      Send Another
                    </button>
                 </div>
               ) : (
                 <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <div>
                          <label className="block text-xs font-bold text-white uppercase tracking-widest mb-2">Your Name</label>
                          <input 
                            type="text" 
                            required 
                            value={formState.name}
                            onChange={(e) => setFormState({...formState, name: e.target.value})}
                            className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6] transition-colors" 
                            placeholder="John Doe" 
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-white uppercase tracking-widest mb-2">Email Address</label>
                          <input 
                            type="email" 
                            required 
                            value={formState.email}
                            onChange={(e) => setFormState({...formState, email: e.target.value})}
                            className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6] transition-colors" 
                            placeholder="john@example.com" 
                          />
                       </div>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-white uppercase tracking-widest mb-2">Subject</label>
                       <select 
                         value={formState.subject}
                         onChange={(e) => setFormState({...formState, subject: e.target.value})}
                         className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none"
                       >
                          <option value="General">General Inquiry</option>
                          <option value="Bug Report">Bug Report</option>
                          <option value="Partnership">Partnership</option>
                          <option value="Advertising">Advertising</option>
                          <option value="Other">Other</option>
                       </select>
                    </div>
                    <div>
                       <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-white uppercase tracking-widest">Message</label>
                          <span className={`text-[10px] font-mono ${formState.message.length > 900 ? 'text-[#ef4444]' : 'text-[#00d2ff]'}`}>
                             {formState.message.length}/1000
                          </span>
                       </div>
                       <textarea 
                         rows={5} 
                         required 
                         maxLength={1000}
                         value={formState.message}
                         onChange={(e) => setFormState({...formState, message: e.target.value})}
                         className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6] transition-colors resize-none" 
                         placeholder="How can we help you?"
                       ></textarea>
                    </div>

                    {/* hCaptcha Placeholder */}
                    <div className="bg-[#000036] border border-[#1e2a3a] rounded-xl p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <input type="checkbox" required className="w-4 h-4 rounded border-[#3b82f6]" />
                          <span className="text-xs font-bold text-white">I am not a robot</span>
                       </div>
                       <div className="text-[8px] text-[#00d2ff] text-right">
                          Protected by<br/><strong className="text-white">BOGA AI Shield</strong>
                       </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={status === "loading"}
                      className="w-full py-4 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {status === "loading" ? "Sending..." : "Send Message"}
                    </button>
                    {status === "error" && <p className="text-xs text-[#ef4444] text-center font-bold">Failed to send. Please try again.</p>}
                 </form>
               )}
            </div>
        </div>
      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
