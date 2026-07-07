import dynamic from "next/dynamic";

// SSR is fully disabled — the chart only mounts once the DOM is ready.
const BogaChartLoader = dynamic(() => import("./BogaChartEngine"), {
  ssr: false,
  loading: () => <div className="h-[460px] bg-[#030073]/10 animate-pulse rounded-lg" />,
});

export default BogaChartLoader;
