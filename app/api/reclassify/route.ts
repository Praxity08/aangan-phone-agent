import { after } from "next/server";
import { webhookAuthorised } from "@/lib/auth";
import { sql } from "@/lib/db";
import { classifyAndHandOff } from "@/lib/process-call";
import { isSignedIn } from "@/lib/session-server";

export const maxDuration = 300;

/** Re-run classification for a call that Gemini couldn't classify (from the dashboard, or with the webhook secret). */
export async function POST(req: Request) {
  if (!(await isSignedIn()) && !webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

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
