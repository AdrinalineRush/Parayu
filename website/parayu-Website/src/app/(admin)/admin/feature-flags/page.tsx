import { Flag } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toggleFlag, createFlag } from "./actions";

export const dynamic = "force-dynamic";

interface FlagRow {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean | null;
  updated_at: string;
}

export default async function FeatureFlagsPage() {
  const { data } = await supabaseAdmin()
    .from("feature_flags")
    .select("id, key, description, enabled, updated_at")
    .order("key");

  const flags: FlagRow[] = data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Feature Flags</h1>
        <p className="text-zinc-400">{flags.filter((f) => f.enabled).length} of {flags.length} enabled. Live from Supabase.</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">New flag</h2>
        <form action={createFlag} className="flex flex-col sm:flex-row gap-3">
          <input name="key" required placeholder="flag_key" className="flex-1 rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none font-mono text-sm" />
          <input name="description" placeholder="Description" className="flex-1 rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none text-sm" />
          <button type="submit" className="h-11 px-6 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors shrink-0">Add</button>
        </form>
      </div>

      <div className="space-y-3">
        {flags.length === 0 && (
          <div className="glass-card p-6 text-sm text-zinc-500 text-center">
            <Flag className="w-5 h-5 mx-auto mb-2 opacity-50" /> No flags yet.
          </div>
        )}
        {flags.map((f) => (
          <div key={f.id} className="glass-card p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-mono text-sm text-white">{f.key}</h3>
              {f.description && <p className="text-xs text-zinc-500 mt-0.5">{f.description}</p>}
            </div>
            <form action={toggleFlag} className="shrink-0">
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="enabled" value={String(f.enabled)} />
              <button
                type="submit"
                className={`relative w-12 h-6 rounded-full transition-colors ${f.enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
                title={f.enabled ? "Disable" : "Enable"}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${f.enabled ? "left-[26px]" : "left-0.5"}`} />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
