import { Metadata } from "next";
import { TrackerPageClient } from "@/components/TrackerPageClient";

export const metadata: Metadata = {
  title: "Tracker — BOGA AI",
  description: "Real-time stock monitoring with 1H technical indicators",
};

export default function TrackerPage() {
  return <TrackerPageClient />;
}
