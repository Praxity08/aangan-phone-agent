import { webhookAuthorised } from "@/lib/auth";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { classifyAndHandOff, storeCall } from "@/lib/process-call";
import { normaliseVaaniPayload } from "@/lib/vaani";

// The response goes back at once; classification runs after it, with up to 5 minutes to finish.
export const maxDuration = 300;

/** Vaani Labs posts here when a call ends. */
export async function POST(req: Request) {
  if (!webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body is not JSON" }, { status: 400 });
  }
  // Vaani's payload format isn't published: log its shape (field names only) so lib/vaani.ts can be matched to it.
  const shape = (o: unknown): unknown =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? `array(${v.length})` : typeof v === "object" ? shape(v) : typeof v]))
      : typeof o;
  console.log("vaani webhook payload shape", JSON.stringify(shape(body)));

  // Keep live payloads in webhook_log so the adapter can be checked against what Vaani really sends.
  const source = new URL(req.url).searchParams.get("source") === "replay" ? "replay" : "live";
  const log = (ok: boolean, error: string | null) =>
    source === "live"
      ? sql()`INSERT INTO webhook_log (ok, error, shape, body) VALUES (${ok}, ${error}, ${JSON.stringify(shape(body))}, ${JSON.stringify(body)})`.catch(() => {})
      : Promise.resolve();

  let call;
  try {
    call = normaliseVaaniPayload(body);
  } catch (err) {
    await log(false, (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  await log(true, call.transcript ? null : "no transcript in payload");

  const { stored } = await storeCall(call, source);
  if (!stored) return Response.json({ ok: true, call_id: call.call_id, duplicate: true });

  after(() => classifyAndHandOff(call.call_id));
  return Response.json({ ok: true, call_id: call.call_id, status: "classifying" }, { status: 202 });
}
