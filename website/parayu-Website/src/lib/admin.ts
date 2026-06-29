import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Re-checks that the caller is a signed-in admin. Server actions and route
// handlers are public endpoints, so this guard runs on every admin mutation —
// never trust the UI having hidden a button. Returns the admin user (handy for
// audit logging the actor).
export async function requireAdmin(): Promise<User> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data } = await supabaseAdmin()
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!data?.is_admin) throw new Error("Forbidden");

  return user;
}
