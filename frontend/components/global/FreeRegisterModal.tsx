"use client";

import { useState, useEffect } from "react";
import type { Locale } from "@/lib/i18n/copy";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface Props {
  locale: Locale;
  onClose: () => void;
  titleOverride?: string;
  descriptionOverride?: string;
}

const COPY = {
  tr: {
    badge: "ÜCRETSİZ ÖZELLİK",
    title: "4, 6 ve 9 Çoklu Ekran Görünümü",
    desc: "Anonim ziyaretçiler en fazla 2 çoklu ekran kullanabilir. 4, 6 ve 9 ekran görünümlerini kullanmak için hemen ücretsiz Google girişi yapın veya kaydolun!",
    googleBtn: "Google ile Ücretsiz Giriş Yap",
    emailBtn: "E-posta ile Ücretsiz Kaydol",
    close: "Kapat",
  },
  en: {
    badge: "FREE FEATURE",
    title: "4, 6 and 9 Multi-Screen View",
    desc: "Anonymous visitors can use up to 2 multi-screens. Sign in with Google or create a free account to unlock 4, 6, and 9 screen views!",
    googleBtn: "Sign in with Google (Free)",
    emailBtn: "Register with Email (Free)",
    close: "Close",
  },
  es: {
    badge: "FUNCIÓN GRATUITA",
    title: "Vista Multigráfica de 4, 6 y 9 Pantallas",
    desc: "Los visitantes anónimos pueden usar hasta 2 pantallas. Inicie sesión con Google o cree una cuenta gratuita para desbloquear vistas de 4, 6 y 9 pantallas.",
    googleBtn: "Iniciar sesión con Google (Gratis)",
    emailBtn: "Registrarse con Correo (Gratis)",
    close: "Cerrar",
  },
  fr: {
    badge: "FONCTIONNALITÉ GRATUITE",
    title: "Vue Multi-Écrans 4, 6 et 9 Écrans",
    desc: "Les visiteurs anonymes peuvent utiliser jusqu'à 2 écrans. Connectez-vous avec Google ou créez un compte gratuit pour débloquer les vues 4, 6 et 9 écrans !",
    googleBtn: "Se connecter avec Google (Gratuit)",
    emailBtn: "S'inscrire par e-mail (Gratuit)",
    close: "Fermer",
  },
  pt: {
    badge: "RECURSO GRATUITO",
    title: "Visualização Multitelas de 4, 6 e 9 Telas",
    desc: "Visitantes anônimos podem usar até 2 telas. Faça login com o Google ou crie uma conta gratuita para desbloquear visualizações de 4, 6 e 9 telas!",
    googleBtn: "Entrar com o Google (Grátis)",
    emailBtn: "Registrar-se com E-mail (Grátis)",
    close: "Fechar",
  },
  id: {
    badge: "FITUR GRATIS",
    title: "Tampilan Multi-Layar 4, 6, dan 9",
    desc: "Pengunjung anonim hanya dapat menggunakan hingga 2 layar. Masuk dengan Google atau buat akun gratis untuk membuka tampilan 4, 6, dan 9 layar!",
    googleBtn: "Masuk dengan Google (Gratis)",
    emailBtn: "Daftar dengan Email (Gratis)",
    close: "Tutup",
  },
};

export default function FreeRegisterModal({ locale, onClose, titleOverride, descriptionOverride }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const [googleLoading, setGoogleLoading] = useState(false);

  const registerHref = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?locale=${locale}` },
      });
    } catch {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-14 sm:pt-28 overflow-y-auto"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md bg-[#0d1117] border border-[#1e2a3a] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#3b82f6] via-[#10b981] to-[#3b82f6]" />

        <div className="p-6">
          {/* Header row with icon and close button */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
              aria-label={c.close}
            >
              ✕
            </button>
          </div>

          <div className="inline-block px-2.5 py-1 rounded-md bg-[#10b981]/10 border border-[#10b981]/30 text-[11px] font-bold text-[#10b981] mb-2 tracking-wider">
            {c.badge}
          </div>

          <h2 className="text-lg font-semibold text-white mb-2 tracking-tight">{titleOverride ?? c.title}</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">{descriptionOverride ?? c.desc}</p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-white !text-[#1e3a8a] hover:bg-slate-100 transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-3 border border-slate-200 cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {googleLoading ? "..." : c.googleBtn}
            </button>

            <a
              href={registerHref}
              className="w-full text-center py-3 px-4 rounded-xl font-medium text-sm bg-[#1e2a3a] text-slate-200 hover:text-white hover:bg-[#2a3a4e] border border-[#2e3e52] transition-colors"
            >
              {c.emailBtn}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
