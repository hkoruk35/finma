import { createClient } from "@supabase/supabase-js";

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

// Fallback to file when Supabase table not yet created
function readFileConfig(): AllLandingConfigs {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path");
    const raw = readFileSync(join(process.cwd(), "landing-config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getLandingConfigsFromDB(): Promise<AllLandingConfigs> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("landing_config").select("lang, data");
    if (error || !data?.length) {
      // Fallback to file
      return readFileConfig();
    }
    return Object.fromEntries(data.map((row: { lang: string; data: LandingConfig }) => [row.lang, row.data]));
  } catch {
    return readFileConfig();
  }
}

export async function getLandingConfigFromDB(lang: string): Promise<LandingConfig | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("landing_config").select("data").eq("lang", lang).single();
    if (error || !data) {
      // Fallback to file
      return readFileConfig()[lang] ?? null;
    }
    return data.data as LandingConfig;
  } catch {
    return readFileConfig()[lang] ?? null;
  }
}

export async function upsertLandingConfigToDB(lang: string, cfg: LandingConfig): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("landing_config").upsert(
    { lang, data: cfg, updated_at: new Date().toISOString() },
    { onConflict: "lang" }
  );
  if (error) throw error;
}

export async function deleteLandingConfigFromDB(lang: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("landing_config").delete().eq("lang", lang);
  if (error) throw error;
}

// Legacy sync helpers (kept for backward compat — reading falls back to file)
export function getLandingConfigs(): AllLandingConfigs {
  return readFileConfig();
}

export function getLandingConfig(lang: string): LandingConfig | null {
  return readFileConfig()[lang] ?? null;
}

