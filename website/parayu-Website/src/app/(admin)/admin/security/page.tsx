import { Shield, UserX, ShieldCheck, Lock } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  created_at: string;
}

// Security-relevant audit actions to surface here.
const SENSITIVE = ["set_status", "set_plan", "flag_toggle", "blog_delete"];

export default async function SecurityPage() {
  const db = supabaseAdmin();
  const [{ count: totalUsers }, { count: admins }, { count: suspended }, recent] =
    await Promise.all([
      db.from("users").select("*", { count: "exact", head: true }),
      db.from("users").select("*", { count: "exact", head: true }).eq("is_admin", true),
      db.from("users").select("*", { count: "exact", head: true }).eq("status", "suspended"),
      db.from("audit_logs").select("id, actor_email, action, target, created_at").in("action", SENSITIVE).order("created_at", { ascending: false }).limit(20),
    ]);

  const events: AuditRow[] = recent.data ?? [];

  const stats = [
    { title: "Total Accounts", value: (totalUsers ?? 0).toLocaleString("en-IN"), icon: <Shield className="w-4 h-4 text-blue-400" /> },
    { title: "Admins", value: (admins ?? 0).toLocaleString("en-IN"), icon: <ShieldCheck className="w-4 h-4 text-emerald-400" /> },
    { title: "Suspended", value: (suspended ?? 0).toLocaleString("en-IN"), icon: <UserX className="w-4 h-4 text-red-400" /> },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Security</h1>
        <p className="text-zinc-400">Account posture and sensitive admin activity. Live from Supabase.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="glass-card p-6 border-red-500/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-zinc-400 text-sm font-medium">{s.title}</h3>{s.icon}
            </div>
            <span className="text-3xl font-bold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-bold text-white mb-6 flex items-center gap-2"><Lock className="w-4 h-4 text-red-400" /> Sensitive actions</h3>
        <div className="space-y-4">
          {events.length === 0 && <p className="text-sm text-zinc-500">No sensitive actions recorded yet.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-4 text-xs border-b border-white/5 pb-3 last:border-0">
              <div className="min-w-0">
                <span className="text-primary font-medium">{e.action}</span>
                <span className="text-zinc-500"> on </span>
                <span className="font-mono text-zinc-400 truncate">{e.target ?? "—"}</span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-zinc-300 font-mono">{e.actor_email ?? "system"}</div>
                <div className="text-zinc-600">{new Date(e.created_at).toLocaleString("en-IN")}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
