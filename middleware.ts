import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if this is an export file request
  if (req.nextUrl.pathname.startsWith("/exports/")) {
    if (!session) {
      // Redirect to login page if not authenticated
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    // Forward the request to the exports directory
    // This assumes you have a public/exports directory that contains the exported files
    return res;
  }

  // For API routes, allow the request to proceed
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return res;
  }

  // For all other routes, check if authenticated
  if (!session && !req.nextUrl.pathname.startsWith("/auth/")) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
