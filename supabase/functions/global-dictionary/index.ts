// Edge Function: GET the published global dictionary as the exact JSON shape the
// macOS app expects: { version, updated, entries: [{ from, to, phrase, stage }] }.
//
// Deploy:  supabase functions deploy global-dictionary --no-verify-jwt
//   (--no-verify-jwt because this is a PUBLIC read endpoint for all app users.)
// It reads with the service role (auto-injected by Supabase), so the public never
// needs table-level access — the tables stay locked behind RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { data: meta } = await supabase
      .from("dictionary_meta")
      .select("version, updated_at")
      .eq("id", 1)
      .single();

    const { data: rows, error } = await supabase
      .from("dictionary_entries")
      .select("from_text, to_text, phrase, manglish, stage")
      .eq("enabled", true);

    if (error) throw error;

    const body = {
      version: meta?.version ?? 1,
      updated: (meta?.updated_at ?? new Date().toISOString()).slice(0, 10),
      entries: (rows ?? []).map((r) => ({
        from: r.from_text,
        to: r.to_text,
        phrase: r.phrase,
        manglish: r.manglish,
        stage: r.stage,
      })),
    };

    return new Response(JSON.stringify(body), {
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        // 5-min CDN cache so launches don't hammer the function.
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
