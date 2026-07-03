import PreOrderClient from "@/components/PreOrderClient";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} Analysis — BOGA AI Admin`,
    description: `${ticker.toUpperCase()} pivot, EMA, Wyckoff and staged entry/exit analysis`,
  };
}

export default async function AdminTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">{ticker.toUpperCase()} Analysis</h1>
      <PreOrderClient ticker={ticker.toUpperCase()} />
    </div>
  );
}
