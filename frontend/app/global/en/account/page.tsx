import AccountView from "@/components/public/AccountView";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Account Details — BOGA AI",
  description: "View and manage your free BOGA AI account details.",
};

export default function GlobalEnAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} />
      <main className="flex-1">
        <AccountView locale="en" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} />
    </div>
  );
}
