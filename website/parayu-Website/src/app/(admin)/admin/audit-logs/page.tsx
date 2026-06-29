import { ListOrdered } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface Log {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export default async function AuditLogsPage() {
  const { data } = await supabaseAdmin()
    .from("audit_logs")
    .select("id, actor_email, action, target, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const logs: Log[] = data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Audit Logs</h1>
        <p className="text-zinc-400">Every admin action, newest first. Live from Supabase.</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/20 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 sm:p-6">When</th>
                <th className="p-4 sm:p-6">Actor</th>
                <th className="p-4 sm:p-6">Action</th>
                <th className="p-4 sm:p-6">Target</th>
                <th className="p-4 sm:p-6">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {logs.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-zinc-500">
                  <ListOrdered className="w-5 h-5 mx-auto mb-2 opacity-50" /> No actions logged yet.
                </td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-4 sm:p-6 text-xs text-zinc-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString("en-IN")}</td>
                  <td className="p-4 sm:p-6 text-xs font-mono text-zinc-300">{log.actor_email ?? "system"}</td>
                  <td className="p-4 sm:p-6"><span className="text-xs font-medium text-primary">{log.action}</span></td>
                  <td className="p-4 sm:p-6 text-xs font-mono text-zinc-500 truncate max-w-[160px]">{log.target ?? "—"}</td>
                  <td className="p-4 sm:p-6 text-xs text-zinc-500 font-mono">{log.meta ? JSON.stringify(log.meta) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
