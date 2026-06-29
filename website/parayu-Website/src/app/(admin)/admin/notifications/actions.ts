"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export async function sendNotification(formData: FormData) {
  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  if (!title) throw new Error("Title required");

  await supabaseAdmin().from("notifications").insert({
    title,
    body,
    audience: ["all", "pro", "team"].includes(audience) ? audience : "all",
  });
  await logAudit({ actorEmail: admin.email, action: "notification_send", target: audience, meta: { title } });
  revalidatePath("/admin/notifications");
}
