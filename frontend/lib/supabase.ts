import { createClient } from "@supabase/supabase-js";
import { createTimeoutFetch } from "./supabaseFetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project")) {
  console.warn("Supabase credentials missing or set to placeholder. Authentication will not work.");
}

export const supabase = createClient(
  supabaseUrl || "https://none.supabase.co",
  supabaseAnonKey || "none",
  // DB yanıt vermediğinde sorgular süresiz askıda kalmasın (bkz. lib/supabaseFetch.ts).
  { global: { fetch: createTimeoutFetch() } }
);
