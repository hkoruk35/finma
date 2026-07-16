"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";

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
  const router = useRouter();
  const registerHref = registerHrefProp ?? (locale === "en" ? "/en/register" : "/tr/kayit");
  const topHref = redirectTo ?? (locale === "en" ? "/global/en/swing" : "/global/tr/swing");

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
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            BOGA<span className="text-[#3b82f6]">STOCK</span>
          </h1>
          <p className="text-white/50 text-sm font-medium">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
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
            <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
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
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t.submitting : t.submit}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-white/40">
            {t.noAccount}{" "}
            <Link href={registerHref} className="text-[#3b82f6] font-bold hover:underline">
              {t.registerLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
