import OptionsMonitorClient from "./OptionsMonitorClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Options Performance Monitor | BOGA AI",
  description: "Real-time performance and latency tracking dashboard for BOGA AI options.",
};

export default function Page() {
  return <OptionsMonitorClient />;
}
