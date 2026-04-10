import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Token is guaranteed present here (withAuth ensures it).
    // Additional role-based guards live in individual route handlers and pages.
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        // Any authenticated user may access the dashboard routes.
        // Unauthenticated requests are redirected to /login by next-auth.
        return token !== null;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Protect all routes; allow public access to auth routes and Next.js internals.
// Summary pages (/cases/[id]/summary) require a valid session — the page itself
// handles the redirect with the correct callbackUrl.
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
