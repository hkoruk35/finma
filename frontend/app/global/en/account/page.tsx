import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Account Details — BOGA AI",
  description: "View and manage your free BOGA AI account details.",
};

export default function GlobalEnAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <MemberHeader locale="en" />
      <main className="flex-1">
        <AccountView locale="en" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
