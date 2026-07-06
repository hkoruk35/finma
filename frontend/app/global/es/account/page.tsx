import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Detalles de Cuenta — BOGA AI",
  description: "Ve y gestiona los detalles de tu cuenta gratuita de BOGA AI.",
};

export default function GlobalEsAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />
      <main className="flex-1">
        <AccountView locale="es" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
