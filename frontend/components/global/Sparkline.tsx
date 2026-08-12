"use client";

import { useId } from "react";

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  changePct?: number;
  /** Stretches the SVG to 100% of its container width via CSS (viewBox math
   * still uses `width`/`height` for the path, so the plotted shape scales
   * with the box instead of staying pinned to a fixed pixel size). */
  responsive?: boolean;
}

export default function Sparkline({ data, color, width = 56, height = 22, changePct = 0, responsive = false }: SparklineProps) {
  // Gradient id'si sunucuda ve tarayicida AYNI olmak zorunda. Onceden
  // Math.random() ile uretiliyordu; sunucu "sparkline-j58tl9y23", tarayici
  // "sparkline-1pdt9ksgb" yaziyor, React hydration uyusmazligi verip o
  // sparkline alt agaclarinin tamamini atip yeniden ciziyordu (ana sayfada
  // her yuklemede onlarca kez). useId sunucu/istemci arasinda tutarlidir.
  // Uretilen deger ":r1:" formatinda oldugundan, url(#...) referansinda
  // sorun cikarmamasi icin iki nokta ustuste temizlenir.
  const gradientId = `sparkline-${useId().replace(/:/g, "")}`;

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

  const pathD = `M${coords}L${width},${height}L0,${height}Z`;

  return (
    <svg
      width={responsive ? "100%" : width}
      height={responsive ? "100%" : height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? "none" : undefined}
      className="overflow-visible"
    >
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
