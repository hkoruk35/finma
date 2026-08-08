"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMemberSession } from "@/hooks/useMemberSession";

type Locale = "tr" | "en" | "es" | "fr" | "pt";

function localeFromPathname(pathname: string | null): Locale {
  if (!pathname) return "en";
  const parts = pathname.split("/");
  if (parts[1] === "global" && ["tr", "en", "es", "fr", "pt"].includes(parts[2])) {
    return parts[2] as Locale;
  }
  return "en";
}

const CATEGORY_KEYS = [
  "bug",
  "data_error",
  "chart_terminal",
  "stock_analysis",
  "copilot",
  "lists",
  "account_login",
  "premium_billing",
  "mobile",
  "design_ux",
  "feature_request",
  "translation",
  "other",
] as const;

function getCopy(locale: Locale) {
  const dict: Record<Locale, any> = {
    tr: {
      trigger: "Geri Bildirim",
      title: "BOGASTOCK Geri Bildirim",
      subtitle: "Görüşünüz, hata bildiriminiz veya öneriniz platformu geliştirmemize yardımcı olur.",
      categoryLabel: "Konu Seçin",
      categoryPlaceholder: "Bir konu seçin...",
      emailLabel: "E-posta Adresiniz",
      emailHint: "Geri bildiriminizle ilgili yanıt verebilmemiz için kullanılır.",
      messageLabel: "Geri Bildiriminizi Yazın",
      screenshotLabel: "Ekran Görüntüsü (opsiyonel)",
      submit: "Gönder",
      submitting: "Gönderiliyor...",
      successTitle: "Geri bildiriminiz alındı",
      successBody: "Teşekkürler! Referans:",
      close: "Kapat",
      genericError: "Gönderilemedi, lütfen tekrar deneyin.",
      categories: {
        bug: "Bug / Teknik Sorun",
        data_error: "Veri Hatası",
        chart_terminal: "Grafik / Terminal",
        stock_analysis: "Hisse Analizi",
        copilot: "BOGA Copilot",
        lists: "Top 100 / Trend Listeleri",
        account_login: "Üyelik / Giriş",
        premium_billing: "Premium / Ödeme",
        mobile: "Mobil Kullanım",
        design_ux: "Tasarım / Kullanıcı Deneyimi",
        feature_request: "Yeni Özellik Önerisi",
        translation: "Dil / Çeviri",
        other: "Diğer",
      },
    },
    en: {
      trigger: "Feedback",
      title: "BOGASTOCK Feedback",
      subtitle: "Your feedback, bug reports, or suggestions help us improve the platform.",
      categoryLabel: "Select a Topic",
      categoryPlaceholder: "Choose a topic...",
      emailLabel: "Your Email",
      emailHint: "Used so we can respond to your feedback.",
      messageLabel: "Write Your Feedback",
      screenshotLabel: "Screenshot (optional)",
      submit: "Submit",
      submitting: "Submitting...",
      successTitle: "Feedback received",
      successBody: "Thank you! Reference:",
      close: "Close",
      genericError: "Could not submit, please try again.",
      categories: {
        bug: "Bug / Technical Issue",
        data_error: "Data Error",
        chart_terminal: "Chart / Terminal",
        stock_analysis: "Stock Analysis",
        copilot: "BOGA Copilot",
        lists: "Top 100 / Trend Lists",
        account_login: "Membership / Login",
        premium_billing: "Premium / Billing",
        mobile: "Mobile Usage",
        design_ux: "Design / UX",
        feature_request: "Feature Request",
        translation: "Language / Translation",
        other: "Other",
      },
    },
    es: {
      trigger: "Comentarios",
      title: "Comentarios de BOGASTOCK",
      subtitle: "Tus comentarios, reportes de errores o sugerencias nos ayudan a mejorar la plataforma.",
      categoryLabel: "Selecciona un Tema",
      categoryPlaceholder: "Elige un tema...",
      emailLabel: "Tu Correo Electrónico",
      emailHint: "Se usa para poder responder a tu comentario.",
      messageLabel: "Escribe tu Comentario",
      screenshotLabel: "Captura de Pantalla (opcional)",
      submit: "Enviar",
      submitting: "Enviando...",
      successTitle: "Comentario recibido",
      successBody: "¡Gracias! Referencia:",
      close: "Cerrar",
      genericError: "No se pudo enviar, inténtalo de nuevo.",
      categories: {
        bug: "Bug / Problema Técnico",
        data_error: "Error de Datos",
        chart_terminal: "Gráfico / Terminal",
        stock_analysis: "Análisis de Acciones",
        copilot: "BOGA Copilot",
        lists: "Top 100 / Listas de Tendencia",
        account_login: "Membresía / Inicio de Sesión",
        premium_billing: "Premium / Facturación",
        mobile: "Uso Móvil",
        design_ux: "Diseño / UX",
        feature_request: "Solicitud de Función",
        translation: "Idioma / Traducción",
        other: "Otro",
      },
    },
    fr: {
      trigger: "Retour",
      title: "Retour BOGASTOCK",
      subtitle: "Vos retours, rapports de bugs ou suggestions nous aident à améliorer la plateforme.",
      categoryLabel: "Sélectionnez un Sujet",
      categoryPlaceholder: "Choisissez un sujet...",
      emailLabel: "Votre E-mail",
      emailHint: "Utilisé pour vous répondre.",
      messageLabel: "Écrivez votre Retour",
      screenshotLabel: "Capture d'écran (optionnel)",
      submit: "Envoyer",
      submitting: "Envoi...",
      successTitle: "Retour reçu",
      successBody: "Merci ! Référence :",
      close: "Fermer",
      genericError: "Échec de l'envoi, veuillez réessayer.",
      categories: {
        bug: "Bug / Problème Technique",
        data_error: "Erreur de Données",
        chart_terminal: "Graphique / Terminal",
        stock_analysis: "Analyse d'Actions",
        copilot: "BOGA Copilot",
        lists: "Top 100 / Listes Tendance",
        account_login: "Adhésion / Connexion",
        premium_billing: "Premium / Facturation",
        mobile: "Utilisation Mobile",
        design_ux: "Design / UX",
        feature_request: "Demande de Fonctionnalité",
        translation: "Langue / Traduction",
        other: "Autre",
      },
    },
    pt: {
      trigger: "Feedback",
      title: "Feedback BOGASTOCK",
      subtitle: "Seu feedback, relatos de bugs ou sugestões nos ajudam a melhorar a plataforma.",
      categoryLabel: "Selecione um Tópico",
      categoryPlaceholder: "Escolha um tópico...",
      emailLabel: "Seu E-mail",
      emailHint: "Usado para podermos responder ao seu feedback.",
      messageLabel: "Escreva seu Feedback",
      screenshotLabel: "Captura de Tela (opcional)",
      submit: "Enviar",
      submitting: "Enviando...",
      successTitle: "Feedback recebido",
      successBody: "Obrigado! Referência:",
      close: "Fechar",
      genericError: "Não foi possível enviar, tente novamente.",
      categories: {
        bug: "Bug / Problema Técnico",
        data_error: "Erro de Dados",
        chart_terminal: "Gráfico / Terminal",
        stock_analysis: "Análise de Ações",
        copilot: "BOGA Copilot",
        lists: "Top 100 / Listas de Tendência",
        account_login: "Associação / Login",
        premium_billing: "Premium / Cobrança",
        mobile: "Uso Móvel",
        design_ux: "Design / UX",
        feature_request: "Solicitação de Recurso",
        translation: "Idioma / Tradução",
        other: "Outro",
      },
    },
  };
  return dict[locale] || dict.en;
}

export default function FeedbackWidget() {
  const pathname = usePathname();
  const locale = localeFromPathname(pathname);
  const t = getCopy(locale);
  const session = useMemberSession();

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<string | null>(null);

  const isLoggedIn = session.authChecked && session.isLoggedIn;
  const lockedEmail = isLoggedIn ? (session.member?.email as string | undefined) : undefined;

  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail);
  }, [lockedEmail]);

  if (pathname?.startsWith("/admin")) return null;

  const resetAndClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setCategory("");
      setMessage("");
      setScreenshot(null);
      setError("");
      setSuccessId(null);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!category) { setError(t.categoryLabel); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t.emailLabel); return; }
    if (message.trim().length < 10) { setError(t.messageLabel); return; }

    setLoading(true);
    try {
      const form = new FormData();
      form.set("category", category);
      form.set("email", email);
      form.set("message", message.trim());
      form.set("page_url", window.location.href);
      form.set("locale", locale);
      form.set("device_type", window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop");
      form.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
      if (screenshot) form.set("screenshot", screenshot);

      const res = await fetch("/api/feedback", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessId(data.id);
      } else {
        setError(data.error || t.genericError);
      }
    } catch {
      setError(t.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group fixed z-[100] flex items-center gap-2 rounded-r-full border border-l-0 border-white/10 bg-[#161b22] text-white/70 shadow-lg transition-all duration-200 hover:text-white hover:border-blue-500/40 hover:pr-4
            left-0 top-1/2 -translate-y-1/2 py-3 px-2.5 hidden sm:flex
            "
          style={{ writingMode: "vertical-rl" }}
          aria-label={t.trigger}
        >
          <span className="text-[11px] font-medium tracking-wide" style={{ writingMode: "vertical-rl" }}>
            {t.trigger}
          </span>
        </button>
      )}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="sm:hidden fixed z-[100] left-4 bottom-20 flex h-11 w-11 items-center justify-center rounded-full bg-[#161b22] border border-white/10 text-white/80 shadow-lg active:scale-95 transition-transform"
          aria-label={t.trigger}
        >
          <span className="text-lg">💬</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:justify-start">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />
          <div className="relative w-full sm:w-[400px] sm:ml-4 max-h-[90dvh] overflow-y-auto bg-[#0d1117] border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-start justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white">{t.title}</h2>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">{t.subtitle}</p>
              </div>
              <button type="button" onClick={resetAndClose} className="shrink-0 text-white/50 hover:text-white p-1" aria-label={t.close}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {successId ? (
              <div className="p-5">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm py-4 px-4 rounded-xl text-center">
                  <div className="font-medium">{t.successTitle}</div>
                  <div className="text-xs text-emerald-400/80 mt-1">{t.successBody} #{successId.slice(0, 8).toUpperCase()}</div>
                </div>
                <button type="button" onClick={resetAndClose} className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-sm font-medium transition-colors">
                  {t.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">{t.categoryLabel}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#161b22] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    disabled={loading}
                  >
                    <option value="">{t.categoryPlaceholder}</option>
                    {CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>{t.categories[key]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">{t.emailLabel}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!lockedEmail}
                    className="w-full bg-[#161b22] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                  <p className="text-[10px] text-white/30 mt-1.5">{t.emailHint}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">{t.messageLabel}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={loading}
                    maxLength={5000}
                    className="w-full bg-[#161b22] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[110px] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-widest text-white/40 mb-2">{t.screenshotLabel}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    disabled={loading}
                    className="w-full text-xs text-white/60 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/80 file:text-xs hover:file:bg-white/20"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2.5 px-3 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? t.submitting : t.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
