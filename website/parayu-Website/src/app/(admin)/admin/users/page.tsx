import { Badge } from "@/components/ui/badge";
import { UserX, UserCheck } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { setPlan, toggleSuspend } from "./actions";

// Live user list straight from Supabase (service-role read, server-side).
export const dynamic = "force-dynamic";

// Order the "Elevate plan" button cycles through.
const PLAN_CYCLE = ["free", "base", "pro", "enterprise"];
function nextPlan(current: string) {
  const i = PLAN_CYCLE.indexOf(current);
  return PLAN_CYCLE[(i + 1) % PLAN_CYCLE.length];
}

interface UserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan_tier: string | null;
  is_admin: boolean | null;
  status: string | null;
  created_at: string;
}

export default async function UserManagementPage() {
  const { data, error } = await supabaseAdmin()
    .from("users")
    .select("id, email, first_name, last_name, plan_tier, is_admin, status, created_at")
    .order("created_at", { ascending: false });

  const users: UserRow[] = data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">User Management</h1>
        <p className="text-zinc-400">
          {users.length} {users.length === 1 ? "account" : "accounts"} · live from Supabase.
        </p>
      </div>

      {error && (
        <div className="glass-card p-4 text-sm text-red-400 border-red-500/20">
          Could not load users: {error.message}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/20 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 sm:p-6">User</th>
                <th className="p-4 sm:p-6">Plan</th>
                <th className="p-4 sm:p-6">Role</th>
                <th className="p-4 sm:p-6">Status</th>
                <th className="p-4 sm:p-6">Joined</th>
                <th className="p-4 sm:p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {users.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-500">
                    No users yet. They&apos;ll appear here after the first signup.
                  </td>
                </tr>
              )}
              {users.map((user) => {
                const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "—";
                const plan = user.plan_tier ?? "free";
                const status = user.status ?? "active";
                const suspended = status === "suspended";
                return (
                  <tr key={user.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 sm:p-6">
                      <div className="font-semibold text-white">{name}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">{user.email}</div>
                    </td>
                    <td className="p-4 sm:p-6">
                      <Badge className={`capitalize rounded-md ${
                        plan === "enterprise"
                          ? "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20"
                          : plan === "pro"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : plan === "base"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-zinc-800 text-zinc-400 border-white/5"
                      }`}>
                        {plan}
                      </Badge>
                    </td>
                    <td className="p-4 sm:p-6">
                      {user.is_admin ? (
                        <span className="text-xs text-red-400 font-medium">Admin</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Member</span>
                      )}
                    </td>
                    <td className="p-4 sm:p-6">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${suspended ? "bg-red-500" : "bg-emerald-500"}`} />
                        <span className={`capitalize text-xs ${suspended ? "text-red-400" : "text-emerald-400"}`}>{status}</span>
                      </span>
                    </td>
                    <td className="p-4 sm:p-6 text-xs text-zinc-400">
                      {new Date(user.created_at).toLocaleDateString("en-IN", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </td>
                    <td className="p-4 sm:p-6">
                      <div className="flex items-center justify-end gap-2">
                        <form action={setPlan}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="plan" value={nextPlan(plan)} />
                          <button type="submit" className="text-xs text-primary hover:text-white transition-colors" title={`Set to ${nextPlan(plan)}`}>
                            Elevate plan
                          </button>
                        </form>
                        <form action={toggleSuspend}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            type="submit"
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${suspended ? "text-zinc-500 hover:text-emerald-400" : "text-zinc-500 hover:text-red-400"}`}
                            title={suspended ? "Reactivate account" : "Suspend account"}
                          >
                            {suspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                        </form>
                      </div>
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
