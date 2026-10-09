import { webhookAuthorised } from "@/lib/auth";
import { sql } from "@/lib/db";

/**
 * Tool the voice agent calls at the start of every call with the caller's number.
 * A recent record means a dropped call (T17) or a missed follow-up (T16): resume, don't restart.
 */
export async function POST(req: Request) {
  if (!webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const { phone } = (await req.json()) as { phone?: string };
  if (!phone) return Response.json({ known: false });

  const rows = await sql()`
    SELECT started_at, outcome, name, location, scope, summary, booked
    FROM calls
    WHERE phone = ${phone} AND started_at > now() - interval '30 days'
    ORDER BY started_at DESC LIMIT 1`;
  if (!rows.length) return Response.json({ known: false });

  const r = rows[0] as Record<string, unknown>;
  return Response.json({
    known: true,
    last_call: r.started_at,
    outcome: r.outcome,
    name: r.name,
    already_booked: r.booked,
    what_they_said: r.summary,
    instruction: r.booked
      ? "They already have a consultation booked. Confirm it and ask how you can help."
      : "They called recently. Greet them by name, pick up where the last call ended, and book now.",
  });
}
