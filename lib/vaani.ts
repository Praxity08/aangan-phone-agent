import type { IncomingCall } from "./types";

/**
 * Turns the voice platform's post-call webhook into an IncomingCall.
 *
 * Vaani Labs has no public webhook spec, so this accepts the common shapes and is the ONE place
 * to adjust once you see a real payload (log one with `console.log(JSON.stringify(body))`).
 * Expected, by default:
 *   { call_id, from, started_at, answered_at?, ended_at?, duration_seconds?,
 *     transcript: string | [{ role: "agent"|"caller", text }], cost_inr? }
 */
export function normaliseVaaniPayload(body: Record<string, any>): IncomingCall {
  const call = body.call ?? body.data ?? body;

  const call_id = String(call.call_id ?? call.callId ?? call.id ?? "");
  if (!call_id) throw new Error("payload has no call id");

  const started = new Date(call.started_at ?? call.startedAt ?? call.start_time ?? call.created_at ?? Date.now());
  const answered = call.answered_at ?? call.answeredAt;
  const ended = call.ended_at ?? call.endedAt ?? call.end_time;

  const duration_seconds = Number(
    call.duration_seconds ?? call.duration ?? (ended ? (new Date(ended).getTime() - started.getTime()) / 1000 : 0),
  );
  const answer_seconds = answered ? Math.max(0, (new Date(answered).getTime() - started.getTime()) / 1000) : null;

  const raw = call.transcript ?? call.messages ?? call.conversation ?? "";
  const transcript = Array.isArray(raw)
    ? raw
        .map((m: any) => `${/agent|assistant|bot/i.test(m.role ?? m.speaker ?? "") ? "Agent" : "Caller"}: ${m.text ?? m.content ?? m.message ?? ""}`)
        .join("\n")
    : String(raw);

  const cost = call.cost_inr ?? call.costInr;

  return {
    call_id,
    phone: call.from ?? call.from_number ?? call.caller ?? call.customer_number ?? null,
    started_at: started,
    answer_seconds: answer_seconds === null ? null : Math.round(answer_seconds),
    duration_seconds: Math.round(duration_seconds),
    transcript,
    voice_cost_inr: cost === undefined || cost === null ? null : Number(cost),
  };
}
