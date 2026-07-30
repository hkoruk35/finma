"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/copy";

interface ShareButtonProps {
  locale: Locale;
  shareText: string;
  url?: string;
  accent?: string;
}

const LABELS: Record<Locale, { share: string; copyLink: string; linkCopied: string }> = {
  en: { share: "Share", copyLink: "Copy link", linkCopied: "Link copied!" },
  tr: { share: "Paylaş", copyLink: "Linki kopyala", linkCopied: "Link kopyalandı!" },
  es: { share: "Compartir", copyLink: "Copiar enlace", linkCopied: "¡Enlace copiado!" },
  fr: { share: "Partager", copyLink: "Copier le lien", linkCopied: "Lien copié !" },
  pt: { share: "Compartilhar", copyLink: "Copiar link", linkCopied: "Link copiado!" },
};

export default function ShareButton({ locale, shareText, url, accent = "#3b82f6" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = LABELS[locale];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const links = {
    x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  // Mobile browsers (iOS Safari, Android Chrome) expose navigator.share,
  // which opens the OS-level share sheet — this is the only way to offer
  // Instagram (Stories/DM) as a share target, since Instagram has no web
  // share-intent URL like X/LinkedIn/WhatsApp do. Desktop browsers mostly
  // lack navigator.share, so they fall back to the manual link menu below.
  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "BOGA AI", text: shareText, url: shareUrl });
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleButtonClick}
        title={t.share}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1e293b] border transition-all duration-200 hover:bg-white/5"
        style={{ borderColor: `${accent}4d`, color: accent }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path strokeLinecap="round" d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-44 rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl overflow-hidden z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <a href={links.x} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            X (Twitter)
          </a>
          <a href={links.linkedin} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            LinkedIn
          </a>
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            WhatsApp
          </a>
          <a href={links.telegram} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            Telegram
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="block w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white border-t border-[#1e2a3a]"
          >
            {copied ? t.linkCopied : t.copyLink}
          </button>
        </div>
      )}
    </div>
  );
}
