import CampaignBanner from "@/components/CampaignBanner";

// Completely public layout — no authentication required
export default async function GlobalFrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="fr" />
      {children}
    </>
  );
}
