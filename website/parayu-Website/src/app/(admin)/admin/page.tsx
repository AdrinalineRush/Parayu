import { Users, CreditCard, Activity, ArrowUpRight, Clock } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLANS } from "@/lib/plans";

// Live admin overview — reads real figures from Supabase with the service-role
// client (server-side, bypasses RLS). No data is rendered from mock arrays.
export const dynamic = "force-dynamic";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export default async function AdminOverviewPage() {
  const db = supabaseAdmin();

  // Aggregate counts (head:true returns only the count, not rows).
  const [{ count: totalUsers }, { count: proCount }, { count: baseCount }, recent] =
    await Promise.all([
      db.from("users").select("*", { count: "exact", head: true }),
      db.from("users").select("*", { count: "exact", head: true }).eq("plan_tier", "pro"),
      db.from("users").select("*", { count: "exact", head: true }).eq("plan_tier", "base"),
      db.from("users").select("email, plan_tier, created_at").order("created_at", { ascending: false }).limit(8),
    ]);

  const pro = proCount ?? 0;
  const base = baseCount ?? 0;
  const activeSubs = pro + base;
  // Rough MRR from monthly list prices (paise → rupees).
  const mrr = (pro * PLANS.pro.amounts.monthly + base * PLANS.base.amounts.monthly) / 100;

  const recentUsers = recent.data ?? [];

  const stats = [
    { title: "Total Users", value: (totalUsers ?? 0).toLocaleString("en-IN"), icon: <Users className="w-4 h-4 text-blue-400" /> },
    { title: "Active Subscriptions", value: activeSubs.toLocaleString("en-IN"), icon: <CreditCard className="w-4 h-4 text-emerald-400" /> },
    { title: "Est. MRR", value: formatINR(mrr), icon: <Activity className="w-4 h-4 text-violet-400" /> },
    { title: "Base / Pro", value: `${base} / ${pro}`, icon: <ArrowUpRight className="w-4 h-4 text-fuchsia-400" /> },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-white">System Overview</h1>
        <p className="text-zinc-400">Live metrics from your Supabase backend.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-6 border-red-500/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-zinc-400 text-sm font-medium">{stat.title}</h3>
              {stat.icon}
            </div>
            <span className="text-3xl font-bold text-white">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Plan distribution */}
        <div className="lg:col-span-2 glass-card p-6 min-h-[400px] flex flex-col">
          <h3 className="font-bold text-white mb-6">Plan Distribution</h3>
          <div className="flex-1 flex flex-col justify-center gap-5">
            {[
              { label: "Free", count: (totalUsers ?? 0) - activeSubs, color: "bg-zinc-500" },
              { label: "Base", count: base, color: "bg-blue-500" },
              { label: "Pro", count: pro, color: "bg-violet-500" },
            ].map((row) => {
              const total = totalUsers || 1;
              const pct = Math.round((row.count / total) * 100);
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-zinc-300">{row.label}</span>
                    <span className="text-zinc-500">{row.count} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent signups */}
        <div className="glass-card p-6">
          <h3 className="font-bold text-white mb-6">Recent Signups</h3>
          <div className="space-y-6">
            {recentUsers.length === 0 && (
              <p className="text-sm text-zinc-500">No users yet.</p>
            )}
            {recentUsers.map((u, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    <span className="font-medium">{u.email}</span>
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 capitalize">
                    {u.plan_tier} · {new Date(u.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
