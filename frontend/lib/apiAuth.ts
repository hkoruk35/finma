import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** İç yönetim paneli (staff) kimliği — customer/Supabase oturumundan tamamen ayrı. */
export function isStaffAuthed(req: NextRequest): boolean {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin" || role === "readonly";
}

export function isStaffWriteAuthed(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export interface MemberAccess {
  authenticated: boolean;
  plan: string | null;
  isPremium: boolean;
  /** Aktif ücretli plan — ücretli içerik erişimi. Deneme süresi yok; premium
   *  olmayan (pending/canceled/anonim) hiçbir zaman ücretli veriye erişemez. */
  hasAccess: boolean;
  /** $39/ay pakete dahil, her fatura döneminde sıfırlanan Copilot AI kredisi. */
  monthlyCredits: number;
  /** Ayrıca satın alınan, süresi dolmayan (devreden) top-up Copilot AI kredisi. */
  topupCredits: number;
}

const NO_ACCESS: MemberAccess = {
  authenticated: false,
  plan: null,
  isPremium: false,
  hasAccess: false,
  monthlyCredits: 0,
  topupCredits: 0,
};

/**
 * Supabase oturumundan üye planını okur. useMemberPlan (client hook) ile
 * aynı premium mantığını sunucu tarafında uygular — bkz. hooks/useMemberPlan.ts.
 * Not: monthlyCredits/topupCredits SADECE Copilot AI sohbet kullanımını
 * ölçer (bkz. 0020_usage_credits.sql) — hasAccess (site geneli premium
 * erişim) bunlardan bağımsız, sadece plan'a göre hesaplanır.
 */
export async function getMemberAccess(): Promise<MemberAccess> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NO_ACCESS;

    const { data: member } = await supabase
      .from("members")
      .select("plan, monthly_credit_balance, topup_credit_balance")
      .eq("id", userData.user.id)
      .single();

    if (!member) return { ...NO_ACCESS, authenticated: true };

    const plan: string | null = member.plan ?? null;
    const isPremium = plan === "premium" || plan === "admin";

    return {
      authenticated: true,
      plan,
      isPremium,
      hasAccess: isPremium,
      monthlyCredits: member.monthly_credit_balance ?? 0,
      topupCredits: member.topup_credit_balance ?? 0,
    };
  } catch {
    return NO_ACCESS;
  }
}

/** Ham veri/algoritma çıktısına erişim: staff (dahili araçlar) veya aktif planlı üye. */
export async function hasDataAccess(req: NextRequest): Promise<boolean> {
  if (isStaffAuthed(req)) return true;
  const access = await getMemberAccess();
  return access.hasAccess;
}

/** Sadece giriş yapmış olmak yeterli (plan farketmez) — staff veya herhangi bir üye. */
export async function hasAnyAuth(req: NextRequest): Promise<boolean> {
  if (isStaffAuthed(req)) return true;
  const access = await getMemberAccess();
  return access.authenticated;
}
