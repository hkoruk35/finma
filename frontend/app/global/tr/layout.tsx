import CampaignBanner from "@/components/CampaignBanner";

export default function GlobalTrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="tr" />
      {children}
    </>
  );
}
