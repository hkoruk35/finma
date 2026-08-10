import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createTimeoutFetch } from "./supabaseFetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://none.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "none";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    // DB yanıt vermediğinde route'ların süresiz askıda kalmasını engeller
    // (bkz. lib/supabaseFetch.ts).
    global: { fetch: createTimeoutFetch() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component içinden çağrıldığında cookie set edilemez; oturum login/logout route'larında tazelenir.
        }
      },
    },
  });
}
