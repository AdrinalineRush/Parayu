import { Check, Crown, Zap, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let planTier = "free";
  let latestPayment: { plan: string; cycle: string | null; amount: number; created_at: string } | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan_tier")
      .eq("id", user.id)
      .single();
    planTier = profile?.plan_tier ?? "free";

    const { data: payment } = await supabaseAdmin()
      .from("payments")
      .select("plan, cycle, amount, created_at")
      .eq("user_id", user.id)
      .eq("status", "captured")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    latestPayment = payment;
  }

  const isLifetime = latestPayment?.cycle === "lifetime";

  function formatPrice(paise: number) {
    return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Subscription</h1>
        <p className="text-muted-foreground font-semibold">Manage your billing and plan details.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Current Plan Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-4">Current Plan</h2>

          {planTier !== "free" ? (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-primary flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  {planTier === "base" ? "Base Plan" : `Pro Plan ${isLifetime ? "(Lifetime)" : "(Monthly)"}`}
                </span>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Active</span>
              </div>
              {latestPayment && (
                <>
                  <div className="text-2xl font-black text-foreground mb-1">
                     {formatPrice(latestPayment.amount)}
                    <span className="text-sm font-semibold text-muted-foreground ml-1">
                      {isLifetime ? "one-time" : "/ month"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold">
                    Purchased on {new Date(latestPayment.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-secondary mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Free Plan
                </span>
                <span className="text-xs text-muted-foreground font-bold bg-card px-2 py-0.5 rounded-full border border-border">Active</span>
              </div>
              <div className="text-2xl font-black text-foreground mb-1">
                $0
                <span className="text-sm font-semibold text-muted-foreground ml-1">/ forever</span>
              </div>
              <p className="text-xs text-muted-foreground font-semibold">Basic English dictation via LOW Brain (0.07B parameters) with system-wide paste.</p>
            </div>
          )}

          {planTier !== "free" ? (
            <Link href="/dashboard/billing" className="block">
              <button className="w-full py-2.5 bg-card hover:bg-secondary border border-border text-foreground rounded-xl transition-colors font-bold text-sm cursor-pointer">
                Manage Billing
              </button>
            </Link>
          ) : (
            <Link href="/pricing" className="block">
              <button className="w-full py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl transition-colors font-bold text-sm cursor-pointer flex items-center justify-center gap-2">
                Upgrade to Pro <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          )}
        </div>

        {/* Plan Benefits Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {planTier === "pro" ? "Your Pro Benefits" : planTier === "base" ? "Your Base Plan Benefits" : "Free Plan Benefits"}
          </h2>
          <ul className="space-y-3">
            {planTier === "pro" ? (
              [
                "Unlimited dictation in English, Malayalam, and 90+ languages",
                "Download all brains (up to 1.55B parameters)",
                "Fluid Malayalam Vocal Support (conversational intelligence)",
                "AI tone styling (Pro / Casual)",
                "Advanced grammar cleanup",
                "Custom abbreviations & dictionary",
                isLifetime ? "Lifetime updates included" : "Cancel or pause anytime",
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold">{benefit}</span>
                </li>
              ))
            ) : planTier === "base" ? (
              [
                "5,000 + 5,000 words English & Fluid Malayalam Vocal Support / month",
                "Download 2 speech brains (up to 0.24B parameters)",
                "Custom abbreviations & dictionary",
                "System-wide paste (⌥ Space)",
                "Cancel or pause anytime",
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold">{benefit}</span>
                </li>
              ))
            ) : (
              [
                "1,000 English words / month",
                "LOW English Brain (0.07B parameters)",
                "System-wide paste (⌥ Space)",
                "Custom dictionary",
                "macOS & Windows support",
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold">{benefit}</span>
                </li>
              ))
            )}
          </ul>

          {planTier === "free" && (
            <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary font-bold mb-1">Unlock Pro features</p>
              <p className="text-xs text-muted-foreground font-semibold">
                Get Fluid Malayalam Vocal Support, AI tone styling, and advanced cleanup starting at ₹99/month or ₹4,999 lifetime.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
