import { after } from "next/server";
import { cookies } from "next/headers";
import { webhookAuthorised } from "@/lib/auth";
import { sql } from "@/lib/db";
import { classifyAndHandOff } from "@/lib/process-call";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/session";

export const maxDuration = 300;

async function signedIn() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return true;
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  return Boolean(cookie) && safeEqual(cookie, await sessionToken(password));
}

/** Re-run classification for a call that Gemini couldn't classify (from the dashboard, or with the webhook secret). */
export async function POST(req: Request) {
  if (!(await signedIn()) && !webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

  const { callId } = (await req.json().catch(() => ({}))) as { callId?: string };
  if (!callId) return Response.json({ error: "callId is required" }, { status: 400 });

  const rows = await sql()`
    UPDATE calls SET outcome = 'pending', summary = 'Classifying…'
    WHERE call_id = ${callId} AND outcome = 'unclassified'
    RETURNING call_id`;
  if (!rows.length) return Response.json({ error: "call not found or already classified" }, { status: 409 });

  after(() => classifyAndHandOff(callId));
  return Response.json({ ok: true, status: "classifying" }, { status: 202 });
}
