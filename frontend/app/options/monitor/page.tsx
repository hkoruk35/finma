import { headers } from "next/headers";
import OptionsMonitorClient from "./OptionsMonitorClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  // Restrict access to localhost/local terminal sunucusu
  if (process.env.VERCEL || !isLocal) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#141924] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-black mb-2 text-white uppercase tracking-wider">ACCESS DENIED</h1>
          <p className="text-[#94a3b8] text-sm mb-6 leading-relaxed">
            Bu izleme ekranı yalnızca lokal terminal sunucusunda (localhost:3000) çalıştırılabilir. Güvenlik nedeniyle Vercel veya harici ağlar üzerinden erişilemez.
          </p>
          <div className="text-xs text-[#64748b] border-t border-[#1e2a3a] pt-4 font-mono">
            HOST: {host || "External Cloud"}
          </div>
        </div>
      </div>
    );
  }

  return <OptionsMonitorClient />;
}
