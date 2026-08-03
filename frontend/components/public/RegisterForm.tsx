"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import ConsentCheckbox from "@/components/public/ConsentCheckbox";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function RegisterForm({ locale }: { locale: Locale }) {
  const t = copy[locale].register;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(locale.toUpperCase());
  const [region, setRegion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const loginHref = locale === "tr" ? "/global/tr/giris" : `/global/${locale}/login`;
  const topHref = `/global/${locale}`;

  const handleGoogleSignIn = async () => {
    setError("");
    if (!consentChecked) {
      setConsentTouched(true);
      return;
    }
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!consentChecked) {
      setConsentTouched(true);
      return;
    }

    setLoading(true);

    try {
      const confirmRedirectTo = window.location.origin + `/global/${locale}`;
      const res = await fetch("/api/members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          redirectTo: confirmRedirectTo,
          locale,
          consentAccepted: consentChecked,
          selectedLanguage: selectedLanguage.toLowerCase(),
          region,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.needsEmailConfirmation) {
          setNeedsConfirmation(true);
        } else if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          router.push(topHref);
        }
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
          <h1 className="text-4xl font-medium tracking-tighter mb-2">
            <span style={{ color: '#3b82f6' }}>Boga</span><span className="text-white">Stock</span>
          </h1>
          <p className="text-white/50 text-lg font-medium">{t.title}</p>
          {t.subtitle && <p className="text-white/30 text-xs mt-1">{t.subtitle}</p>}
        </div>

        {needsConfirmation ? (
          <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-white text-sm py-4 px-4 rounded-xl text-center">
            {locale === "en"
              ? "Check your inbox to confirm your email, then log in."
              : locale === "es"
              ? "Revisa tu bandeja de entrada para confirmar tu correo electrónico y luego inicia sesión."
              : locale === "fr"
              ? "Vérifiez votre boîte de réception pour confirmer votre e-mail, puis connectez-vous."
              : locale === "pt"
              ? "Verifique sua caixa de entrada para confirmar seu e-mail e depois entre."
              : "E-postanı onaylamak için gelen kutunu kontrol et, ardından giriş yap."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

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

            <ConsentCheckbox
              locale={locale}
              checked={consentChecked}
              onChange={(checked) => {
                setConsentChecked(checked);
                if (checked) setConsentTouched(false);
              }}
              showError={consentTouched}
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-medium tracking-widest text-white/30">{t.orDivider}</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2 ml-1">
                  {locale === "tr" ? "DİL SEÇİMİ" : locale === "es" ? "IDIOMA" : locale === "fr" ? "LANGUE" : locale === "pt" ? "IDIOMA" : "LANGUAGE"}
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all appearance-none"
                  required
                  disabled={loading}
                >
                  <option value="EN">English</option>
                  <option value="TR">Türkçe</option>
                  <option value="ES">Español</option>
                  <option value="FR">Français</option>
                  <option value="PT">Português</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2 ml-1">
                  {locale === "tr" ? "ÜLKE" : locale === "es" ? "PAÍS" : locale === "fr" ? "PAYS" : locale === "pt" ? "PAÍS" : "COUNTRY"}
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all appearance-none"
                  required
                  disabled={loading}
                >
                  <option value="" disabled>{locale === "tr" ? "Seçiniz" : "Select"}</option>
                  <option value="US">United States</option>
                  <option value="TR">Türkiye</option>
                  <option value="UK">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="ES">Spain</option>
                  <option value="BR">Brazil</option>
                  <option value="PT">Portugal</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2 ml-1">
                {t.usernameLabel}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
                placeholder={t.usernamePlaceholder}
                required
                disabled={loading}
              />
              <p className="text-[10px] text-white/30 ml-1 mt-2">
                {locale === "tr" ? "Sadece harf ve rakam. Boşluk veya @, !, ? gibi özel karakterler kullanılamaz."
                 : locale === "es" ? "Solo letras y números. Sin espacios ni caracteres especiales como @, !, ?."
                 : locale === "fr" ? "Lettres et chiffres uniquement. Pas d'espaces ni de caractères spéciaux comme @, !, ?."
                 : locale === "pt" ? "Apenas letras e números. Sem espaços ou caracteres especiais como @, !, ?."
                 : "Only letters and numbers. No spaces or special characters like @, !, ?."}
              </p>
            </div>

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
                minLength={8}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#3b82f6] text-white rounded-2xl font-medium uppercase tracking-[0.2em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-white/40">
            {t.haveAccount}{" "}
            <Link href={loginHref} className="text-[#3b82f6] font-medium hover:underline">
              {t.loginLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
