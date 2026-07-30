"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

interface AdminTicker {
  id: string;
  ticker: string;
  company: string | null;
  source: "fixed" | "swing_daily";
  added_by: string | null;
  added_at: string;
  active: boolean;
}

export default function Top100AdminPanel() {
  const role = useUserRole();
  const [tickers, setTickers] = useState<AdminTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newSource, setNewSource] = useState<"fixed" | "swing_daily">("fixed");
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetch("/api/admin/top100")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setTickers(d.tickers ?? []);
      })
      .catch(() => setError("Could not load tickers."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (role === "admin") load();
    else if (role === "readonly") setLoading(false);
  }, [role]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/top100", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: newTicker.trim(), source: newSource }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add ticker.");
      } else {
        setNewTicker("");
        load();
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (t: AdminTicker) => {
    await fetch("/api/admin/top100", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: t.ticker, active: !t.active }),
    });
    load();
  };

  const remove = async (t: AdminTicker) => {
    await fetch(`/api/admin/top100?ticker=${encodeURIComponent(t.ticker)}`, { method: "DELETE" });
    load();
  };

  if (role === "readonly") {
    return <div className="text-center py-16 text-red-400 text-sm">This page is for admins only.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-white">
      <h1 className="text-2xl font-medium tracking-tighter mb-5">Top 100 Composition Management</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          placeholder="e.g. AAPL"
          className="bg-[#161b22] border border-white/10 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-blue-500"
          disabled={adding}
        />
        <select
          value={newSource}
          onChange={(e) => setNewSource(e.target.value as "fixed" | "swing_daily")}
          className="bg-[#161b22] border border-white/10 rounded-lg px-3 py-2 text-sm"
          disabled={adding}
        >
          <option value="fixed">Fixed (weekly)</option>
          <option value="swing_daily">Daily swing</option>
        </select>
        <button
          type="submit"
          disabled={adding}
          className="bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </form>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-white/40 text-sm">Loading...</div>
      ) : (
        <div className="border border-[#1e2a3a] rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#111620] text-white/40 uppercase text-[10px]">
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => (
                <tr key={t.id} className="border-t border-[#1e2a3a]">
                  <td className="px-3 py-2 font-medium">{t.ticker}</td>
                  <td className="px-3 py-2 text-white/50">{t.company || "—"}</td>
                  <td className="px-3 py-2 text-white/50">{t.source === "swing_daily" ? "Daily swing" : "Fixed"}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleActive(t)} className={t.active ? "text-green-400" : "text-white/30"}>
                      {t.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(t)} className="text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {tickers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/30">
                    No tickers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
