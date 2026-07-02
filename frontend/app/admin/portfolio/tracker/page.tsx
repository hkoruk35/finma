import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TrackerPageClient } from "@/components/TrackerPageClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Tracker — BOGA AI",
  description: "Real-time 1H stock monitoring with technical indicators, signals, and entry/exit analysis",
  alternates: { canonical: "https://bogastock.com/tracker" },
};

export default async function TrackerPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("boga_auth")?.value;
  if (role !== "admin" && role !== "readonly") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <TrackerPageClient />
      </main>
      <Footer />
    </div>
  );
}
