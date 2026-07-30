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
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={coords} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
