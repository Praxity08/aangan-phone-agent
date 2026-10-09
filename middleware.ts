import { NextResponse, type NextRequest } from "next/server";

/** The dashboard shows callers' names and numbers: keep it behind a password. API routes use the webhook secret. */
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [, given] = atob(encoded).split(":");
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aangan dashboard"' },
  });
}

export const config = { matcher: ["/((?!api/|_next/|favicon.ico).*)"] };
