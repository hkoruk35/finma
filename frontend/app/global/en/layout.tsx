import CampaignBanner from "@/components/CampaignBanner";

export default function GlobalEnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="en" />
      {children}
    </>
  );
}
