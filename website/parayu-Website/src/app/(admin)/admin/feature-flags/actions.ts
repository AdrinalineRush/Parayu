"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export async function toggleFlag(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const next = String(formData.get("enabled")) !== "true";
  await supabaseAdmin()
    .from("feature_flags")
    .update({ enabled: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "flag_toggle", target: id, meta: { enabled: next } });
  revalidatePath("/admin/feature-flags");
}

export async function createFlag(formData: FormData) {
  const admin = await requireAdmin();
  const key = String(formData.get("key") ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const description = String(formData.get("description") ?? "").trim();
  if (!key) throw new Error("Key required");
  await supabaseAdmin().from("feature_flags").insert({ key, description, enabled: false });
  await logAudit({ actorEmail: admin.email, action: "flag_create", target: key });
  revalidatePath("/admin/feature-flags");
}
