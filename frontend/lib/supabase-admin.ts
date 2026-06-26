import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("your-project")) {
  console.warn("Supabase service-role credentials missing or placeholder. Admin writes will not work.");
}

// RLS'i bypass eden service-role client — sadece sunucu tarafı admin route'larında kullanılır,
// her çağıran kendi içinde boga_auth==='admin' kontrolünü yapmak zorunda.
export const supabaseAdmin = createClient(
  supabaseUrl || "https://none.supabase.co",
  serviceRoleKey || "none"
);
