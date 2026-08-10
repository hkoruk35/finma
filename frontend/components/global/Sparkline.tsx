import { formatNumber } from "@/lib/formatNumber";
interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  changePct?: number;
}

export default function Sparkline({ data, color, width = 56, height = 22, changePct = 0 }: SparklineProps) {
  const points = data.filter((n) => typeof n === "number" && isFinite(n));
  if (points.length < 2) {
    return <div style={{ width, height }} />;
  }

  // Değişim oranına göre daha gerçekçi bir grafik:
  // Eğer %'de değişim varsa, o yönü göster
  let adjustedPoints = [...points];
  if (changePct !== 0 && points.length >= 2) {
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    // changePct yönüne göre son birkaç noktayı adjust et
    const adjustment = (changePct / 100) * firstPoint * 0.5;
    adjustedPoints[adjustedPoints.length - 1] = lastPoint + adjustment;
  }

  const min = Math.min(...adjustedPoints);
  const max = Math.max(...adjustedPoints);
  const range = max - min || 1;
  const step = width / (adjustedPoints.length - 1);

  const coords = adjustedPoints
    .map((v, i) => `${formatNumber((i * step), 1)},${formatNumber((height - ((v - min) / range) * height), 1)}`)
    .join(" ");

  const gradientId = `sparkline-${Math.random().toString(36).substr(2, 9)}`;
  const pathD = `M${coords}L${width},${height}L0,${height}Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={pathD} fill={`url(#${gradientId})`} />
      <polyline points={coords} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
