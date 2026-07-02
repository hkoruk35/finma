"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ── i18n ─────────────────────────────────────────────────────────────────────
const copy = {
  en: {
    loading: "Loading…",
    title: "My Account",
    tabs: { profile: "Profile", password: "Password", subscription: "Subscription" },
    profile: {
      heading: "Profile Information",
      username: "Username",
      email: "Email",
      usernamePlaceholder: "your_username",
      saveBtn: "Save Changes",
      saving: "Saving…",
      successMsg: "Username updated successfully.",
    },
    password: {
      heading: "Change Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      placeholder: "Min. 8 characters",
      confirmPlaceholder: "Repeat new password",
      mismatch: "Passwords do not match.",
      tooShort: "Password must be at least 8 characters.",
      saveBtn: "Change Password",
      saving: "Changing…",
      successMsg: "Password changed successfully.",
    },
    subscription: {
      heading: "Subscription & Plan",
      plan: "Current Plan",
      status: "Status",
      trialEnds: "Trial Ends",
      memberSince: "Member Since",
      trialActive: "Free Trial Active",
      trialExpired: "Trial Expired",
      starterPlan: "Starter (Free)",
      proPlan: "Pro",
      upgradeHeading: "Upgrade to Pro",
      upgradeDesc: "After your 7-day free trial, unlock unlimited access to all BOGA AI features including full Top 100 Tracker, deep stock analysis, and priority signals.",
      upgradeBtn: "Coming Soon",
      upgradeNote: "Paid plans will be available shortly. Your free access continues until then.",
    },
    logout: "Log Out",
    backToTop100: "← Back to Top 100",
  },
  tr: {
    loading: "Yükleniyor…",
    title: "Hesabım",
    tabs: { profile: "Profil", password: "Şifre", subscription: "Abonelik" },
    profile: {
      heading: "Profil Bilgileri",
      username: "Kullanıcı Adı",
      email: "E-posta",
      usernamePlaceholder: "kullanici_adi",
      saveBtn: "Kaydet",
      saving: "Kaydediliyor…",
      successMsg: "Kullanıcı adı başarıyla güncellendi.",
    },
    password: {
      heading: "Şifre Değiştir",
      newPassword: "Yeni Şifre",
      confirmPassword: "Şifreyi Onayla",
      placeholder: "Min. 8 karakter",
      confirmPlaceholder: "Yeni şifreyi tekrarlayın",
      mismatch: "Şifreler eşleşmiyor.",
      tooShort: "Şifre en az 8 karakter olmalıdır.",
      saveBtn: "Şifreyi Değiştir",
      saving: "Değiştiriliyor…",
      successMsg: "Şifre başarıyla değiştirildi.",
    },
    subscription: {
      heading: "Abonelik & Plan",
      plan: "Mevcut Plan",
      status: "Durum",
      trialEnds: "Deneme Bitiş",
      memberSince: "Üyelik Tarihi",
      trialActive: "Ücretsiz Deneme Aktif",
      trialExpired: "Deneme Süresi Doldu",
      starterPlan: "Starter (Ücretsiz)",
      proPlan: "Pro",
      upgradeHeading: "Pro'ya Geç",
      upgradeDesc: "7 günlük ücretsiz denemenizin ardından BOGA AI'ın tüm özelliklerine sınırsız erişim kazanın: tam Top 100 Tracker, derin hisse analizi ve öncelikli sinyaller.",
      upgradeBtn: "Yakında",
      upgradeNote: "Ücretli planlar yakında kullanıma açılacak. O zamana kadar ücretsiz erişiminiz devam eder.",
    },
    logout: "Çıkış Yap",
    backToTop100: "← Top 100'e Dön",
  },
} as const;

type Locale = "en" | "tr";

type Member = {
  username: string;
  email: string;
  trial_ends_at: string;
  plan: string;
  last_login_at: string | null;
  created_at: string;
};

// ── Helper components ─────────────────────────────────────────────────────────

function SuccessBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-xl font-semibold animate-pulse">
      ✓ {msg}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl font-semibold">
      {msg}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GlobalAccountView({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const router = useRouter();
  const loginHref = locale === "en" ? "/global/en/login" : "/global/tr/giris";
  const top100Href = locale === "en" ? "/global/en/top100" : "/global/tr/top100";

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "password" | "subscription">("profile");

  // Profile state
  const [username, setUsername] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/members/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setMember(d.member);
        setUsername(d.member.username);
      })
      .catch(() => router.push(loginHref))
      .finally(() => setLoading(false));
  }, [router, loginHref]);

  const handleLogout = async () => {
    await fetch("/api/members/logout", { method: "POST" }).catch(() => {});
    router.push(loginHref);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess(false);
    setProfileLoading(true);
    try {
      const res = await fetch("/api/members/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileSuccess(true);
        setMember((m) => m ? { ...m, username } : m);
      } else {
        setProfileError(data.error ?? "Error");
      }
    } catch {
      setProfileError("Network error.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess(false);
    if (newPassword.length < 8) { setPassError(t.password.tooShort); return; }
    if (newPassword !== confirmPassword) { setPassError(t.password.mismatch); return; }
    setPassLoading(true);
    try {
      const res = await fetch("/api/members/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPassError(data.error ?? "Error");
      }
    } catch {
      setPassError("Network error.");
    } finally {
      setPassLoading(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#010409]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1e2a3a] border-t-[#3b82f6] rounded-full animate-spin" />
          <span className="text-white/40 text-sm">{t.loading}</span>
        </div>
      </div>
    );
  }

  if (!member) return null;

  // ── Subscription helpers ──────────────────────────────────────────────────

  const trialEndsAt = new Date(member.trial_ends_at);
  const now = new Date();
  const trialActive = trialEndsAt > now;
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const dateFmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const TABS = [
    { key: "profile" as const, label: t.tabs.profile },
    { key: "password" as const, label: t.tabs.password },
    { key: "subscription" as const, label: t.tabs.subscription },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 bg-[#010409] font-sans px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative flex-shrink-0">
              <Image src="/finmawave.png" alt="BOGA AI" width={40} height={40} className="rounded-xl object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter">{t.title}</h1>
              <p className="text-xs text-white/40">@{member.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(top100Href)}
              className="text-xs text-[#3b82f6] hover:underline"
            >
              {t.backToTop100}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-red-500/20 transition-all"
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[#000036] border border-[#1e2a3a] rounded-2xl p-1 mb-6">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                tab === tb.key
                  ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* ── Profile Tab ───────────────────────────────────────────────── */}
        {tab === "profile" && (
          <div className="bg-[#000036] border border-[#1e2a3a] rounded-2xl p-6">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6">{t.profile.heading}</h2>
            <form onSubmit={handleProfileSave} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                  {t.profile.email}
                </label>
                <div className="w-full bg-[#161b22] border border-white/5 rounded-2xl px-5 py-4 text-white/50 text-sm select-none cursor-not-allowed">
                  {member.email}
                </div>
                <p className="text-xs text-white/20 mt-1 ml-1">Email cannot be changed.</p>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                  {t.profile.username}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.profile.usernamePlaceholder}
                  className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all text-sm"
                  minLength={3}
                  maxLength={24}
                  required
                />
              </div>
              {profileError && <ErrorBanner msg={profileError} />}
              {profileSuccess && <SuccessBanner msg={t.profile.successMsg} />}
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-4 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all disabled:opacity-60"
              >
                {profileLoading ? t.profile.saving : t.profile.saveBtn}
              </button>
            </form>
          </div>
        )}

        {/* ── Password Tab ──────────────────────────────────────────────── */}
        {tab === "password" && (
          <div className="bg-[#000036] border border-[#1e2a3a] rounded-2xl p-6">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6">{t.password.heading}</h2>
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                  {t.password.newPassword}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t.password.placeholder}
                  className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all text-sm"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                  {t.password.confirmPassword}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.password.confirmPlaceholder}
                  className={`w-full bg-[#161b22] border rounded-2xl px-5 py-4 text-white focus:outline-none transition-all text-sm ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-[#3b82f6]"
                  }`}
                  minLength={8}
                  required
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-400 mt-1 ml-1">{t.password.mismatch}</p>
                )}
              </div>
              {passError && <ErrorBanner msg={passError} />}
              {passSuccess && <SuccessBanner msg={t.password.successMsg} />}
              <button
                type="submit"
                disabled={passLoading}
                className="w-full py-4 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all disabled:opacity-60"
              >
                {passLoading ? t.password.saving : t.password.saveBtn}
              </button>
            </form>
          </div>
        )}

        {/* ── Subscription Tab ──────────────────────────────────────────── */}
        {tab === "subscription" && (
          <div className="space-y-4">
            {/* Plan summary */}
            <div className="bg-[#000036] border border-[#1e2a3a] rounded-2xl p-6">
              <h2 className="text-sm font-black text-white uppercase tracking-widest mb-5">{t.subscription.heading}</h2>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label={t.subscription.plan} value={member.plan === "starter" ? t.subscription.starterPlan : t.subscription.proPlan} />
                <InfoRow
                  label={t.subscription.status}
                  value={trialActive ? t.subscription.trialActive : t.subscription.trialExpired}
                  valueClass={trialActive ? "text-green-400" : "text-red-400"}
                />
                <InfoRow
                  label={t.subscription.trialEnds}
                  value={`${dateFmt(member.trial_ends_at)}${trialActive ? ` (${daysLeft}d)` : ""}`}
                  valueClass={trialActive ? "text-amber-400" : "text-white/50"}
                />
                <InfoRow label={t.subscription.memberSince} value={dateFmt(member.created_at)} />
              </div>
            </div>

            {/* Trial progress bar */}
            {member.plan === "starter" && (
              <div className="bg-[#000036] border border-[#1e2a3a] rounded-2xl p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-white/50 uppercase tracking-widest">Trial Progress</span>
                  <span className={`text-xs font-black ${trialActive ? "text-amber-400" : "text-red-400"}`}>
                    {trialActive ? `${daysLeft} ${locale === "en" ? "days left" : "gün kaldı"}` : locale === "en" ? "Expired" : "Süresi Doldu"}
                  </span>
                </div>
                <div className="w-full bg-[#161b22] rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${trialActive ? "bg-gradient-to-r from-amber-500 to-green-500" : "bg-red-500/50"}`}
                    style={{ width: `${Math.max(5, (daysLeft / 7) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white/30 mt-2">7 {locale === "en" ? "day free trial" : "günlük ücretsiz deneme"}</p>
              </div>
            )}

            {/* Upgrade card */}
            <div className="bg-gradient-to-br from-[#3b82f6]/10 via-[#000036] to-[#0a0e17] border border-[#3b82f6]/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⚡</span>
                <h3 className="text-sm font-black text-white tracking-tight">{t.subscription.upgradeHeading}</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed mb-5">{t.subscription.upgradeDesc}</p>
              <button
                disabled
                className="w-full py-3.5 bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#3b82f6]/60 rounded-2xl font-black uppercase tracking-[0.15em] text-xs cursor-not-allowed"
              >
                {t.subscription.upgradeBtn}
              </button>
              <p className="text-xs text-white/30 text-center mt-3">{t.subscription.upgradeNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueClass = "text-white" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-[#161b22] rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label}</div>
      <div className={`text-sm font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
