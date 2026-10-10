import { after } from "next/server";
import { headerSummary, webhookAuthorised } from "@/lib/auth";
import { sql } from "@/lib/db";
import { classifyAndHandOff, storeCall } from "@/lib/process-call";
import { normaliseVaaniPayload } from "@/lib/vaani";

// The response goes back at once; classification runs after it, with up to 5 minutes to finish.
export const maxDuration = 300;

// Field names only, so lib/vaani.ts can be matched to what Vaani really sends.
const shape = (o: unknown): unknown =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? `array(${v.length})` : typeof v === "object" ? shape(v) : typeof v]))
    : typeof o;

/** Vaani Labs posts here when a call ends. */
export async function POST(req: Request) {
  const source = new URL(req.url).searchParams.get("source") === "replay" ? "replay" : "live";
  const raw = await req.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // handled below
  }

  // Keep live requests in webhook_log (unauthorised ones without their body).
  const log = (ok: boolean, error: string | null, keepBody: boolean) =>
    source === "live"
      ? sql()`INSERT INTO webhook_log (ok, error, shape, body, headers)
              VALUES (${ok}, ${error}, ${JSON.stringify(shape(body))}, ${keepBody ? raw.slice(0, 200_000) : null}, ${JSON.stringify(headerSummary(req))})`.catch(() => {})
      : Promise.resolve();

  if (!webhookAuthorised(req, raw)) {
    await log(false, "unauthorised", false);
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!body || typeof body !== "object") {
    await log(false, "body is not JSON", true);
    return Response.json({ error: "body is not JSON" }, { status: 400 });
  }

  // Only the end of a call carries the transcript. Acknowledge other events (started, ringing…) and do nothing.
  const event = String(body.event ?? body.event_type ?? body.type ?? "");
  if (event && !/end|complet|finish|hang|disconnect|analy/i.test(event)) {
    await log(true, `ignored event ${event}`, false);
    return Response.json({ ok: true, ignored: event });
  }

  let call;
  try {
    call = normaliseVaaniPayload(body);
  } catch (err) {
    // A connectivity test or an unexpected shape: answer OK so the sender doesn't retry, and keep it for inspection.
    await log(false, (err as Error).message, true);
    return Response.json({ ok: true, ignored: (err as Error).message });
  }
  await log(true, call.transcript ? null : "no transcript in payload", true);

  const { stored } = await storeCall(call, source);
  if (!stored) return Response.json({ ok: true, call_id: call.call_id, duplicate: true });

  after(() => classifyAndHandOff(call.call_id));
  return Response.json({ ok: true, call_id: call.call_id, status: "classifying" }, { status: 202 });
}
