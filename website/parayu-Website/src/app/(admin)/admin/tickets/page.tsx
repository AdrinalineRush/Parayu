import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { setTicketStatus } from "./actions";

export const dynamic = "force-dynamic";

interface Ticket {
  id: string;
  email: string | null;
  subject: string;
  message: string;
  priority: string | null;
  status: string | null;
  created_at: string;
}

export default async function AdminTicketsPage() {
  const { data } = await supabaseAdmin()
    .from("support_tickets")
    .select("id, email, subject, message, priority, status, created_at")
    .order("created_at", { ascending: false });

  const tickets: Ticket[] = data ?? [];
  const open = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Support Tickets</h1>
        <p className="text-zinc-400">{open} open · {tickets.length} total · live from Supabase.</p>
      </div>

      <div className="space-y-4">
        {tickets.length === 0 && (
          <div className="glass-card p-6 text-sm text-zinc-500">No tickets yet.</div>
        )}
        {tickets.map((t) => {
          const resolved = t.status === "resolved";
          return (
            <div key={t.id} className="glass-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white truncate">{t.subject}</h3>
                    <Badge className={`rounded-md text-[10px] ${
                      t.priority === "high" ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : t.priority === "low" ? "bg-zinc-700/40 text-zinc-400 border-white/5"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>{t.priority ?? "normal"}</Badge>
                    <Badge className={`rounded-md text-[10px] ${resolved ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                      {resolved ? "resolved" : "open"}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{t.message}</p>
                  <p className="text-xs text-zinc-500 mt-3 font-mono">
                    {t.email ?? "—"} · {new Date(t.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <form action={setTicketStatus} className="shrink-0">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="status" value={t.status ?? "open"} />
                  <button type="submit" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 transition-colors">
                    {resolved ? <><RotateCcw className="w-3.5 h-3.5" /> Reopen</> : <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Resolve</>}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
