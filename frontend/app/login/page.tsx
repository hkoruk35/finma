"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {

  const handleGoogleLogin = async (plan: string) => {
    // Set a flag to notify on successful return
    localStorage.setItem('pending_membership_notify', plan);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        }
      }
    });
    if (error) console.error("Login error:", error.message);
  };

  const PRO_PERKS = [
    "7 Days Free Trial Access",
    "25-Stock Smart AI Tracker",
    "Real-time Performance Monitoring",
    "Exclusive Swing Trade Lists",
    "Deep Algorithmic Market Scanning"
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 flex flex-col items-center justify-center">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">
            Unlock Full <span className="text-[#3b82f6]">Market Intelligence</span>
          </h1>
          <p className="text-white text-lg max-w-2xl mx-auto">
            Start your 7-day free trial and join the professional algorithmic trading community. 
            Access institutional-grade swing trade setups.
          </p>
        </div>

        <div className="w-full max-w-2xl">
          {/* SINGLE PRO CARD */}
          <div className="glass-card p-10 flex flex-col md:flex-row gap-10 border-2 border-[#3b82f6]/50 bg-gradient-to-b from-[#0d1117] to-[#121d2f] relative group shadow-2xl z-10 rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#3b82f6] blur-[120px] opacity-10 pointer-events-none"></div>
            
            <div className="flex-1">
              <div className="mb-8">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3b82f6] bg-[#3b82f6]/10 px-3 py-1 rounded-full border border-[#3b82f6]/30">Early Access</span>
                <h2 className="text-4xl font-black text-white mt-4 tracking-tight">PRO AI</h2>
                <p className="text-white/70 text-sm mt-3 leading-relaxed">The only intelligence engine you need for consistent swing trading precision.</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-white">$20</span>
                  <span className="text-white/40 line-through text-xl">$50</span>
                </div>
                <div className="mt-4 space-y-2">
                   <p className="text-[#3b82f6] text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse"></span>
                      7 Days Free Trial
                   </p>
                   <p className="text-white/50 text-xs font-medium italic">Then $20/mo for 3 months, then $50/mo</p>
                </div>
              </div>

              <button
                onClick={() => handleGoogleLogin('pro')}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white text-[#0d1117] rounded-2xl font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-[1.02] transition-all shadow-xl group border-none"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                </svg>
                Start Free Trial
              </button>
            </div>

            <div className="w-px bg-white/10 hidden md:block"></div>

            <div className="flex-1 flex flex-col justify-center">
              <h3 className="text-white text-xs font-black uppercase tracking-widest mb-6 opacity-60">Membership Perks</h3>
              <ul className="space-y-5">
                {PRO_PERKS.map((perk, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#f1f5f9]">
                    <div className="w-5 h-5 bg-[#3b82f6]/20 rounded-full flex items-center justify-center border border-[#3b82f6]/30">
                      <svg className="w-3 h-3 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="font-medium">{perk}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10 p-4 bg-[#3b82f6]/5 rounded-2xl border border-[#3b82f6]/20">
                 <p className="text-[10px] text-[#3b82f6] font-black uppercase tracking-widest mb-1">Cancellation Policy</p>
                 <p className="text-[10px] text-white/50 leading-relaxed">Cancel anytime during the trial period to avoid being charged. Full transparency, no hidden fees.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#00d2ff] mt-16 leading-relaxed max-w-sm mx-auto">
          Secure payment processing will be enabled upon next update. By continuing, you agree to the BOGA AI <Link href="/terms" className="underline hover:text-white">Terms of Use</Link> and <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
        </p>
      </main>

      <Footer />
    </div>
  );
}
