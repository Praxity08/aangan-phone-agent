import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/session";

/** The dashboard shows callers' names: without a valid session cookie, send people to /login. */
export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// API routes use the webhook secret; /login and the logo files must load without a session.
export const config = { matcher: ["/((?!api/|_next/|login|favicon.ico|.*\\.png$).*)"] };
