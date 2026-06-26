"use client";

import { useState } from "react";
import { copy, type Locale } from "@/lib/i18n/copy";

export default function FeedbackForm({ locale }: { locale: Locale }) {
  const t = copy[locale].feedback;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/members/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();

      if (res.ok) {
        setSent(true);
        setSubject("");
        setBody("");
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
    <div className="min-h-screen flex items-center justify-center bg-[#010409] font-sans px-4">
      <div className="w-full max-w-md p-8 glass-card border border-white/10 bg-[#0d1117] rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tighter mb-2">{t.title}</h1>
          <p className="text-white/40 text-xs">{t.subtitle}</p>
        </div>

        {sent ? (
          <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-white text-sm py-4 px-4 rounded-xl text-center">
            {t.success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
                {t.subjectLabel}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
                placeholder={t.subjectPlaceholder}
                maxLength={200}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
                {t.bodyLabel}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all min-h-[140px] resize-none"
                placeholder={t.bodyPlaceholder}
                maxLength={5000}
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
        )}
      </div>
    </div>
  );
}
