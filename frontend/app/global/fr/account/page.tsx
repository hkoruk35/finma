import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Détails du Compte — BOGA AI",
  description: "Affichez et gérez les détails de votre compte BOGA AI gratuit.",
};

export default function GlobalFrAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />
      <main className="flex-1">
        <AccountView locale="fr" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
