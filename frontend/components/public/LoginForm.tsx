"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginForm({
  locale,
  redirectTo,
  registerHref: registerHrefProp,
}: {
  locale: Locale;
  redirectTo?: string;
  registerHref?: string;
}) {
  const t = copy[locale].login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const registerHref = registerHrefProp ?? (locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`);
  const isMobile = typeof window !== "undefined" && (window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  const topHref = redirectTo ?? (isMobile ? `/global/${locale}/home` : `/global/${locale}`);

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?locale=${locale}` },
    });
    if (oauthError) {
      setError(t.genericError);
      setGoogleLoading(false);
    }
    // Başarılıysa tarayıcı Google'a yönlenir, burada başka bir şey yapılmaz.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/members/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push(topHref);
      } else {
        setError(data.error ?? t.genericError);
      }
    } catch {
      setError(t.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-[#010409] font-sans px-4 py-12">
      <div className="w-full max-w-md p-8 glass-card border border-white/10 bg-[#0d1117] rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-medium text-white tracking-tighter mb-2">
            BOGA<span className="text-[#3b82f6]">STOCK</span>
          </h1>
          <p className="text-white/50 text-sm font-medium">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2 ml-1">
              {t.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
              placeholder={t.emailPlaceholder}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2 ml-1">
              {t.passwordLabel}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
              placeholder={t.passwordPlaceholder}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#3b82f6] text-white rounded-2xl font-medium uppercase tracking-[0.2em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t.submitting : t.submit}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-medium tracking-widest text-white/30">{t.orDivider}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full py-4 bg-white text-[#1f1f1f] rounded-2xl font-medium text-sm flex items-center justify-center gap-3 hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? t.submitting : t.googleButton}
        </button>

        <div className="mt-8 text-center">
          <p className="text-xs text-white/40">
            {t.noAccount}{" "}
            <Link href={registerHref} className="text-[#3b82f6] font-medium hover:underline">
              {t.registerLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
