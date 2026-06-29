import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST target for the sign-out buttons in the dashboard/admin layouts.
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
}
