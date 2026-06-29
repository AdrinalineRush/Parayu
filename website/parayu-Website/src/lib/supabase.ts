import { createClient } from "@/lib/supabase/client";

// Back-compat singleton for existing `import { supabase } from "@/lib/supabase"`
// call sites. It's the SSR-aware browser client, so it shares the auth cookie
// with the server. New code should import { createClient } from "@/lib/supabase/client".
export const supabase = createClient();
