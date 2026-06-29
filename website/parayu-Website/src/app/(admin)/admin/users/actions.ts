"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

const VALID_PLANS = new Set(["free", "base", "pro", "enterprise"]);

// Set a user's plan to the value chosen in the form (the "Elevate plan" button
// submits the next tier in the cycle).
export async function setPlan(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const plan = String(formData.get("plan"));
  if (!id || !VALID_PLANS.has(plan)) throw new Error("Bad input");

  await supabaseAdmin()
    .from("users")
    .update({ plan_tier: plan, updated_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "set_plan", target: id, meta: { plan } });
  revalidatePath("/admin/users");
}

// Flip a user between active and suspended.
export async function toggleSuspend(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const current = String(formData.get("status"));
  const next = current === "suspended" ? "active" : "suspended";

  await supabaseAdmin()
    .from("users")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "set_status", target: id, meta: { status: next } });
  revalidatePath("/admin/users");
}
