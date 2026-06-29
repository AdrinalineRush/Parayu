"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A signed-in user files a support ticket. Inserts via service role so the row
// is always written, then sends them back with a success flag.
export async function submitTicket(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/dashboard/support");

  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  if (!subject || !message) redirect("/dashboard/support?error=1");

  await supabaseAdmin().from("support_tickets").insert({
    user_id: user.id,
    email: user.email,
    subject,
    message,
    priority: ["low", "normal", "high"].includes(priority) ? priority : "normal",
  });

  redirect("/dashboard/support?sent=1");
}
