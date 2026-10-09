import { webhookAuthorised } from "@/lib/auth";
import { processCall } from "@/lib/process-call";
import { normaliseVaaniPayload } from "@/lib/vaani";

export const maxDuration = 60;

/** Vaani Labs posts here when a call ends. */
export async function POST(req: Request) {
  if (!webhookAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

  let call;
  try {
    call = normaliseVaaniPayload(await req.json());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const source = new URL(req.url).searchParams.get("source") === "replay" ? "replay" : "live";
  const result = await processCall(call, source);
  return Response.json({ ok: true, call_id: call.call_id, ...result });
}
