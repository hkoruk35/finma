"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("user_email", email);
        // Tam sayfa yönlendirme (router.push DEĞİL): AdminLayout sunucu
        // bileşeni boga_auth cookie'sini okuyup sidebar'ı gösteriyor —
        // yumuşak (client-side) geçişte Next.js önbelleklenmiş RSC
        // yanıtını (henüz cookie yokken üretilmiş) yeniden kullanabilir
        // ve sidebar giriş yapılmış olsa bile görünmez kalır. Ayrıca
        // eski hedef "/pro" yanlıştı — gerçek admin kökü "/admin".
        window.location.href = "/admin";
      } else {
        setError(data.error ?? "Giris basarisiz.");
      }
    } catch {
      setError("Sunucuya baglanılamadi. Lutfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#010409] font-sans">
      <div className="w-full max-w-md p-8 glass-card border border-white/10 bg-[#0d1117] rounded-3xl shadow-2xl animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            BOGA <span className="text-[#3b82f6]">AI</span>
          </h1>
          <p className="text-white/50 text-sm font-medium">Terminal Girişi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
              E-POSTA
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
              placeholder="E-posta adresiniz"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
              ŞİFRE
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl font-medium animate-shake">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "GİRİŞ YAPILIYOR..." : "GİRİŞ YAP"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-white/30 uppercase tracking-widest leading-relaxed">
            Sadece yetkili kullanıcılar erişebilir.<br/>
            BOGA AI Institutional Trading Terminal
          </p>
        </div>
      </div>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
