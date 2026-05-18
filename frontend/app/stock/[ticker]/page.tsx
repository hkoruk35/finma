import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function StockDetailPage({ params }: Props) {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  redirect(`/ai?ticker=${ticker}`);
}
