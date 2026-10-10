import { webhookAuthorised } from "@/lib/auth";
import { processCall } from "@/lib/process-call";
import { normaliseVaaniPayload } from "@/lib/vaani";

export const maxDuration = 60;

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

  let call;
  try {
    call = normaliseVaaniPayload(body);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const source = new URL(req.url).searchParams.get("source") === "replay" ? "replay" : "live";
  const result = await processCall(call, source);
  return Response.json({ ok: true, call_id: call.call_id, ...result });
}
