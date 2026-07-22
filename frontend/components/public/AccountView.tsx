"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import ConsentCheckbox from "@/components/public/ConsentCheckbox";

type Member = {
  username: string;
  email: string;
  trial_ends_at: string | null;
  plan: string;
  last_login_at: string | null;
  created_at: string;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  region?: string | null;
};

type Tab = "profile" | "password" | "subscription" | "language";

export default function AccountView({ locale, isGlobal = false }: { locale: Locale; isGlobal?: boolean }) {
  const t = copy[locale].account;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "subscription") setActiveTab("subscription");
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      setMessage({
        type: "success",
        text:
          locale === "tr"
            ? "Ödeme bilgileriniz kaydedildi. Aboneliğiniz aktif."
            : locale === "es"
              ? "Tu información de pago se guardó. Tu suscripción está activa."
              : locale === "fr"
                ? "Vos informations de paiement ont été enregistrées. Votre abonnement est actif."
                : locale === "pt"
                  ? "Suas informações de pagamento foram salvas. Sua assinatura está ativa."
                  : "Your payment details were saved. Your subscription is active.",
      });
    } else if (checkout === "cancelled") {
      setMessage({
        type: "error",
        text:
          locale === "tr"
            ? "Ödeme tamamlanmadı. Devam etmek için tekrar deneyebilirsiniz."
            : locale === "es"
              ? "El pago no se completó. Puedes intentarlo de nuevo para continuar."
              : locale === "fr"
                ? "Le paiement n'a pas été finalisé. Vous pouvez réessayer pour continuer."
                : locale === "pt"
                  ? "O pagamento não foi concluído. Você pode tentar novamente para continuar."
                  : "Payment was not completed. You can try again to continue.",
      });
    }
  }, [searchParams, locale]);
  const feedbackHref = locale === "en" ? "/en/account/feedback" : locale === "tr" ? "/tr/hesabim/geri-bildirim" : `/global/${locale}/account`;
  const loginHref = isGlobal
    ? (locale === "tr" ? "/global/tr/giris" : `/global/${locale}/login`)
    : (locale === "tr" ? "/tr/giris" : `/global/${locale}/login`);

  const refreshMember = () =>
    fetch("/api/members/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMember(data.member))
      .catch(() => {});

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMember(data.member))
      .catch(() => router.push(loginHref))
      .finally(() => setLoading(false));
  }, [router, loginHref]);

  const handleLogout = async () => {
    await fetch("/api/members/logout", { method: "POST" }).catch(() => {});
    router.push(loginHref);
  };

  if (loading) {
    return (
      <div className={`${isGlobal ? "h-[60vh]" : "min-h-screen"} flex items-center justify-center bg-[#010409] text-white/50 text-sm`}>
        {t.loading}
      </div>
    );
  }

  if (!member) return null;

  const localeTag = (l: Locale) =>
    l === "en" ? "en-US" : l === "es" ? "es-ES" : l === "fr" ? "fr-FR" : l === "pt" ? "pt-BR" : "tr-TR";
  const dateFmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(localeTag(locale)) : "—";

  const isTrialActive = !!member.trial_ends_at && new Date(member.trial_ends_at) > new Date();

  return (
    <div className={`${isGlobal ? "flex-1" : "min-h-screen"} bg-[#010409] font-sans px-4 py-12`}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold text-white tracking-tighter mb-8 text-center">{t.title}</h1>

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
              className={`px-4 py-2 font-medium text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
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
        {activeTab === "subscription" && (
          <SubscriptionTab
            member={member}
            isTrialActive={isTrialActive}
            locale={locale}
            t={t}
            onSuccess={(text) => setMessage({ type: "success", text })}
            onError={(text) => setMessage({ type: "error", text })}
            onRefresh={refreshMember}
          />
        )}

        {/* Language Tab */}
        {activeTab === "language" && <LanguageTab locale={locale} t={t} isGlobal={isGlobal} />}

        <div className="mt-8 space-y-3">
          <Link
            href={feedbackHref}
            className="block w-full py-3 text-center bg-[#161b22] border border-white/10 text-white rounded-2xl font-medium text-sm hover:border-[#3b82f6] transition-all"
          >
            {t.feedbackLink}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-medium uppercase tracking-widest text-xs hover:bg-red-500/20 transition-all"
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
  const [region, setRegion] = useState(member.region || "");
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
        body: JSON.stringify({ username, region }),
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
    <form onSubmit={handleSubmit} className="glass-card border border-white/10 bg-[#0d1117] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-semibold text-white">{t.updateProfileTitle}</h2>

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

      <div>
        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">{locale === "tr" ? "ÜLKE" : locale === "es" ? "PAÍS" : locale === "fr" ? "PAYS" : locale === "pt" ? "PAÍS" : "COUNTRY"}</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full px-4 py-3 bg-[#161b22] border border-white/10 text-white rounded-xl focus:outline-none focus:border-[#3b82f6] transition-all appearance-none"
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

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
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
    <form onSubmit={handleSubmit} className="glass-card border border-white/10 bg-[#0d1117] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-semibold text-white">{t.changePasswordTitle}</h2>

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
        className="w-full py-3 bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
      >
        {saving ? t.updatingPassword : t.updatePassword}
      </button>
    </form>
  );
}

function TrialCountdownBadge({ trialEndsAt, locale }: { trialEndsAt: string; locale: Locale }) {
  const endMs = new Date(trialEndsAt).getTime();
  const [secsLeft, setSecsLeft] = useState(() => Math.max(0, Math.floor((endMs - Date.now()) / 1000)));

  useEffect(() => {
    if (secsLeft <= 0) return;
    const id = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secsLeft]);

  if (secsLeft <= 0) return null;

  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  const secs = secsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const label = locale === "tr" ? "Deneme süreniz bitiyor:" : locale === "es" ? "Tu prueba expira en:" : locale === "fr" ? "Votre essai expire dans :" : locale === "pt" ? "Seu teste expira em:" : "Your trial expires in:";
  const countdownStr = locale === "tr"
    ? `${days}g ${pad(hours)}s ${pad(mins)}d ${pad(secs)}sn`
    : `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;

  return (
    <div className="rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-5 flex flex-col sm:flex-row items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex-shrink-0">
        <svg className="w-6 h-6 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-[11px] text-[#f59e0b]/70 font-medium uppercase tracking-widest mb-1">{label}</p>
        <p className="font-mono font-medium text-[#f59e0b] text-2xl tracking-wider">{countdownStr}</p>
      </div>
    </div>
  );
}

// Kısa, 5 dilli metin yardımcı fonksiyonu (dosyadaki mevcut inline ternary stiliyle uyumlu, tekrarı azaltır).
function L(locale: Locale, en: string, tr: string, es: string, fr: string, pt: string): string {
  return locale === "tr" ? tr : locale === "es" ? es : locale === "fr" ? fr : locale === "pt" ? pt : en;
}

function SubscriptionTab({
  member,
  isTrialActive,
  locale,
  t,
  onSuccess,
  onError,
  onRefresh,
}: {
  member: Member;
  isTrialActive: boolean;
  locale: Locale;
  t: any;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
  onRefresh: () => void;
}) {
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "pt" ? "pt-BR" : "tr-TR");
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const genericError = L(
    locale,
    "Something went wrong. Please try again.",
    "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
    "Algo salió mal. Inténtalo de nuevo.",
    "Une erreur s'est produite. Veuillez réessayer.",
    "Algo deu errado. Tente novamente."
  );

  const startCheckout = async () => {
    if (!consentChecked) {
      setConsentTouched(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/members/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, consentAccepted: consentChecked }),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        onError(data.error ?? genericError);
      }
    } catch {
      onError(genericError);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    const confirmMsg = L(
      locale,
      "Cancel your membership? You'll keep access until the current period ends, and no refunds are issued.",
      "Üyeliğinizi iptal etmek istiyor musunuz? Mevcut dönem sonuna kadar erişiminiz devam eder, iade yapılmaz.",
      "¿Cancelar tu membresía? Mantendrás el acceso hasta que termine el periodo actual y no hay reembolsos.",
      "Annuler votre abonnement ? Vous conservez l'accès jusqu'à la fin de la période en cours, sans remboursement.",
      "Cancelar sua assinatura? Você mantém o acesso até o fim do período atual, sem reembolsos."
    );
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/members/subscription/cancel", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onSuccess(
          L(
            locale,
            "Your membership will end at the current period's close.",
            "Üyeliğiniz mevcut dönem sonunda sona erecek.",
            "Tu membresía terminará al final del periodo actual.",
            "Votre abonnement prendra fin à la clôture de la période actuelle.",
            "Sua assinatura terminará no fim do período atual."
          )
        );
        onRefresh();
      } else {
        onError(data.error ?? genericError);
      }
    } catch {
      onError(genericError);
    } finally {
      setBusy(false);
    }
  };

  const handleReactivate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/members/subscription/reactivate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onSuccess(
          L(
            locale,
            "Your membership has been resumed.",
            "Üyeliğiniz yeniden aktifleştirildi.",
            "Tu membresía ha sido reactivada.",
            "Votre abonnement a été réactivé.",
            "Sua assinatura foi reativada."
          )
        );
        onRefresh();
      } else {
        onError(data.error ?? genericError);
      }
    } catch {
      onError(genericError);
    } finally {
      setBusy(false);
    }
  };

  const isAdmin = member.plan === "admin";
  const isLegacyFreeTrial = !isAdmin && !member.subscription_status && !!member.trial_ends_at;
  const status = member.subscription_status;

  const statusLabel = isAdmin
    ? L(locale, "Admin", "Yönetici", "Administrador", "Administrateur", "Administrador")
    : isLegacyFreeTrial
    ? L(locale, "Free Trial", "Ücretsiz Deneme", "Prueba Gratuita", "Essai Gratuit", "Teste Gratuito")
    : status === "pending"
      ? L(locale, "Payment Required", "Ödeme Gerekli", "Pago Requerido", "Paiement Requis", "Pagamento Necessário")
      : status === "trialing"
        ? L(locale, "Free Trial (card on file)", "Ücretsiz Deneme (kart kayıtlı)", "Prueba Gratuita (tarjeta registrada)", "Essai Gratuit (carte enregistrée)", "Teste Gratuito (cartão registrado)")
        : status === "active"
          ? L(locale, "Active", "Aktif", "Activa", "Actif", "Ativa")
          : status === "past_due"
            ? L(locale, "Payment Failed", "Ödeme Başarısız", "Pago Fallido", "Paiement Échoué", "Pagamento Falhou")
            : status === "canceled"
              ? L(locale, "Canceled", "İptal Edildi", "Cancelada", "Annulé", "Cancelada")
              : member.plan;

  return (
    <div className="glass-card border border-white/10 bg-[#0d1117] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-semibold text-white">{t.subscriptionTitle}</h2>

      {/* Live countdown for trial users (legacy or Stripe trial) */}
      {isTrialActive && member.trial_ends_at && (
        <TrialCountdownBadge trialEndsAt={member.trial_ends_at} locale={locale} />
      )}

      <div className="space-y-4 text-sm">
        <Row label={t.subscriptionStatus} value={statusLabel} />
        <Row label={t.subscriptionType} value={member.plan} />
        {(status === "trialing" || status === "active") && member.current_period_end && (
          <Row label={t.subscriptionRenewsLabel} value={dateFmt(member.current_period_end)} />
        )}
        {isLegacyFreeTrial && member.trial_ends_at && (
          <Row label={t.subscriptionRenewsLabel} value={dateFmt(member.trial_ends_at)} />
        )}
      </div>

      {isAdmin && (
        <div className="rounded-2xl bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 p-5 text-sm text-white/60">
          {L(
            locale,
            "Admin account — unrestricted, unlimited access to all features. No billing applies.",
            "Yönetici hesabı — tüm özelliklere sınırsız erişim. Faturalandırma uygulanmaz.",
            "Cuenta de administrador — acceso ilimitado a todas las funciones. No se aplica facturación.",
            "Compte administrateur — accès illimité à toutes les fonctionnalités. Aucune facturation applicable.",
            "Conta de administrador — acesso ilimitado a todos os recursos. Nenhuma cobrança aplicável."
          )}
        </div>
      )}

      {/* Pending payment: registration completed but card not captured yet */}
      {!isAdmin && status === "pending" && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 p-5">
            <div className="text-[#3b82f6] font-medium text-xl tracking-tight mb-1">
              {L(locale, "FIRST MONTH ONLY $9", "İLK AY SADECE $9", "PRIMER MES SOLO $9", "PREMIER MOIS À 9$ SEULEMENT", "PRIMEIRO MÊS POR APENAS $9")}
            </div>
            <div className="text-xs text-slate-500">
              {L(
                locale,
                "7-day free trial, card required — then $9 for the first month, $39/mo after.",
                "7 gün ücretsiz deneme, kart gerekli — ardından ilk ay $9, sonrasında $39/ay.",
                "7 días de prueba gratis, tarjeta requerida — luego $9 por el primer mes, $39/mes después.",
                "Essai gratuit de 7 jours, carte requise — puis 9$ pour le premier mois, 39$/mois ensuite.",
                "7 dias de teste grátis, cartão necessário — depois $9 pelo primeiro mês, $39/mês em seguida."
              )}
            </div>
          </div>
          <ConsentCheckbox locale={locale} checked={consentChecked} onChange={(c) => { setConsentChecked(c); if (c) setConsentTouched(false); }} showError={consentTouched} />
          <button
            onClick={startCheckout}
            disabled={busy}
            className="w-full py-3 bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
          >
            {L(locale, "Complete Payment", "Ödemeyi Tamamla", "Completar Pago", "Finaliser le Paiement", "Concluir Pagamento")}
          </button>
        </>
      )}

      {/* Legacy free trial (pre-Stripe accounts): offer upgrade */}
      {isLegacyFreeTrial && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 p-5">
            <div className="text-[#3b82f6] font-medium text-xl tracking-tight mb-1">
              {L(locale, "FIRST MONTH ONLY $9", "İLK AY SADECE $9", "PRIMER MES SOLO $9", "PREMIER MOIS À 9$ SEULEMENT", "PRIMEIRO MÊS POR APENAS $9")}
            </div>
            <div className="text-xs text-slate-500">
              {L(locale, "Limited offer — regular price $39/mo", "Sınırlı sayıda — normal fiyat $39/ay", "Oferta limitada — precio regular $39/mes", "Offre limitée — prix normal $39/mois", "Oferta limitada — preço normal $39/mês")}
            </div>
          </div>
          <ConsentCheckbox locale={locale} checked={consentChecked} onChange={(c) => { setConsentChecked(c); if (c) setConsentTouched(false); }} showError={consentTouched} />
          <button
            onClick={startCheckout}
            disabled={busy}
            className="w-full py-3 bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
          >
            {t.upgradeButton}
          </button>
        </>
      )}

      {/* Trialing or active: show cancel / cancellation notice */}
      {(status === "trialing" || status === "active") && (
        <>
          {!member.cancel_at_period_end ? (
            <>
              {status === "trialing" && (
                <p className="text-xs text-slate-500">
                  {L(
                    locale,
                    "After your trial: $9 for the first month, then $39/mo. Cancel anytime.",
                    "Denemeniz bitince: ilk ay $9, sonrasında $39/ay. İstediğiniz an iptal edebilirsiniz.",
                    "Al terminar tu prueba: $9 por el primer mes, luego $39/mes. Cancela cuando quieras.",
                    "À la fin de votre essai : 9$ pour le premier mois, puis 39$/mois. Annulez à tout moment.",
                    "Ao fim do teste: $9 pelo primeiro mês, depois $39/mês. Cancele quando quiser."
                  )}
                </p>
              )}
              <button
                onClick={handleCancel}
                disabled={busy}
                className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {L(locale, "Cancel Membership", "Üyeliği İptal Et", "Cancelar Membresía", "Annuler l'Abonnement", "Cancelar Assinatura")}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-400 text-xs font-semibold">
                {L(
                  locale,
                  `Your membership ends on ${member.current_period_end ? dateFmt(member.current_period_end) : ""}. You won't be charged again.`,
                  `Üyeliğiniz ${member.current_period_end ? dateFmt(member.current_period_end) : ""} tarihinde sona erecek. Tekrar ücret alınmayacak.`,
                  `Tu membresía termina el ${member.current_period_end ? dateFmt(member.current_period_end) : ""}. No se te cobrará de nuevo.`,
                  `Votre abonnement se termine le ${member.current_period_end ? dateFmt(member.current_period_end) : ""}. Vous ne serez plus facturé.`,
                  `Sua assinatura termina em ${member.current_period_end ? dateFmt(member.current_period_end) : ""}. Você não será cobrado novamente.`
                )}
              </div>
              <button
                onClick={handleReactivate}
                disabled={busy}
                className="w-full py-3 bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
              >
                {L(locale, "Resume Membership", "Üyeliği Devam Ettir", "Reanudar Membresía", "Reprendre l'Abonnement", "Retomar Assinatura")}
              </button>
            </>
          )}
        </>
      )}

      {/* Payment failed */}
      {status === "past_due" && (
        <>
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-xs font-semibold">
            {L(
              locale,
              "Your last payment failed. Please update your payment method to keep your access.",
              "Son ödemeniz başarısız oldu. Erişiminizin devam etmesi için ödeme yönteminizi güncelleyin.",
              "Tu último pago falló. Actualiza tu método de pago para mantener el acceso.",
              "Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver l'accès.",
              "Seu último pagamento falhou. Atualize sua forma de pagamento para manter o acesso."
            )}
          </div>
          <a
            href="mailto:support@bogastock.com"
            className="block w-full py-3 text-center bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all"
          >
            {L(locale, "Contact Support", "Destek ile İletişime Geç", "Contactar Soporte", "Contacter le Support", "Contatar Suporte")}
          </a>
        </>
      )}

      {/* Fully canceled: offer resubscribe (no trial) */}
      {status === "canceled" && (
        <>
          <p className="text-xs text-slate-500">
            {L(
              locale,
              "Your membership has ended. Resubscribing starts a new $39/mo plan immediately (no trial).",
              "Üyeliğiniz sona erdi. Yeniden abone olduğunuzda hemen $39/ay plan başlar (deneme yok).",
              "Tu membresía ha terminado. Al resuscribirte, el plan de $39/mes comienza de inmediato (sin prueba).",
              "Votre abonnement a pris fin. Se réabonner démarre immédiatement un plan à $39/mois (sans essai).",
              "Sua assinatura terminou. Ao reassinar, o plano de $39/mês começa imediatamente (sem teste)."
            )}
          </p>
          <ConsentCheckbox locale={locale} checked={consentChecked} onChange={(c) => { setConsentChecked(c); if (c) setConsentTouched(false); }} showError={consentTouched} />
          <button
            onClick={startCheckout}
            disabled={busy}
            className="w-full py-3 bg-[#3b82f6] text-white font-medium uppercase tracking-widest text-xs rounded-2xl hover:bg-[#2563eb] transition-all disabled:opacity-50"
          >
            {L(locale, "Resubscribe", "Yeniden Abone Ol", "Volver a Suscribirse", "Se Réabonner", "Assinar Novamente")}
          </button>
        </>
      )}

      <a
        href="mailto:support@bogastock.com"
        className="block text-center text-[#3b82f6] text-sm font-medium hover:underline"
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
      <span className="text-white font-medium">{value}</span>
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
    } else if (lang === 'ES') {
      router.push(isGlobal ? "/global/es/account" : "/es/account");
    } else if (lang === 'FR') {
      router.push(isGlobal ? "/global/fr/account" : "/fr/account");
    } else if (lang === 'PT') {
      router.push(isGlobal ? "/global/pt/account" : "/pt/account");
    }
  };

  return (
    <div className="glass-card border border-white/10 bg-[#0d1117] rounded-3xl p-8 space-y-6">
      <h2 className="text-xl font-semibold text-white">{t.languageTitle}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {['EN', 'ES', 'FR', 'PT', 'TR'].map((lang) => {
          const isActive = locale.toUpperCase() === lang;
          const isAvailable = lang === 'EN' || lang === 'TR' || lang === 'ES' || lang === 'FR' || lang === 'PT';

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
              <span className="font-medium tracking-wider">{lang}</span>
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
