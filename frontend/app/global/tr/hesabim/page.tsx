import AccountView from "@/components/public/AccountView";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Hesap Bilgileri — BOGA AI",
  description: "Ücretsiz BOGA AI hesap bilgilerinizi görüntüleyin ve yönetin.",
};

export default function GlobalTrHesabimPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} />
      <main className="flex-1">
        <AccountView locale="tr" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} />
    </div>
  );
}
