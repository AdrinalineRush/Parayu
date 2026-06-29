import { DollarSign, CreditCard, Activity, ArrowUpRight } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Live revenue from the payments table (service-role read, server-side).
export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  email: string | null;
  plan: string | null;
  cycle: string | null;
  amount: number | null; // paise
  currency: string | null;
  status: string | null;
  created_at: string;
}

function inr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default async function AdminRevenuePage() {
  const { data } = await supabaseAdmin()
    .from("payments")
    .select("id, email, plan, cycle, amount, currency, status, created_at")
    .order("created_at", { ascending: false });

  const payments: PaymentRow[] = data ?? [];
  const captured = payments.filter((p) => p.status === "captured");

  const gross = captured.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const now = new Date();
  const thisMonth = captured
    .filter((p) => {
      const d = new Date(p.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const arpu = captured.length ? gross / captured.length : 0;

  // Revenue by plan for the cohort bars.
  const byPlan = new Map<string, number>();
  for (const p of captured) {
    const key = p.plan ?? "other";
    byPlan.set(key, (byPlan.get(key) ?? 0) + (p.amount ?? 0));
  }
  const cohorts = [...byPlan.entries()]
    .map(([name, amount]) => ({ name, amount, percent: gross ? Math.round((amount / gross) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const metrics = [
    { label: "Gross Billing (lifetime)", value: inr(gross), icon: <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />, note: `${captured.length} charges` },
    { label: "This Month", value: inr(thisMonth), icon: <Activity className="w-3.5 h-3.5 text-primary" />, note: now.toLocaleString("en-IN", { month: "long" }) },
    { label: "ARPU (per charge)", value: inr(arpu), icon: <DollarSign className="w-3.5 h-3.5 text-amber-500" />, note: "Average charge value" },
    { label: "Total Transactions", value: payments.length.toLocaleString("en-IN"), icon: <CreditCard className="w-3.5 h-3.5 text-violet-400" />, note: "All statuses" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Revenue & Invoicing</h1>
        <p className="text-zinc-400">Live Razorpay revenue from your Supabase payments table.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="glass-card p-6">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">{m.label}</span>
            <span className="text-3xl font-bold text-white">{m.value}</span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-2">{m.icon} {m.note}</span>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-6">Recent Transactions</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-zinc-500">No payments yet. Charges appear here after the first successful checkout.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {payments.slice(0, 25).map((tx) => (
                  <div key={tx.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{tx.email ?? "—"}</div>
                        <div className="text-zinc-500 font-mono text-[10px] capitalize">{tx.plan} · {tx.cycle}</div>
                      </div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-[10px] text-zinc-500">{new Date(tx.created_at).toLocaleString("en-IN")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{inr(tx.amount ?? 0)}</div>
                      <span className={`inline-flex items-center text-[10px] font-semibold ${tx.status === "captured" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col">
          <h3 className="font-bold text-white mb-6">Revenue by Plan</h3>
          <div className="space-y-4">
            {cohorts.length === 0 && <p className="text-xs text-zinc-500">No data yet.</p>}
            {cohorts.map((c, index) => (
              <div key={index} className="space-y-1.5 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="text-zinc-400 capitalize">{c.name}</span>
                  <span className="text-zinc-500">{inr(c.amount)} ({c.percent}%)</span>
                </div>
                <div className="w-full h-1 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                  <div style={{ width: `${c.percent}%` }} className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
