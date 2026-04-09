"use client";

import Link from "next/link";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LoginPage() {
  const handleGoogleLogin = () => {
    console.log("Initiating Google Login via Supabase...");
    // Supabase Auth Logic:
    // supabase.auth.signInWithOAuth({ provider: 'google' })
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="glass-card p-10 animate-fade-in text-center">
            <div className="mb-8">
              <div className="w-16 h-16 bg-[#3b82f6]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#3b82f6]/20">
                <img src="/finmaicon1.png" alt="FinMA" className="w-10 h-10 object-contain" />
              </div>
              <h1 className="text-3xl font-black text-white mb-3 tracking-tight">FinMA Member Access</h1>
              <p className="text-[#94a3b8] leading-relaxed">
                Connect with Google to unlock your personalized watchlist and the 30-day signal archive.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white text-[#0d1117] rounded-xl font-bold hover:bg-gray-100 transition-all shadow-xl mb-6 group"
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
              Continue with Google
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-[#2c3e50]">
                <div className="h-px bg-[#1e2a3a] flex-1"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Membership Perks</span>
                <div className="h-px bg-[#1e2a3a] flex-1"></div>
              </div>

              <ul className="text-left space-y-3">
                {[
                  "Personalized 10-stock watchlist",
                  "30-day historical signal archive",
                  "Real-time push notifications",
                  "Daily email performance digest",
                ].map((perk, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#64748b]">
                    <svg className="w-4 h-4 text-[#22c55e]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-[10px] text-[#4b5563] mt-8 leading-relaxed max-w-xs mx-auto">
            By continuing, you agree to the FinMA <Link href="/terms" className="underline hover:text-white">Terms of Use</Link> and <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>. 
            Analysis is based on AI algorithms and financial data.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
