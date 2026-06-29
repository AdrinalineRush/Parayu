import { Badge } from "@/components/ui/badge";
import { Zap, Award, RefreshCw } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLANS } from "@/lib/plans";

// Live subscriptions = users on a paid tier, straight from Supabase.
export const dynamic = "force-dynamic";

interface SubRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan_tier: string | null;
  status: string | null;
  created_at: string;
}

function inr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default async function AdminSubscriptionsPage() {
  const { data } = await supabaseAdmin()
    .from("users")
    .select("id, email, first_name, last_name, plan_tier, status, created_at")
    .neq("plan_tier", "free")
    .order("created_at", { ascending: false });

  const subs: SubRow[] = data ?? [];
  const proCount = subs.filter((s) => s.plan_tier === "pro").length;
  const baseCount = subs.filter((s) => s.plan_tier === "base").length;
  const mrr = proCount * PLANS.pro.amounts.monthly + baseCount * PLANS.base.amounts.monthly;
  const arr = mrr * 12;

  const metrics = [
    { label: "Active Paid Seats", value: subs.length.toLocaleString("en-IN"), icon: <Zap className="w-3.5 h-3.5 text-primary" />, note: `${baseCount} Base · ${proCount} Pro` },
    { label: "Est. MRR", value: inr(mrr), icon: <Award className="w-3.5 h-3.5 text-emerald-400" />, note: "From monthly list prices" },
    { label: "Est. ARR", value: inr(arr), icon: <RefreshCw className="w-3.5 h-3.5 text-amber-500" />, note: "MRR × 12" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Subscription Management</h1>
        <p className="text-zinc-400">All paid plans, live from Supabase.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="glass-card p-6">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">{m.label}</span>
            <span className="text-3xl font-bold text-white">{m.value}</span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-2">{m.icon} {m.note}</span>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/20 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 sm:p-6">Subscriber</th>
                <th className="p-4 sm:p-6">Plan</th>
                <th className="p-4 sm:p-6">Account</th>
                <th className="p-4 sm:p-6">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {subs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-zinc-500">
                    No paid subscriptions yet.
                  </td>
                </tr>
              )}
              {subs.map((sub) => {
                const name = [sub.first_name, sub.last_name].filter(Boolean).join(" ") || "—";
                const suspended = sub.status === "suspended";
                return (
                  <tr key={sub.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 sm:p-6">
                      <div className="font-semibold text-white">{name}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">{sub.email}</div>
                    </td>
                    <td className="p-4 sm:p-6">
                      <Badge className="capitalize rounded-md bg-primary/10 text-primary border-primary/20">
                        {sub.plan_tier}
                      </Badge>
                    </td>
                    <td className="p-4 sm:p-6">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${suspended ? "bg-red-500" : "bg-emerald-500"}`} />
                        <span className={`capitalize text-xs ${suspended ? "text-red-400" : "text-emerald-400"}`}>
                          {sub.status ?? "active"}
                        </span>
                      </span>
                    </td>
                    <td className="p-4 sm:p-6 text-xs text-zinc-400">
                      {new Date(sub.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
