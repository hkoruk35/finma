import { createClient } from "@supabase/supabase-js";

export interface AboutSection {
  title: string;
  description: string;
  image_url: string; // Banner/Image URL
  gradient: string; // CSS gradient class, e.g., "from-[#3b82f6] to-[#8b5cf6]"
}

export interface AboutStat {
  number: string;
  text: string;
}

export interface AboutConfig {
  hero: {
    subtitle: string;
    title_html: string; // allow raw html like "Gateway to Markets<br />"
    title_highlight: string;
    description: string;
    image_url: string; // Hero banner
  };
  sections: AboutSection[];
  stats: {
    title: string;
    items: AboutStat[];
  };
  mission: {
    title: string;
    description: string;
    image_url: string;
  };
}

export type AllAboutConfigs = Record<string, AboutConfig>;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

// Fallback to file when Supabase table not yet created
function readFileConfig(): AllAboutConfigs {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path");
    const raw = readFileSync(join(process.cwd(), "about-config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getAboutConfigsFromDB(): Promise<AllAboutConfigs> {
  try {
    const sb = getSupabaseAdmin();
    // Assuming table name is "about_config"
    const { data, error } = await sb.from("about_config").select("lang, data");
    if (error || !data?.length) {
      return readFileConfig();
    }
    return Object.fromEntries(data.map((row: { lang: string; data: AboutConfig }) => [row.lang, row.data]));
  } catch {
    return readFileConfig();
  }
}

export async function getAboutConfigFromDB(lang: string): Promise<AboutConfig | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("about_config").select("data").eq("lang", lang).single();
    if (error || !data) {
      return readFileConfig()[lang] ?? null;
    }
    return data.data as AboutConfig;
  } catch {
    return readFileConfig()[lang] ?? null;
  }
}

export async function upsertAboutConfigToDB(lang: string, cfg: AboutConfig): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("about_config").upsert(
      { lang, data: cfg, updated_at: new Date().toISOString() },
      { onConflict: "lang" }
    );
    if (error) {
      throw error;
    }
  } catch (e) {
    // If table doesn't exist, try writing to JSON file as fallback for local dev
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readFileSync, writeFileSync } = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { join } = require("path");
      const path = join(process.cwd(), "about-config.json");
      let configs: AllAboutConfigs = {};
      try {
        configs = JSON.parse(readFileSync(path, "utf-8"));
      } catch (err) {}
      configs[lang] = cfg;
      writeFileSync(path, JSON.stringify(configs, null, 2));
    } catch (fsError) {
      console.error("Failed to write to both DB and File:", e, fsError);
      throw e;
    }
  }
}

export async function deleteAboutConfigFromDB(lang: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("about_config").delete().eq("lang", lang);
  if (error) throw error;
}

export function getAboutConfig(lang: string): AboutConfig | null {
  return readFileConfig()[lang] ?? null;
}
