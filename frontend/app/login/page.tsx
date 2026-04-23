"use client";

import Link from "next/link";
import { useState } from "react";
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
    "10-Stock Smart AI Tracker",
    "Real-time Performance Monitoring",
    "Exclusive Swing Trade Lists",
    "Professional Screener Access",
    "Telegram Signal Alerts",
  ];

  const FREE_PERKS = [
    "Basic Market Analysis",
    "Limited Watchlist Access",
    "Historical Signal archive",
    "Daily Market Overview",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 flex flex-col items-center justify-center">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">
            Choose Your <span className="text-[#3b82f6]">Access Level</span>
          </h1>
          <p className="text-white text-lg max-w-2xl mx-auto">
            Join the professional algorithmic trading community. Unlock advanced AI scores and personalized tracking tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {/* FREE CARD */}
          <div className="glass-card p-10 flex flex-col border border-[#1e2a3a] hover:border-[#3b82f6]/30 transition-all duration-500 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6] blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
            
            <div className="mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#00d2ff] bg-[#1a2030] px-3 py-1 rounded-full border border-[#1e2a3a]">Standard</span>
              <h2 className="text-3xl font-black text-white mt-4">FREE</h2>
              <p className="text-white text-sm mt-3">Essential tools for beginner analysts.</p>
            </div>

            <div className="text-4xl font-black text-white mb-8">
              $0 <span className="text-sm font-medium text-[#00d2ff]">/ forever</span>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              {FREE_PERKS.map((perk, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-white">
                  <svg className="w-4 h-4 text-[#3b82f6]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {perk}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleGoogleLogin('free')}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[#1a2030] text-white border border-[#3b82f6]/20 rounded-xl font-bold hover:bg-[#2563eb] hover:border-transparent transition-all shadow-xl group"
            >
              Get Started for Free
            </button>
          </div>

          {/* PRO CARD */}
          <div className="glass-card p-10 flex flex-col border-2 border-[#3b82f6]/50 bg-gradient-to-b from-[#0d1117] to-[#121d2f] relative group transform scale-105 shadow-2xl z-10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#3b82f6] text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.5)]">
               Most Popular
            </div>

            <div className="mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3b82f6] bg-[#3b82f6]/10 px-3 py-1 rounded-full border border-[#3b82f6]/30">Professional</span>
              <h2 className="text-3xl font-black text-white mt-4">PRO AI</h2>
              <p className="text-white text-sm mt-3">Advanced algorithmic insights for serious traders.</p>
            </div>

            <div className="mb-8 relative">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white">$19</span>
                <span className="text-white line-through text-lg">$49</span>
              </div>
              <p className="text-[#10b981] text-xs font-bold mt-2 uppercase tracking-tight">Special Offer: 60% OFF First Month</p>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              {PRO_PERKS.map((perk, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-[#f1f5f9]">
                  <div className="w-5 h-5 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  {perk}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleGoogleLogin('pro')}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white text-[#0d1117] rounded-xl font-bold hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-[1.02] transition-all shadow-xl group border-none"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Go PRO with Google
            </button>
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
