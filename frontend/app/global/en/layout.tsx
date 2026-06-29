import CampaignBanner from "@/components/CampaignBanner";

// Completely public layout — no authentication required
export default async function GlobalEnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="en" />
      {children}
    </>
  );
}
