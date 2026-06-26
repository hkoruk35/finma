import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // /en/top100 veya /tr/top100 → /global/en/top100 veya /global/tr/top100'ye yönlendir
  if (pathname === "/en/top100" || pathname === "/tr/top100") {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      // Login değil → /global/en/login veya /global/tr/giris'e yönlendir
      const lang = pathname.startsWith("/en") ? "en" : "tr";
      const loginPath = lang === "en" ? "/global/en/login" : "/global/tr/giris";
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    // Login yapıldı → /global/en/top100 veya /global/tr/top100'ye yönlendir
    const lang = pathname.startsWith("/en") ? "en" : "tr";
    const globalPath = lang === "en" ? "/global/en/top100" : "/global/tr/top100";
    return NextResponse.redirect(new URL(globalPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/en/top100",
    "/tr/top100",
  ],
};
