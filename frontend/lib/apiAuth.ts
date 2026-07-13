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
  isFreeTrial: boolean;
  /** Aktif ücretli plan veya süresi dolmamış deneme — ücretli içerik erişimi. */
  hasAccess: boolean;
}

const NO_ACCESS: MemberAccess = {
  authenticated: false,
  plan: null,
  isPremium: false,
  isFreeTrial: false,
  hasAccess: false,
};

/**
 * Supabase oturumundan üye planını okur. useMemberPlan (client hook) ile
 * aynı premium/trial mantığını sunucu tarafında uygular — bkz. hooks/useMemberPlan.ts.
 */
export async function getMemberAccess(): Promise<MemberAccess> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NO_ACCESS;

    const { data: member } = await supabase
      .from("members")
      .select("plan, trial_ends_at")
      .eq("id", userData.user.id)
      .single();

    if (!member) return { ...NO_ACCESS, authenticated: true };

    const plan: string | null = member.plan ?? null;
    const trialExpiry = member.trial_ends_at ? new Date(member.trial_ends_at).getTime() : 0;
    const trialActive = trialExpiry > Date.now();
    const isPremium = plan === "premium" || plan === "admin";
    const isFreeTrial = plan === "free_trial" || (!isPremium && trialActive);

    return { authenticated: true, plan, isPremium, isFreeTrial, hasAccess: isPremium || isFreeTrial };
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
