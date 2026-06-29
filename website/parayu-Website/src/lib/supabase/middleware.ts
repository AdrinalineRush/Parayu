import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require a signed-in user.
const PROTECTED = ["/dashboard", "/admin"];
// Routes that require an admin user (subset of PROTECTED).
const ADMIN_ONLY = ["/admin"];

// Runs on every request (see src/middleware.ts matcher). It (1) refreshes the
// Supabase auth cookie so sessions don't silently expire, and (2) guards the
// protected and admin-only areas, redirecting unauthenticated/unauthorized
// users to sign-in.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If Supabase isn't configured yet (e.g. env vars not set in Vercel), don't
  // crash every route — just let requests through unauthenticated. Protected
  // pages stay reachable only because there's no session to check against.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() revalidates the token with Supabase — do not trust
  // getSession() alone in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // For any protected route with a signed-in user, check their profile once:
  // suspended users are bounced out, and /admin requires is_admin.
  if (user && needsAuth) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin, status")
      .eq("id", user.id)
      .single();

    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("error", "suspended");
      return NextResponse.redirect(url);
    }

    if (ADMIN_ONLY.some((p) => path.startsWith(p)) && !profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
