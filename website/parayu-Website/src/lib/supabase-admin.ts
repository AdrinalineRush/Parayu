import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY Supabase client. It authenticates with the service-role key, which
// bypasses Row Level Security — so it must NEVER be imported into a Client
// Component or shipped to the browser. Use it only inside API route handlers
// (e.g. to flip a user's plan_tier after a verified payment).
//
// Lazily constructed so a missing env var doesn't crash the build — it only
// throws when a route actually tries to use it at runtime.

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
