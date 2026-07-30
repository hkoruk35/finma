"use client";

import { useState } from "react";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function FrContactPage() {
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
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 md:py-16">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-6">
          <Link href="/global/fr/home" className="hover:text-[#3b82f6] transition-colors">Tableau de Bord</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Support et Contact</span>
        </nav>

        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Support et Contact</h1>
            <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
               Besoin d'aide avec votre adhésion ? Des questions sur les signaux ? Demande de partenariat ? Envoyez-nous un message directement.
            </p>
        </div>

        <div className="max-w-2xl mx-auto">
           {status === "success" ? (
             <div className="glass-card p-12 text-center animate-fade-in border border-[#1e2a3a] bg-[#141924]">
                <div className="w-16 h-16 bg-[#22c55e]/10 text-[#22c55e] rounded-full flex items-center justify-center mx-auto mb-6">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <h2 className="text-2xl font-medium text-white mb-2">Message Envoyé !</h2>
                <p className="text-slate-400 mb-8">Nous avons reçu votre demande et vous répondrons dans les 24 heures.</p>
                <button
                  onClick={() => setStatus("idle")}
                  className="px-6 py-2 bg-[#1e2a3a] text-white rounded-lg font-medium hover:bg-[#252f40] transition-colors border border-[#30363d]"
                >
                  Envoyer un Autre
                </button>
             </div>
           ) : (
             <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6 border border-[#1e2a3a] bg-[#141924]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-[10px] font-medium text-[#8b949e] uppercase tracking-widest mb-2">Votre Nom</label>
                      <input
                        type="text"
                        required
                        value={formState.name}
                        onChange={(e) => setFormState({...formState, name: e.target.value})}
                        className="w-full bg-[#0a0e17] border border-[#30363d] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
                        placeholder="Jean Dupont"
                      />
                   </div>
                   <div>
                      <label className="block text-[10px] font-medium text-[#8b949e] uppercase tracking-widest mb-2">Adresse E-mail</label>
                      <input
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) => setFormState({...formState, email: e.target.value})}
                        className="w-full bg-[#0a0e17] border border-[#30363d] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
                        placeholder="jean@exemple.fr"
                      />
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] font-medium text-[#8b949e] uppercase tracking-widest mb-2">Sujet</label>
                   <select
                     value={formState.subject}
                     onChange={(e) => setFormState({...formState, subject: e.target.value})}
                     className="w-full bg-[#0a0e17] border border-[#30363d] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none"
                   >
                      <option value="General">Demande Générale</option>
                      <option value="Account Support">Compte & Abonnement</option>
                      <option value="Bug Report">Rapport de Bogue</option>
                      <option value="Partnership">Partenariat</option>
                      <option value="Other">Autre</option>
                   </select>
                </div>
                <div>
                   <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-medium text-[#8b949e] uppercase tracking-widest">Message</label>
                      <span className={`text-[10px] font-mono ${formState.message.length > 900 ? 'text-[#ef4444]' : 'text-[#58a6ff]'}`}>
                         {formState.message.length}/1000
                      </span>
                   </div>
                   <textarea
                     rows={6}
                     required
                     maxLength={1000}
                     value={formState.message}
                     onChange={(e) => setFormState({...formState, message: e.target.value})}
                     className="w-full bg-[#0a0e17] border border-[#30363d] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#3b82f6] transition-colors resize-none"
                     placeholder="Comment pouvons-nous vous aider ?"
                   ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-4 bg-[#3b82f6] text-white rounded-lg font-medium text-sm hover:bg-[#2563eb] transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                   {status === "loading" ? "Envoi en cours..." : "Envoyer le Message"}
                </button>
                {status === "error" && <p className="text-xs text-[#ef4444] text-center font-medium">Impossible d'envoyer. Veuillez réessayer.</p>}
             </form>
           )}
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
