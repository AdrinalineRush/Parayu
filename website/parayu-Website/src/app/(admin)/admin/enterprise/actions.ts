"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

const FLOW = ["new", "contacted", "won", "lost"];

// Advance a lead through the pipeline (new → contacted → won → lost → new).
export async function advanceLead(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const current = String(formData.get("status"));
  const next = FLOW[(FLOW.indexOf(current) + 1) % FLOW.length];

  await supabaseAdmin().from("enterprise_leads").update({ status: next }).eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "lead_status", target: id, meta: { status: next } });
  revalidatePath("/admin/enterprise");
}
