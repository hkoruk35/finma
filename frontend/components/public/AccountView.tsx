"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";

type Member = {
  username: string;
  email: string;
  trial_ends_at: string;
  plan: string;
  last_login_at: string | null;
  created_at: string;
};

type Tab = "profile" | "password" | "subscription" | "language";

export default function AccountView({ locale, isGlobal = false }: { locale: Locale; isGlobal?: boolean }) {
  const t = copy[locale].account;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const feedbackHref = locale === "en" ? "/en/account/feedback" : "/tr/hesabim/geri-bildirim";
  const loginHref = isGlobal
    ? (locale === "en" ? "/global/en/login" : "/global/tr/giris")
    : (locale === "en" ? "/en/login" : "/tr/giris");

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMember(data.member))
      .catch(() => router.push(loginHref))
      .finally(() => setLoading(false));
  }, [router, loginHref]);

  const handleLogout = async () => {
    await fetch("/api/members/logout", { method: "POST" }).catch(() => {});
    if (isGlobal) {
      router.push(locale === "en" ? "/global/en/login" : "/global/tr/giris");
    } else {
      router.push(locale === "en" ? "/en" : "/tr");
    }
  };

  if (loading) {
    return (
      <div className={`${isGlobal ? "h-[60vh]" : "min-h-screen"} flex items-center justify-center bg-[#010409] text-white/50 text-sm`}>
        {t.loading}
      </div>
    );
  }

  if (!member) return null;

  const dateFmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR") : "—";

  const isTrialActive = new Date(member.trial_ends_at) > new Date();

  return (
    <div className={`${isGlobal ? "flex-1" : "min-h-screen"} bg-[#010409] font-sans px-4 py-12`}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-white tracking-tighter mb-8 text-center">{t.title}</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-2xl border ${
              message.type === "success"
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto scrollbar-none">
          {(["profile", "password", "subscription", "language"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMessage(null);
              }}
              className={`px-4 py-2 font-bold text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === tab
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#161b22] border border-white/10 text-white/60 hover:text-white/80"
              }`}
            >
              {tab === "profile"
                ? t.profileTab
                : tab === "password"
                  ? t.passwordTab
                  : tab === "subscription"
                    ? t.subscriptionTab
                    : t.languageTab}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && <ProfileTab member={member} locale={locale} t={t} onSuccess={() => setMessage({ type: "success", text: t.profileSuccess })} onError={(err) => setMessage({ type: "error", text: err })} />}

        {/* Password Tab */}
        {activeTab === "password" && <PasswordTab locale={locale} t={t} onSuccess={() => setMessage({ type: "success", text: t.passwordSuccess })} onError={(err) => setMessage({ type: "error", text: err })} />}

        {/* Subscription Tab */}
        {activeTab === "subscription" && <SubscriptionTab member={member} isTrialActive={isTrialActive} locale={locale} t={t} />}

        {/* Language Tab */}
        {activeTab === "language" && <LanguageTab locale={locale} t={t} isGlobal={isGlobal} />}

        <div className="mt-8 space-y-3">
          <Link
            href={feedbackHref}
            className="block w-full py-3 text-center bg-[#161b22] border border-white/10 text-white rounded-2xl font-bold text-sm hover:border-[#3b82f6] transition-all"
          >
            {t.feedbackLink}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500/20 transition-all"
          >
            {t.logout}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({
  member,
  locale,
  t,
  onSuccess,
  onError,
}: {
  member: Member;
  locale: Locale;
  t: any;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [username, setUsername] = useState(member.username);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      onError(t.usernameRequired);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/members/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.genericError);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card border border-white/10 bg-[#000036] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-black text-white">{t.updateProfileTitle}</h2>

      <div>
        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">{t.usernameLabel}</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-3 bg-[#161b22] border border-white/10 text-white rounded-xl focus:outline-none focus:border-[#3b82f6] transition-all"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">{t.emailLabel}</label>
        <input type="email" value={member.email} disabled className="w-full px-4 py-3 bg-[#0a0e17] border border-white/10 text-white/40 rounded-xl cursor-not-allowed" />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-[#3b82f6] text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
      >
        {saving ? t.savingProfile : t.saveProfile}
      </button>
    </form>
  );
}

function PasswordTab({
  locale,
  t,
  onSuccess,
  onError,
}: {
  locale: Locale;
  t: any;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      onError(t.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      onError(t.passwordsDoNotMatch);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/members/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.genericError);
      setNewPassword("");
      setConfirmPassword("");
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card border border-white/10 bg-[#000036] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-black text-white">{t.changePasswordTitle}</h2>

      <div>
        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">{t.newPasswordLabel}</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t.newPasswordPlaceholder}
          className="w-full px-4 py-3 bg-[#161b22] border border-white/10 text-white rounded-xl focus:outline-none focus:border-[#3b82f6] transition-all placeholder-white/20"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">{t.confirmPasswordLabel}</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t.confirmPasswordPlaceholder}
          className="w-full px-4 py-3 bg-[#161b22] border border-white/10 text-white rounded-xl focus:outline-none focus:border-[#3b82f6] transition-all placeholder-white/20"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-[#3b82f6] text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
      >
        {saving ? t.updatingPassword : t.updatePassword}
      </button>
    </form>
  );
}

function SubscriptionTab({
  member,
  isTrialActive,
  locale,
  t,
}: {
  member: Member;
  isTrialActive: boolean;
  locale: Locale;
  t: any;
}) {
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR");

  return (
    <div className="glass-card border border-white/10 bg-[#000036] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-black text-white">{t.subscriptionTitle}</h2>

      {isTrialActive && <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">{t.trialMessage}</div>}

      <div className="space-y-4 text-sm">
        <Row label={t.subscriptionStatus} value={isTrialActive ? (locale === "en" ? "Free Trial" : "Ücretsiz Deneme") : member.plan} />
        <Row label={t.subscriptionType} value={member.plan} />
        <Row label={t.subscriptionRenewsLabel} value={dateFmt(member.trial_ends_at)} />
      </div>

      <button className="w-full py-3 bg-[#3b82f6] text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all">{t.upgradeButton}</button>
      <a
        href="mailto:support@bogastock.com"
        className="block text-center text-[#3b82f6] text-sm font-bold hover:underline"
      >
        {t.contactSupport}
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-3">
      <span className="text-white/40 text-xs uppercase tracking-widest">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}

function LanguageTab({ locale, t, isGlobal }: { locale: Locale; t: any; isGlobal: boolean }) {
  const router = useRouter();

  const handleLanguageSelect = (lang: string) => {
    if (lang === locale.toUpperCase()) return; 
    
    if (lang === 'EN') {
      router.push(isGlobal ? "/global/en/account" : "/en/account");
    } else if (lang === 'TR') {
      router.push(isGlobal ? "/global/tr/hesabim" : "/tr/hesabim");
    }
  };

  return (
    <div className="glass-card border border-white/10 bg-[#000036] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-black text-white">{t.languageTitle}</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {['EN', 'ES', 'FR', 'PR', 'TR'].map((lang) => {
          const isActive = locale.toUpperCase() === lang;
          const isAvailable = lang === 'EN' || lang === 'TR';

          return (
            <button
              key={lang}
              onClick={() => isAvailable && handleLanguageSelect(lang)}
              disabled={!isAvailable}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                isActive 
                  ? "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]" 
                  : isAvailable 
                    ? "bg-[#161b22] border-white/10 text-white hover:border-white/30" 
                    : "bg-[#161b22]/50 border-white/5 text-white/20 cursor-not-allowed"
              }`}
            >
              <span className="font-black tracking-wider">{lang}</span>
              {isActive && (
                <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
