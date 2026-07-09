import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("stripe_subscription_id")
    .eq("id", userData.user.id)
    .single();

  if (memberError || !member?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription found." }, { status: 404 });
  }

  const subscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  await supabaseAdmin
    .from("members")
    .update({ cancel_at_period_end: subscription.cancel_at_period_end })
    .eq("id", userData.user.id);

  return NextResponse.json({ ok: true });
}
