import { supabaseAdmin } from "@/lib/supabase-admin";

// Records an admin action to public.audit_logs. Best-effort: a logging failure
// must never block the action that triggered it.
export async function logAudit(entry: {
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin().from("audit_logs").insert({
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: entry.meta ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to log", err);
  }
}
