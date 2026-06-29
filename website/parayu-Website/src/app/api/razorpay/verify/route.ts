import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { getPlan, isBillingCycle } from "@/lib/plans";
import { recordPayment } from "@/lib/payments";

// Called by the browser right after Razorpay Checkout succeeds. We re-verify the
// signature server-side (the client cannot be trusted) before granting the plan.
// The webhook is the authoritative backup; this just makes the upgrade feel
// instant for the user who just paid.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const userId = user.id;

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan: planId,
    cycle,
  } = await req.json();

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Payments not configured." }, { status: 500 });
  }
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
  }

  // Razorpay signs `${order_id}|${payment_id}` with the key secret (HMAC-SHA256).
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const sigBuf = Buffer.from(razorpay_signature);
  const expBuf = Buffer.from(expected);
  const valid =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!valid) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
  }

  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  // Amount from our own price list (paise) — never trust a client-sent amount.
  const amount = isBillingCycle(cycle) ? plan.amounts[cycle] : plan.amounts.monthly;

  try {
    await recordPayment({
      userId,
      email: user.email,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      plan: plan.id,
      cycle: isBillingCycle(cycle) ? cycle : null,
      amount,
    });
  } catch (err) {
    console.error("[razorpay/verify] record/plan update failed", err);
    return NextResponse.json({ error: "Could not activate plan." }, { status: 500 });
  }

  return NextResponse.json({ success: true, plan: plan.tier });
}
