"use client";

import { useEffect, useState } from "react";

interface Campaign {
  id: string;
  title: string;
  message: string;
  cta_url: string | null;
}

export default function CampaignBanner({ lang }: { lang: "en" | "tr" | "es" }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/active?lang=${lang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const first = d?.campaigns?.[0];
        if (first && !sessionStorage.getItem(`campaign_dismissed_${first.id}`)) setCampaign(first);
      })
      .catch(() => {});
  }, [lang]);

  if (!campaign || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(`campaign_dismissed_${campaign.id}`, "1");
    setDismissed(true);
  };

  return (
    <div style={{ background: "#1c2433", borderBottom: "1px solid #30363d", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 13, fontFamily: "monospace", color: "#e6edf3" }}>
      <span>
        <strong style={{ color: "#58a6ff" }}>{campaign.title}</strong> — {campaign.message}
      </span>
      {campaign.cta_url && (
        <a href={campaign.cta_url} style={{ color: "#3fb950", fontWeight: 700, textDecoration: "none" }}>
          →
        </a>
      )}
      <button onClick={dismiss} style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14 }}>
        ✕
      </button>
    </div>
  );
}
