import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next renamed the `middleware` convention to `proxy`. This runs before routes
// render: it refreshes the Supabase auth cookie and guards /dashboard + /admin
// (logic in src/lib/supabase/middleware.ts).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets, so auth never
    // blocks CSS/JS/images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
