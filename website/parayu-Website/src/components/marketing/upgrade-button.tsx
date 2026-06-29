"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/use-user";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BillingCycle, PlanId } from "@/lib/plans";

// Razorpay's Checkout script attaches a global; it ships no types, so describe
// just the surface we use.
type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: unknown) => void) => void;
    };
  }
}

export function UpgradeButton({
  plan,
  cycle,
  children,
  className,
}: {
  plan: PlanId;
  cycle: BillingCycle;
  children: React.ReactNode;
  className?: string;
}) {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    // Not signed in → send them to sign in, then back to pricing.
    if (!userLoading && !user) {
      router.push("/sign-in?redirect=/pricing");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || "Could not start checkout.");

      if (typeof window === "undefined" || !window.Razorpay) {
        throw new Error("Payment window is still loading — please try again.");
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Parayu AI",
        description: `${plan[0].toUpperCase()}${plan.slice(1)} plan · ${cycle}`,
        prefill: {
          name: (user?.user_metadata?.full_name ?? user?.user_metadata?.first_name) ?? undefined,
          email: user?.email ?? undefined,
        },
        theme: { color: "#6D28D9" },
        handler: async (resp: unknown) => {
          const r = resp as RazorpaySuccess;
          const verify = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...r, plan, cycle }),
          });
          if (verify.ok) {
            toast.success("Payment successful — your plan is now active!");
            router.push("/dashboard/subscription");
          } else {
            toast.error(
              "Payment received, but activation failed. Contact support and we'll sort it out."
            );
          }
        },
      });
      rzp.on("payment.failed", () =>
        toast.error("Payment failed. No money was deducted — please try again.")
      );
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <Button onClick={handleClick} disabled={loading} className={className}>
        {loading ? "Processing…" : children}
      </Button>
    </>
  );
}
