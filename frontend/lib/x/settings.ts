import { supabaseAdmin } from "@/lib/supabase-admin";

// x_automation_settings.x_posting_enabled — the "X app connection" kill
// switch. When false, posting/scheduling endpoints and the automation cron
// still generate content and publish it to the internal /news feed
// (status='posted', tweet_id left null), but never call postTweet(). This is
// distinct from `enabled`, which only gates whether the automated cron
// *cycle* fires at all.
export async function isXPostingEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("x_automation_settings")
    .select("x_posting_enabled")
    .eq("id", 1)
    .single();
  if (error || !data) return true; // fail open — don't silently swallow real posts on a read error
  return data.x_posting_enabled !== false;
}
