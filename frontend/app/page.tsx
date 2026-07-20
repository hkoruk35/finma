import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.",
  description: "BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.",
  alternates: {
    canonical: "https://bogastock.com",
  },
};

export default function HomePage() {
  redirect("/global/en");
}
