import { cookies } from "next/headers";
import { SESSION_COOKIE, safeEqual, sessionToken } from "./session";

/** True when the request carries a valid dashboard session (or no dashboard password is set). For API routes. */
export async function isSignedIn() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return true;
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  return Boolean(cookie) && safeEqual(cookie, await sessionToken(password));
}
