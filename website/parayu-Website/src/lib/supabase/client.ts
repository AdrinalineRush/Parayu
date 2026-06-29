import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the SSR helper so the auth session is
// stored in cookies that the server (middleware, server components, route
// handlers) can read too — that shared cookie is what keeps you logged in
// across the client/server boundary.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
