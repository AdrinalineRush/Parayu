import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPlan } from "@/lib/plans";

// Records a successful charge and flips the user's plan. Called from both the
// /verify route (instant, after Checkout) and the /webhook (authoritative). The
// payments table dedupes on razorpay_payment_id, so running both is safe.
export async function recordPayment(opts: {
  userId: string | null;
  email?: string | null;
  orderId: string;
  paymentId: string;
  plan: string;
  cycle?: string | null;
  amount: number; // paise
  currency?: string;
}) {
  const db = supabaseAdmin();

  await db.from("payments").upsert(
    {
      user_id: opts.userId,
      email: opts.email ?? null,
      razorpay_order_id: opts.orderId,
      razorpay_payment_id: opts.paymentId,
      plan: opts.plan,
      cycle: opts.cycle ?? null,
      amount: opts.amount,
      currency: opts.currency ?? "INR",
      status: "captured",
    },
    { onConflict: "razorpay_payment_id" }
  );

  const planDef = getPlan(opts.plan);
  if (opts.userId && planDef) {
    await db
      .from("users")
      .update({ plan_tier: planDef.tier, updated_at: new Date().toISOString() })
      .eq("id", opts.userId);
  }
}
