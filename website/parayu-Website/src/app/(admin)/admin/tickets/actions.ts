"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

// Toggle a ticket between open and resolved.
export async function setTicketStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const next = String(formData.get("status")) === "resolved" ? "open" : "resolved";

  await supabaseAdmin().from("support_tickets").update({ status: next }).eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "ticket_status", target: id, meta: { status: next } });
  revalidatePath("/admin/tickets");
}
