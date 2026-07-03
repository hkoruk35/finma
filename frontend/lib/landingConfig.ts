import { readFileSync } from "fs";
import { join } from "path";

export interface LandingScreenshot {
  src: string;
  label: string;
  desc: string;
}

export interface LandingFeature {
  icon: "bolt" | "chart-bar" | "trending-up" | "shield" | "star" | "globe";
  title: string;
  desc: string;
}

export interface LandingJpmImage {
  src: string;
  label: string;
}

export interface LandingConfig {
  hero: {
    badge: string;
    description_bold: string;
    description: string;
  };
  cta_primary: { text: string; subtext: string; href: string };
  cta_secondary: { text: string; href: string };
  cta_note: string;
  screenshots: LandingScreenshot[];
  features: LandingFeature[];
  jpm: {
    enabled: boolean;
    badge: string;
    title: string;
    description: string;
    pdf: string;
    pdf_label: string;
    images: LandingJpmImage[];
  };
  bottom_cta: { title: string; description: string; note: string };
}

export type AllLandingConfigs = Record<string, LandingConfig>;

export function getLandingConfigs(): AllLandingConfigs {
  try {
    const raw = readFileSync(join(process.cwd(), "landing-config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getLandingConfig(lang: string): LandingConfig | null {
  return getLandingConfigs()[lang] ?? null;
}
