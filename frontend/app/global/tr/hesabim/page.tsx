import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Hesap Bilgileri — BOGA AI",
  description: "Ücretsiz BOGA AI hesap bilgilerinizi görüntüleyin ve yönetin.",
};

export default function GlobalTrHesabimPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <MemberHeader locale="tr" />
      <main className="flex-1">
        <AccountView locale="tr" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
