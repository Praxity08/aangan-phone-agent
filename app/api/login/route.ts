import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, safeEqual, sessionToken } from "@/lib/session";

/** The login form posts here. Right password → session cookie and the dashboard; otherwise back to /login. */
export async function POST(req: Request) {
  const form = await req.formData();
  const given = String(form.get("password") ?? "");
  const password = process.env.DASHBOARD_PASSWORD;
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  if (!given) return to("/login?error=empty");
  if (!password) return to("/");
  if (!safeEqual(given, password)) return to("/login?error=wrong");

  const res = to("/");
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
