import CampaignBanner from "@/components/CampaignBanner";

// Completely public layout — no authentication required
export default async function GlobalPtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="pt" />
      {children}
    </>
  );
}
