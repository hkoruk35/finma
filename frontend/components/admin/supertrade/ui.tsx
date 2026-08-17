"use client";

/**
 * SPX SuperTrade — Ortak Tasarım Bileşenleri
 * Tek bir görsel dil: başlıklar logo mavisi ve medium ağırlıkta,
 * artan değerler yeşil, azalan değerler kırmızı, geri kalan her şey nötr gri.
 */

import React from "react";

export const BRAND = "#3b82f6";
export const UP = "#22c55e";
export const DOWN = "#ef4444";
export const NEUTRAL = "#94a3b8";

export const SURFACE = "bg-[#0f141d] border border-[#1c2635] rounded-lg";
export const INSET = "bg-[#0a0e17] border border-[#1c2635] rounded-md";

/** Değişim yönüne göre metin rengi */
export function toneClass(value: number): string {
  if (value > 0) return "text-[#22c55e]";
  if (value < 0) return "text-[#ef4444]";
  return "text-slate-400";
}

export function signed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function num(value: number | undefined | null, digits = 2): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value === 0) return "—";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.09em] text-[#3b82f6]">{children}</h3>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

export function Panel({
  title,
  hint,
  right,
  children,
  className = "",
  padding = "p-4",
}: {
  title?: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <section className={`${SURFACE} ${padding} ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2.5">
          {title ? <SectionTitle hint={hint}>{title}</SectionTitle> : <span />}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  valueClass = "text-slate-100",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#3b82f6]">{label}</div>
      <div className={`mt-1 text-[17px] font-medium tabular-nums leading-tight ${valueClass}`}>{value}</div>
      {sub !== undefined && <div className="mt-0.5 truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Row({
  label,
  value,
  valueClass = "text-slate-200",
  title,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" title={title}>
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className={`text-[12px] font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

type BadgeTone = "brand" | "up" | "down" | "neutral" | "warn";

const BADGE_STYLES: Record<BadgeTone, string> = {
  brand: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]",
  up: "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]",
  down: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]",
  neutral: "border-[#1c2635] bg-white/[0.03] text-slate-400",
  warn: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] ${BADGE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]";
  return (
    <div className="inline-flex rounded-md border border-[#1c2635] bg-[#0a0e17] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`${pad} rounded font-medium transition-colors ${
            value === opt.value
              ? "bg-[#3b82f6] text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Yön göstergesi: yukarı yeşil, aşağı kırmızı */
export function Arrow({ value }: { value: number }) {
  if (value > 0) return <span className="text-[#22c55e]">↑</span>;
  if (value < 0) return <span className="text-[#ef4444]">↓</span>;
  return <span className="text-slate-500">→</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-[#1c2635] px-4 py-6 text-center text-[12px] text-slate-500">
      {children}
    </div>
  );
}
