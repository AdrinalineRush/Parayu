import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { razorpay } from "@/lib/razorpay";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPlan, isBillingCycle } from "@/lib/plans";

// Creates a Razorpay order for the signed-in user's chosen plan, and makes sure
// a matching row exists in Supabase so the post-payment plan update has a target.
// Returns only what the browser needs to open Checkout (never the key secret).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const userId = user.id;

  let body: { plan?: string; cycle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan = getPlan(body.plan);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  if (!isBillingCycle(body.cycle)) {
    return NextResponse.json({ error: "Invalid billing cycle." }, { status: 400 });
  }
  const amount = plan.amounts[body.cycle];

  try {
    // The signup trigger normally creates the users row already; upsert here as a
    // safety net so /verify and the webhook always have a row to flip to the paid
    // tier. Service-role key bypasses RLS. We deliberately don't set plan_tier.
    const meta = user.user_metadata ?? {};
    const { error: upsertError } = await supabaseAdmin()
      .from("users")
      .upsert(
        {
          id: userId,
          email: user.email ?? `${userId}@no-email.parayu`,
          first_name: meta.first_name ?? meta.full_name ?? null,
          last_name: meta.last_name ?? null,
          profile_image_url: meta.avatar_url ?? null,
        },
        { onConflict: "id" }
      );
    if (upsertError) throw upsertError;

    const order = await razorpay().orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${userId.slice(0, 10)}_${Date.now()}`,
      // notes ride along to the webhook so it can update the right user/plan even
      // if the browser never reaches the success handler.
      notes: { userId, plan: plan.id, cycle: body.cycle },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: plan.id,
      cycle: body.cycle,
    });
  } catch (err) {
    console.error("[razorpay/order]", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
