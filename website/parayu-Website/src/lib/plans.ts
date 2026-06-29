// Single source of truth for paid plans. Amounts are in PAISE (INR × 100),
// because that's what the Razorpay Orders API expects. Keep these in sync with
// the figures shown on the pricing page (src/app/(marketing)/pricing/page.tsx).
//
// `tier` is the value written to public.users.plan_tier in Supabase after a
// successful payment, so it must match what the rest of the app checks against.

export type BillingCycle = "monthly" | "annual" | "lifetime";
export type PlanId = "base" | "pro";

export interface PlanDef {
  id: PlanId;
  name: string;
  tier: string;
  // Amount charged for one billing period, in paise.
  amounts: Record<BillingCycle, number>;
}

export const PLANS: Record<PlanId, PlanDef> = {
  base: {
    id: "base",
    name: "Base",
    tier: "base",
    // ₹99/mo monthly · ₹990/yr billed yearly · legacy base plan
    amounts: { monthly: 9900, annual: 99000, lifetime: 0 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    tier: "pro",
    // Pro Monthly: ₹299/mo (~$3/mo) · Pro Yearly: ₹2,990/yr (~$2.49/mo) · Pro Lifetime: ₹4,999 (~$99)
    amounts: { monthly: 29900, annual: 299000, lifetime: 499900 },
  },
};

export function getPlan(id: string | undefined | null): PlanDef | null {
  if (!id) return null;
  return PLANS[id as PlanId] ?? null;
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual" || value === "lifetime";
}
