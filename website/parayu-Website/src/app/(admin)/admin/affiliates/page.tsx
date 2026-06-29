import { Badge } from "@/components/ui/badge";
import { Share2 } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface Affiliate {
  id: string;
  email: string | null;
  code: string;
  referrals: number | null;
  earnings: number | null; // paise
  status: string | null;
  created_at: string;
}

function inr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default async function AffiliatesPage() {
  const { data } = await supabaseAdmin()
    .from("affiliates")
    .select("id, email, code, referrals, earnings, status, created_at")
    .order("earnings", { ascending: false });

  const affiliates: Affiliate[] = data ?? [];
  const totalReferrals = affiliates.reduce((s, a) => s + (a.referrals ?? 0), 0);
  const totalEarnings = affiliates.reduce((s, a) => s + (a.earnings ?? 0), 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Affiliates</h1>
        <p className="text-zinc-400">{affiliates.length} partners · {totalReferrals} referrals · {inr(totalEarnings)} paid out.</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/20 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 sm:p-6">Affiliate</th>
                <th className="p-4 sm:p-6">Code</th>
                <th className="p-4 sm:p-6">Referrals</th>
                <th className="p-4 sm:p-6">Earnings</th>
                <th className="p-4 sm:p-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {affiliates.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-zinc-500">
                  <Share2 className="w-5 h-5 mx-auto mb-2 opacity-50" /> No affiliates yet.
                </td></tr>
              )}
              {affiliates.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-4 sm:p-6 text-white font-mono text-xs">{a.email ?? "—"}</td>
                  <td className="p-4 sm:p-6"><span className="font-mono text-xs text-primary">{a.code}</span></td>
                  <td className="p-4 sm:p-6 text-zinc-300">{a.referrals ?? 0}</td>
                  <td className="p-4 sm:p-6 font-semibold text-white">{inr(a.earnings ?? 0)}</td>
                  <td className="p-4 sm:p-6">
                    <Badge className={`rounded-md text-[10px] ${a.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-700/40 text-zinc-400 border-white/5"}`}>
                      {a.status ?? "active"}
                    </Badge>
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
