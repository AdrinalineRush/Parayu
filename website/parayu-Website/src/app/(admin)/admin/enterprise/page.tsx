import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { advanceLead } from "./actions";

export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  company: string;
  email: string;
  seats: number | null;
  message: string | null;
  status: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  won: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  lost: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default async function EnterprisePage() {
  const { data } = await supabaseAdmin()
    .from("enterprise_leads")
    .select("id, company, email, seats, message, status, created_at")
    .order("created_at", { ascending: false });

  const leads: Lead[] = data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Enterprise Leads</h1>
        <p className="text-zinc-400">{leads.length} leads from the contact / enterprise forms. Live from Supabase.</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/20 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 sm:p-6">Company</th>
                <th className="p-4 sm:p-6">Contact</th>
                <th className="p-4 sm:p-6">Seats</th>
                <th className="p-4 sm:p-6">Status</th>
                <th className="p-4 sm:p-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {leads.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-zinc-500">
                  <Building2 className="w-5 h-5 mx-auto mb-2 opacity-50" /> No leads yet.
                </td></tr>
              )}
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.01] transition-colors align-top">
                  <td className="p-4 sm:p-6">
                    <div className="font-semibold text-white">{l.company}</div>
                    {l.message && <div className="text-xs text-zinc-500 mt-1 max-w-xs">{l.message}</div>}
                  </td>
                  <td className="p-4 sm:p-6 text-xs font-mono text-zinc-300">{l.email}</td>
                  <td className="p-4 sm:p-6 text-zinc-300">{l.seats ?? "—"}</td>
                  <td className="p-4 sm:p-6">
                    <Badge className={`rounded-md text-[10px] ${STATUS_STYLES[l.status ?? "new"] ?? STATUS_STYLES.new}`}>
                      {l.status ?? "new"}
                    </Badge>
                  </td>
                  <td className="p-4 sm:p-6 text-right">
                    <form action={advanceLead}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value={l.status ?? "new"} />
                      <button type="submit" className="text-xs text-primary hover:text-white transition-colors">Advance</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
