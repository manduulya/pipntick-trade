import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
const isAuthRoute = createRouteMatcher(["/login", "/register"]);

const CANONICAL_HOST = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pipntick.trade").host;

export default clerkMiddleware(async (auth, req) => {
  // Canonicalize the host: www.<domain> -> <domain>. The <link rel="canonical"> already points
  // Google at the apex, but a hard 308 removes the duplicate URL entirely.
  const host = req.headers.get("host");
  if (host && host === `www.${CANONICAL_HOST}`) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }
  if (isAuthRoute(req)) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
