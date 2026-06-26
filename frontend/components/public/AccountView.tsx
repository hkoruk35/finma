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

export default function AccountView({ locale }: { locale: Locale }) {
  const t = copy[locale].account;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const feedbackHref = locale === "en" ? "/en/account/feedback" : "/tr/hesabim/geri-bildirim";
  const loginHref = locale === "en" ? "/en/login" : "/tr/giris";

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMember(data.member))
      .catch(() => router.push(loginHref))
      .finally(() => setLoading(false));
  }, [router, loginHref]);

  const handleLogout = async () => {
    await fetch("/api/members/logout", { method: "POST" }).catch(() => {});
    router.push(locale === "en" ? "/en" : "/tr");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#010409] text-white/50 text-sm">
        {t.loading}
      </div>
    );
  }

  if (!member) return null;

  const dateFmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR") : "—";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#010409] font-sans px-4 py-12">
      <div className="w-full max-w-md p-8 glass-card border border-white/10 bg-[#0d1117] rounded-3xl shadow-2xl">
        <h1 className="text-2xl font-black text-white tracking-tighter mb-6 text-center">{t.title}</h1>

        <div className="space-y-4 text-sm">
          <Row label={t.usernameLabel} value={member.username} />
          <Row label={t.emailLabel} value={member.email} />
          <Row label={t.planLabel} value={member.plan} />
          <Row label={t.trialEndsLabel} value={dateFmt(member.trial_ends_at)} />
          <Row label={t.lastLoginLabel} value={dateFmt(member.last_login_at)} />
        </div>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-3">
      <span className="text-white/40 text-xs uppercase tracking-widest">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}
