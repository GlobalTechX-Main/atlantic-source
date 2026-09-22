import { NextResponse } from "next/server";

export function middleware() {
  const response = NextResponse.next();

  // Enforce security headers dynamically
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files & favicon
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
