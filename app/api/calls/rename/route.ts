import { webhookAuthorised } from "@/lib/auth";
import { sql } from "@/lib/db";
import { renameInHubSpot } from "@/lib/integrations/hubspot";
import { isSignedIn } from "@/lib/session-server";

/**
 * Correct a caller's name when the voice agent misheard it. Saves it on the call and, if the call
 * already created a HubSpot deal, renames the deal and its contact too. The Telegram brief already sent is not changed.
 */
export async function POST(req: Request) {
  if (!(await isSignedIn()) && !webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

  const { callId, name } = (await req.json().catch(() => ({}))) as { callId?: string; name?: string };
  const clean = (name ?? "").replace(/\s+/g, " ").trim();
  if (!callId) return Response.json({ error: "callId is required" }, { status: 400 });
  if (!clean || clean.length > 80) return Response.json({ error: "Enter a name of 1 to 80 characters." }, { status: 400 });

  const rows = (await sql()`
    UPDATE calls SET name = ${clean}, name_edited_at = now()
    WHERE call_id = ${callId}
    RETURNING hubspot_deal_id, property, location`) as { hubspot_deal_id: string | null; property: string | null; location: string | null }[];
  if (!rows.length) return Response.json({ error: "Call not found." }, { status: 404 });

  let hubspot: "updated" | "skipped" | "failed" | "no deal" = "no deal";
  const r = rows[0];
  if (r.hubspot_deal_id) {
    try {
      hubspot = await renameInHubSpot(r.hubspot_deal_id, clean, r.property, r.location);
    } catch (err) {
      console.error("hubspot rename failed", callId, (err as Error).message);
      hubspot = "failed";
    }
  }
  return Response.json({ ok: true, name: clean, hubspot });
}
