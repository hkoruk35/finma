import { createClient } from "@supabase/supabase-js";

export interface SssItem {
  question: string;
  answer: string;
}

export interface SssConfig {
  title: string;
  description: string;
  faqs: SssItem[];
}

export type AllSssConfigs = Record<string, SssConfig>;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

function readFileConfig(): AllSssConfigs {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path");
    const raw = readFileSync(join(process.cwd(), "sss-config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getSssConfigsFromDB(): Promise<AllSssConfigs> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("sss_config").select("lang, data");
    if (error || !data?.length) {
      return readFileConfig();
    }
    return Object.fromEntries(data.map((row: { lang: string; data: SssConfig }) => [row.lang, row.data]));
  } catch {
    return readFileConfig();
  }
}

export async function getSssConfigFromDB(lang: string): Promise<SssConfig | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("sss_config").select("data").eq("lang", lang).single();
    if (error || !data) {
      return readFileConfig()[lang] ?? null;
    }
    return data.data as SssConfig;
  } catch {
    return readFileConfig()[lang] ?? null;
  }
}

export async function upsertSssConfigToDB(lang: string, cfg: SssConfig): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("sss_config").upsert(
      { lang, data: cfg, updated_at: new Date().toISOString() },
      { onConflict: "lang" }
    );
    if (error) {
      throw error;
    }
  } catch (e) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readFileSync, writeFileSync } = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { join } = require("path");
      const path = join(process.cwd(), "sss-config.json");
      let configs: AllSssConfigs = {};
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

export async function deleteSssConfigFromDB(lang: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("sss_config").delete().eq("lang", lang);
  if (error) throw error;
}

export function getSssConfig(lang: string): SssConfig | null {
  return readFileConfig()[lang] ?? null;
}
